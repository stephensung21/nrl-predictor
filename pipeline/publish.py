"""
Publish the pipeline's records to the Supabase database (PLAN_WEB.md step 7).

The repo is the source of truth: everything here comes from data/pipeline/live/<season>/ (runs,
predictions, graded games, odds snapshots, fixtures), the processed tables, the odds sheet, the
frozen models' meta.json and the team lists fetched. Every write is an upsert keyed on the table's
primary key, in one transaction, so publishing is safe to re-run and the model tables can always be
rebuilt from the repo. Nothing here touches the tippers' own data except the Model's profile and tips.

- live (the default; run after each scheduled job): the season's matches (finished, and the coming
  games the predict job has seen), the odds sheet's prices and the live snapshots, team lists, Elo for
  the season, each round's margin game, model versions, the run log, every prediction, the graded
  games and each game's weather (fetch_weather.py); then the Model's tips (and its margin for the margin game) for games not yet started.
- `--backfill SEASON`: a finished season from the final test's predictions
  (reports/predictions_2026.csv, from `train.py --final`), so the site starts with a real season.
  They used each game's final team list, so they're marked as a backfill, not a live record. Every
  scraped season's games (2021 on, for head to head) and Elo for every season since 2009 go with it,
  and the season's observed weather if `fetch_weather.py --backfill SEASON` has been run.

Connects with SUPABASE_DB_URL: the project's session pooler connection string (Project Settings →
Database → Connection string → Session pooler), which works over IPv4 as GitHub's runners need.
Without it, publishing is skipped. After publishing, REVALIDATE_URL (with REVALIDATE_SECRET) is
called so the website refreshes its cached pages, once the site exists (step 12).

Usage:
    python pipeline/publish.py                       # the current season's live records
    python pipeline/publish.py --backfill 2026
    python pipeline/publish.py --dry-run             # count the rows without connecting
"""

import argparse
import json
import os
import sys

import numpy as np
import pandas as pd
import psycopg
import requests
from psycopg.types.json import Jsonb

from common import ROOT, Records, load_matches
import config
import fetch_odds
import grade as gradelib
import predict
from elo import load_params, run_elo
from ingest import join_odds_to_matches, load_odds

MODEL_USER = "00000000-0000-4000-8000-00000000a0de"  # the Model's sign-in id and profile
LIVE_LISTS = ROOT / "data" / "raw" / "teamlists_live"


def env(name):
    """A setting from the environment, or from the repo's .env file (as fetch_odds.api_key)."""
    value = os.environ.get(name)
    dotenv = ROOT / ".env"
    if not value and dotenv.exists():
        for line in dotenv.read_text(encoding="utf-8").splitlines():
            key, sep, val = line.partition("=")
            if sep and key.strip() == name:
                value = val.strip().strip("\"'")
    return value or None


def ts(series):
    return pd.to_datetime(series, utc=True)


# ---------------------------------------------------------------- rows for each table

def model_version_rows(versions):
    """model_versions from each bundle's meta.json (models/<season>/), for the versions given."""
    rows = []
    for meta_file in sorted((ROOT / "models").glob("*/meta.json")):
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
        if meta["version"] not in versions:
            continue
        rows.append({"version": meta["version"], "season": meta["season"],
                     "trained_on": meta["trained_on"]["seasons"], "commit": meta["commit"],
                     "features_sha256": meta.get("features_sha256"), "settings": Jsonb(meta.get("settings", {})),
                     "frozen_at": pd.Timestamp(meta["run_at"], tz="UTC")})
    missing = set(versions) - {r["version"] for r in rows}
    if missing:
        raise ValueError(f"no models/<season>/meta.json for model version(s) {sorted(missing)}")
    return pd.DataFrame(rows)


def match_rows(seasons, fixtures, odds):
    """The seasons' games: scraped ones (with results) and the coming ones the predict job has seen."""
    played = load_matches()
    played = played[played["season"].isin(seasons)]
    coming = fixtures[~fixtures["match_id"].isin(played["match_id"])] if len(fixtures) else fixtures
    m = pd.concat([played, coming], ignore_index=True)
    m["start_time_utc"] = ts(m["start_time_utc"])
    joined = join_odds_to_matches(m[["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    sheet_neutral = joined.merge(odds[["odds_id", "neutral"]], on="odds_id").set_index("match_id")["neutral"]
    seen_neutral = fixtures.set_index("match_id")["neutral"] if len(fixtures) else pd.Series(dtype=bool)
    neutral = m["match_id"].map(sheet_neutral).fillna(m["match_id"].map(seen_neutral)).fillna(False).astype(bool)
    final = m["home_score"].notna() & m["away_score"].notna()
    return pd.DataFrame({
        "id": m["match_id"].astype("int64"), "season": m["season"].astype(int), "round": m["round"].astype(int),
        "round_title": m["round_title"], "is_final": m["is_final"].fillna(False).astype(bool),
        "kickoff": m["start_time_utc"], "home_team": m["home_team"], "away_team": m["away_team"],
        "venue": m["venue"], "city": m["venue_city"], "neutral": neutral, "url": m["url"],
        "status": np.where(final, "final", "scheduled"),
        "home_score": m["home_score"].where(final), "away_score": m["away_score"].where(final),
    }).drop_duplicates("id")


def odds_sheet_rows(matches, odds):
    joined = join_odds_to_matches(
        matches.rename(columns={"id": "match_id", "kickoff": "start_time_utc"})[
            ["match_id", "start_time_utc", "home_team", "away_team"]], odds).dropna(subset=["odds_id"])
    o = joined.merge(odds, on="odds_id", suffixes=("", "_sheet"))
    o = o[o["home_odds_open"].notna() | o["home_odds_close"].notna()]
    return pd.DataFrame({
        "match_id": o["match_id"].astype("int64"), "bookmaker": o["bookmaker"],
        "home_odds_open": o["home_odds_open"], "away_odds_open": o["away_odds_open"],
        "home_line_open": o["open_line"], "total_open": o["open_total"],
        "home_odds_close": o["home_odds_close"], "away_odds_close": o["away_odds_close"],
        "home_line_close": o["close_line"], "total_close": o["close_total"],
        "close_ok": o["close_ok"].astype(bool),
    })


def snapshot_rows(snaps, matches):
    """Live prices with their nrl.com match id, turned round where the API has home and away swapped."""
    if snaps is None or snaps.empty:
        return pd.DataFrame()
    fixtures = matches.rename(columns={"id": "match_id", "kickoff": "start_time_utc"})
    ids = fetch_odds.match_events(snaps, fixtures)
    s = snaps.merge(ids, on="event_id")
    s = fetch_odds.turn_round(s, s["flipped"])
    cols = ["home_odds", "away_odds", "home_line", "home_line_odds", "away_line_odds", "total", "over_odds",
            "under_odds"]
    out = s[["match_id", "bookmaker"] + cols].assign(captured_at=ts(s["captured_at"]))
    return out.drop_duplicates(["match_id", "bookmaker", "captured_at"], keep="last")


def team_list_rows(season, match_ids):
    """Every version of every team list the pipeline fetched for these games."""
    files = sorted((LIVE_LISTS / str(season)).glob("*/*.csv"))
    if not files:
        return pd.DataFrame()
    lists = pd.concat([pd.read_csv(f) for f in files], ignore_index=True)
    lists = lists[lists["match_id"].isin(match_ids)]
    out = pd.DataFrame({
        "match_id": lists["match_id"].astype("int64"), "team": lists["team"], "fetched_at": ts(lists["fetched_utc"]),
        "list_updated_at": ts(lists["list_updated_utc"]), "player_id": lists["player_id"].astype("int64"),
        "player_name": lists["player_name"], "jersey_number": lists["jersey_number"].astype(int),
        "position": lists["position"],
    })
    return out.drop_duplicates(["match_id", "fetched_at", "player_id"], keep="last")


def elo_rows(odds, published, seasons=None):
    """Each team's rating before and after every game in the odds sheet (src/elo.py, its tuned
    settings), for the given seasons (all when None). nrl.com's round where the scraper has the game,
    otherwise the week of the season; the match id where the game is among those `published`."""
    e = odds.join(run_elo(odds, **load_params(odds), after=True))
    e = e[e["home_score"].notna() & e["away_score"].notna()]
    if seasons is not None:
        e = e[e["season"].isin(seasons)]
    scraped = load_matches()
    joined = join_odds_to_matches(scraped, odds).dropna(subset=["odds_id"])
    by_odds = joined.set_index(joined["odds_id"].astype(int))
    start = e.groupby("season")["date"].transform("min")
    start = start - pd.to_timedelta((start.dt.weekday - 1) % 7, unit="D")  # rounds run Tuesday to Monday
    week = ((e["date"] - start).dt.days // 7 + 1).astype(int)
    match_id = e["odds_id"].map(by_odds["match_id"])
    rnd = e["odds_id"].map(by_odds["round"]).fillna(week).astype(int)
    title = e["odds_id"].map(by_odds["round_title"])
    label = np.where(e["is_final"], title.fillna("Finals"), "R" + rnd.astype(str))
    sides = []
    for side, other, before, after, prob in (("home_team", "away_team", "elo_home", "elo_home_after", e["elo_prob"]),
                                             ("away_team", "home_team", "elo_away", "elo_away_after", 1 - e["elo_prob"])):
        sides.append(pd.DataFrame({
            "team": e[side], "season": e["season"].astype(int), "played_on": e["date"].dt.date,
            "round_label": label, "opponent": e[other], "is_home": side == "home_team",
            "match_id": match_id.where(match_id.isin(published)).astype("Int64"), "win_prob": prob,
            "points_for": e[side.replace("team", "score")].astype(int),
            "points_against": e[other.replace("team", "score")].astype(int), "rating_before": e[before],
            "rating_after": e[after]}))
    return pd.concat(sides, ignore_index=True)


def round_rows(drawn, match_ids):
    """Each round's margin game, as drawn by the predict job."""
    if drawn.empty:
        return pd.DataFrame()
    d = drawn[drawn["featured_match"].isin(match_ids)].drop_duplicates(["season", "round"], keep="first")
    return pd.DataFrame({"season": d["season"].astype(int), "round": d["round"].astype(int),
                         "featured_match": d["featured_match"].astype("int64"), "drawn_at": ts(d["drawn_at"])})


def summary_rows(summaries, match_ids, run_ids):
    """The latest text for each kind and subject (summaries.py)."""
    if summaries.empty:
        return pd.DataFrame()
    s = summaries[summaries["match_id"].isna() | summaries["match_id"].isin(match_ids)]
    s = s.drop_duplicates(["kind", "season", "round", "match_id"], keep="last")
    return pd.DataFrame({
        "kind": s["kind"], "season": s["season"].astype(int), "round": s["round"].astype("Int64"),
        "match_id": s["match_id"].astype("Int64"), "body": s["body"], "llm_model": s["llm_model"],
        "prompt_version": s["prompt_version"], "run_id": s["run_id"].where(s["run_id"].isin(run_ids)),
        "created_at": ts(s["created_at"])})


def weather_rows(weather, match_ids):
    """The latest forecast and the observation for each game (fetch_weather.py)."""
    if weather.empty:
        return pd.DataFrame()
    w = weather[weather["match_id"].isin(match_ids)].drop_duplicates(["match_id", "kind"], keep="last")
    return pd.DataFrame({
        "match_id": w["match_id"].astype("int64"), "kind": w["kind"], "fetched_at": ts(w["fetched_at"]),
        "source": w["source"], "roofed": w["roofed"].astype(bool), "temp_c": w["temp_c"], "rain_mm": w["rain_mm"],
        "rain_chance": w["rain_chance"].astype("Int64"), "wind_kmh": w["wind_kmh"], "gust_kmh": w["gust_kmh"],
        "wind_dir": w["wind_dir"].astype("Int64"), "weather_code": w["weather_code"].astype("Int64"),
        "conditions": w["conditions"]})


def run_rows(runs):
    rows = []
    for r in runs:
        rows.append({"id": r["id"], "job": r["job"], "season": r["season"], "mode": r["mode"],
                     "as_of": pd.Timestamp(r["as_of"]), "started_at": pd.Timestamp(r["started"]),
                     "finished_at": pd.Timestamp(r["finished"]) if r.get("finished") else None,
                     "status": r["status"], "round": r.get("round"), "games": r.get("games"),
                     "model_version": r.get("model_version"), "commit": r.get("commit"), "notes": r.get("notes"),
                     "record": Jsonb(r)})
    return pd.DataFrame(rows)


def prediction_rows(preds):
    return pd.DataFrame({
        "run_id": preds["run_id"], "match_id": preds["match_id"].astype("int64"), "created_at": ts(preds["created_at"]),
        "model_version": preds["model_version"].astype(str), "model": preds["model"],
        "home_win_prob": preds["home_win_prob"], "margin": preds["margin"], "total": preds["total"],
        "home_score": preds["home_score"].astype(int), "away_score": preds["away_score"].astype(int),
        "no_odds_home_win_prob": preds["no_odds_home_win_prob"], "market_open_home_prob": preds["market_open_home_prob"],
        "inputs": preds["inputs"],
    })


def graded_rows(graded):
    return pd.DataFrame({
        "match_id": graded["match_id"].astype("int64"), "run_id": graded["run_id"].astype(str),
        "model_version": graded["model_version"].astype(str), "home_win_prob": graded["home_win_prob"],
        "margin": graded["margin"], "total": graded["total"], "p_open": graded["p_open"],
        "open_line": graded["open_line"], "open_total": graded["open_total"], "p_close": graded["p_close"],
        "close_line": graded["close_line"], "close_total": graded["close_total"],
        "close_ok": graded["close_ok"].fillna(False).astype(bool), "elo_prob": graded["elo_prob"],
        "margin_actual": graded["margin_actual"].astype(int), "total_actual": graded["total_actual"].astype(int),
        "tip_correct": graded["tip_correct"].astype(bool),
    })


# ---------------------------------------------------------------- what to publish

def live_tables(season, records):
    """Every table's rows for the season's live records, in the order they must be written."""
    odds = load_odds()
    matches = match_rows([season], records.fixtures(), odds)
    runs = records.runs()
    preds = records.predictions()
    preds = preds[preds["match_id"].isin(matches["id"])]
    graded = records.graded()
    versions = {r["model_version"] for r in runs if r.get("model_version")} | set(preds["model_version"].astype(str))
    return {
        "model_versions": model_version_rows(versions) if versions else pd.DataFrame(),
        "matches": matches,
        "odds_sheet": odds_sheet_rows(matches, odds),
        "odds_snapshots": snapshot_rows(records.odds_snapshots(), matches),
        "team_lists": team_list_rows(season, set(matches["id"])),
        "rounds": round_rows(records.rounds(), set(matches["id"])),
        "elo_ratings": elo_rows(odds, set(matches["id"]), [season]),
        "pipeline_runs": run_rows(runs),
        "predictions": prediction_rows(preds),
        "graded_games": graded_rows(graded) if graded is not None else pd.DataFrame(),
        "summaries": summary_rows(records.summaries(), set(matches["id"]), {r["id"] for r in runs}),
        "weather": weather_rows(records.weather(), set(matches["id"])),
    }


def backfill_tables(season, predictions_file=None):
    """A finished season from the final test's predictions, as one backfill run."""
    predictions_file = predictions_file or config.REPORTS / f"predictions_{season}.csv"
    if not predictions_file.exists():
        raise SystemExit(f"{predictions_file} not found: run `python src/train.py --final` first.")
    odds = load_odds()
    matches = match_rows(sorted(load_matches()["season"].unique()), pd.DataFrame(), odds)  # head to head needs them
    p = pd.read_csv(predictions_file)
    p = p[p["match_id"].isin(matches["id"])]
    kickoff = p["match_id"].map(matches.set_index("id")["kickoff"])
    version = f"{season}.1"
    run_id = f"backfill-{season}"
    with_odds = p["with_odds|ensemble|home_win"].notna()
    prob = p["with_odds|ensemble|home_win"].fillna(p["no_odds|ensemble|home_win"])
    margin = p["with_odds|ensemble|margin"].fillna(p["no_odds|ensemble|margin"])
    total = p["with_odds|ensemble|total"].fillna(p["no_odds|ensemble|total"])
    home, away = predict.display_scores(prob.to_numpy(), margin.to_numpy(), total.to_numpy())
    preds = pd.DataFrame({
        "run_id": run_id, "match_id": p["match_id"], "created_at": kickoff - pd.Timedelta(hours=1),
        "model_version": version, "model": np.where(with_odds, "with odds", "no odds"), "home_win_prob": prob,
        "margin": margin, "total": total, "home_score": home, "away_score": away,
        "no_odds_home_win_prob": p["no_odds|ensemble|home_win"], "market_open_home_prob": p["p_open"],
        "inputs": None, "start_time_utc": kickoff})
    graded = gradelib.grade(preds.drop(columns=["home_score", "away_score"]), odds=odds)
    now = pd.Timestamp.now(tz="UTC")
    run = {"id": run_id, "job": "backfill", "season": season, "mode": "backfill", "as_of": now.isoformat(),
           "started": now.isoformat(), "finished": now.isoformat(), "status": "ok", "games": int(len(preds)),
           "model_version": version, "commit": predict.git_commit()[0],
           "notes": f"the final test's predictions ({predictions_file.name}), made from each game's final team "
                    "list, published as each game's prediction of record an hour before kickoff"}
    return {
        "model_versions": model_version_rows({version}),
        "matches": matches,
        "odds_sheet": odds_sheet_rows(matches, odds),
        "elo_ratings": elo_rows(odds, set(matches["id"])),
        "pipeline_runs": run_rows([run]),
        "predictions": prediction_rows(preds),
        "graded_games": graded_rows(graded),
        "weather": weather_rows(Records(season, replay=False).weather(), set(matches["id"])),
    }


# ---------------------------------------------------------------- writing

KEYS = {"model_versions": ["version"], "matches": ["id"], "odds_sheet": ["match_id"],
        "odds_snapshots": ["match_id", "bookmaker", "captured_at"], "team_lists": ["match_id", "fetched_at", "player_id"],
        "elo_ratings": ["team", "played_on"], "rounds": ["season", "round"],
        "summaries": ["kind", "season", "round", "match_id"], "pipeline_runs": ["id"], "predictions": ["run_id", "match_id"],
        "graded_games": ["match_id"], "weather": ["match_id", "kind"]}


def plain(v):
    """A value psycopg can send: None for missing, Python numbers and datetimes for numpy and pandas ones."""
    if v is None or v is pd.NA or v is pd.NaT:
        return None
    if isinstance(v, float) and np.isnan(v):
        return None
    if isinstance(v, np.generic):
        v = v.item()
        return None if isinstance(v, float) and np.isnan(v) else v
    if isinstance(v, pd.Timestamp):
        return v.to_pydatetime()
    return v


def upsert(cur, table, df):
    """Insert or update every row, keyed on the table's primary key."""
    if df is None or df.empty:
        return 0
    key, cols = KEYS[table], list(df.columns)
    updates = ", ".join(f"{c} = excluded.{c}" for c in cols if c not in key)
    sql = (f"insert into {table} ({', '.join(cols)}) values ({', '.join(['%s'] * len(cols))}) "
           f"on conflict ({', '.join(key)}) do " + (f"update set {updates}" if updates else "nothing"))
    cur.executemany(sql, [tuple(plain(v) for v in row) for row in df.itertuples(index=False, name=None)])
    return len(df)


def model_tips(cur, season, started_too):
    """The Model tips its prediction of record, and its margin for the round's margin game. It is a
    tipper like any other, so only games not yet started are tipped, except in a backfill."""
    cur.execute("insert into auth.users (id, aud, role, email) values (%s, 'authenticated', 'authenticated', "
                "'model@rugbyleague-tipper.invalid') on conflict (id) do nothing", (MODEL_USER,))
    cur.execute("insert into profiles (id, display_name, is_model) values (%s, 'Model', true) "
                "on conflict (id) do nothing", (MODEL_USER,))
    cur.execute("""
        insert into tips (user_id, match_id, team, margin)
        select %(model)s, m.id,
               case when p.home_win_prob >= 0.5 then m.home_team else m.away_team end,
               case when r.featured_match = m.id then greatest(1, least(200, round(abs(p.margin))))::int end
        from prediction_of_record p
        join matches m on m.id = p.match_id
        left join rounds r on r.season = m.season and r.round = m.round
        where m.season = %(season)s and (%(started_too)s or m.kickoff > now())
        on conflict (user_id, match_id) do update set team = excluded.team, margin = excluded.margin
    """, {"model": MODEL_USER, "season": season, "started_too": started_too})
    return cur.rowcount


def publish(tables, url, season, backfill=False, conn=None):
    """Write every table in one transaction; returns rows written per table. Connects to `url`, or
    uses an open connection `conn` (the tests reuse one)."""
    if conn is None:
        with psycopg.connect(url, prepare_threshold=None) as conn:
            return publish(tables, url, season, backfill, conn)
    counts = {}
    with conn.transaction(), conn.cursor() as cur:
        for table, rows in tables.items():
            counts[table] = upsert(cur, table, rows)
        counts["model tips"] = model_tips(cur, season, started_too=backfill)
    return counts


def revalidate():
    """Ask the website to refresh its cached pages (once it exists, step 12). A failure is only a warning."""
    url, secret = env("REVALIDATE_URL"), env("REVALIDATE_SECRET")
    if not url:
        return "skipped (no REVALIDATE_URL)"
    try:
        r = requests.post(url, headers={"Authorization": f"Bearer {secret}"}, timeout=30)
        return f"{r.status_code}"
    except requests.RequestException as ex:
        return f"failed ({type(ex).__name__})"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", type=int, default=config.PREDICT_SEASON)
    parser.add_argument("--backfill", type=int, metavar="SEASON", help="publish a finished season's final test")
    parser.add_argument("--dry-run", action="store_true", help="count the rows without connecting")
    args = parser.parse_args()
    season = args.backfill or args.season
    tables = backfill_tables(season) if args.backfill else live_tables(season, Records(season, replay=False))
    if args.dry_run:
        print({t: len(rows) for t, rows in tables.items()})
        return
    url = env("SUPABASE_DB_URL")
    if not url:
        print("publish: skipped (no SUPABASE_DB_URL)")
        return
    try:
        counts = publish(tables, url, season, backfill=bool(args.backfill))
    except psycopg.Error as ex:
        # The message never includes the connection string (it holds the password).
        print(f"publish FAILED: {type(ex).__name__}: {str(ex).splitlines()[0] if str(ex) else ''}", file=sys.stderr)
        sys.exit(1)
    print(f"publish: {counts}; revalidate: {revalidate()}")


if __name__ == "__main__":
    main()
