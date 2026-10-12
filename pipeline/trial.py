"""
A trial of the website and tipping comp before 2027: 2026's Rounds 1-3 played again over about nine
days, in a separate Supabase project, so friends can try everything that otherwise waits for the
first predicted round (tipping, lockout, auto-tips, the margin game, the ladder, what drove each
prediction, the price history, the value underdog flag).

The site works on the real clock (lockout, hidden tips and the auto-tip lock all compare kickoff
with the database's now()), so the games are moved into the coming days, in their real order:

- Round r opens (its predictions, team lists and margin game appear) at 9am Sydney on day 3(r-1) of
  the trial, and its eight games kick off over the next two days at noon, 3pm, 6pm and 9pm Sydney.
- A result appears at the first scheduled refresh after full time, as round.ts's gradedAt expects
  (05:00 or 23:00 UTC, at least two hours after kickoff).
- Prices: each game's opening price from the odds sheet an hour before its round opens, and its
  closing price 30 minutes before kickoff (the sheet has nothing in between).

`setup` predicts the three rounds once, as the predict job would have (the 2026 models, every input as
it stood before each round), with each game's archived Tuesday list where there is one and its final
17 otherwise; it records the predictions, what drove them, the team lists, the margin games and the
grades in data/pipeline/trial/. `publish` writes everything visible at the moment it runs, so running
it hourly (.github/workflows/trial.yml) plays the trial out. Nothing is ever deleted: what's visible
only grows.

The trial database is TRIAL_DB_URL (its session pooler string), never SUPABASE_DB_URL, and publish
refuses a database holding any 2026 game after Round 3 (the real one has the whole season).

Usage:
    python pipeline/trial.py setup --start 2026-10-15      # day 0: Round 1 opens at 9am that day
    python pipeline/trial.py reschedule --start 2026-10-20 # move it, without predicting again
    python pipeline/trial.py publish --history             # first time: also 2021-2025 and Elo since 2009
    python pipeline/trial.py publish                       # hourly
    python pipeline/trial.py publish --at "2026-10-17 20:00" --dry-run
    python pipeline/trial.py invite                        # a join code for the first tipper
    python pipeline/trial.py admin "sbeve"                 # make a joined tipper the trial's admin
"""

import argparse
import json
import sys
import warnings

import numpy as np
import pandas as pd
import psycopg

import grade as gradelib
import publish as pub
from common import ROOT, load_matches
from draw import draw_featured
from ingest import load_odds

SEASON = 2026
ROUNDS = [1, 2, 3]
SYDNEY = "Australia/Sydney"
GAME_TIMES = ["12:00", "15:00", "18:00", "21:00"]  # Sydney, four games a day
OPENS_AT = "09:00"
RESULT_HOURS_UTC = [5, 23]  # the refresh runs round.ts's gradedAt waits for
TRIAL = ROOT / "data" / "pipeline" / "trial"
BOOKMAKER = "betr_au"  # the site's live prices are Betr's; the trial stands the sheet's in for them


# ---------------------------------------------------------------- the timetable

def results_at(kickoff):
    """The first scheduled refresh after full time (round.ts gradedAt): 2 hours after kickoff, then
    the next 05:00 or 23:00 UTC."""
    t = (kickoff + pd.Timedelta(hours=2)).floor("h")
    while True:
        t += pd.Timedelta(hours=1)
        if t.hour in RESULT_HOURS_UTC:
            return t


def timetable(games, start):
    """When each game's round opens, kicks off and gets its result, from the trial's first day
    (`start`, a date in Sydney). `games`: match_id, round, start_time_utc (the real kickoff, for order)."""
    day0 = pd.Timestamp(start).normalize()
    rows = []
    for i, rnd in enumerate(sorted(games["round"].unique())):
        g = games[games["round"] == rnd].sort_values(["start_time_utc", "match_id"])
        opens = (day0 + pd.Timedelta(days=3 * i) + pd.Timedelta(OPENS_AT + ":00")).tz_localize(SYDNEY)
        for j, mid in enumerate(g["match_id"]):
            day, slot = divmod(j, len(GAME_TIMES))
            local = day0 + pd.Timedelta(days=3 * i + 1 + day) + pd.Timedelta(GAME_TIMES[slot] + ":00")
            kickoff = local.tz_localize(SYDNEY).tz_convert("UTC")
            rows.append({"match_id": int(mid), "round": int(rnd), "opens_at": opens.tz_convert("UTC"),
                         "kickoff": kickoff, "results_at": results_at(kickoff)})
    return pd.DataFrame(rows)


# ---------------------------------------------------------------- setup: predict once

def team_lists(fixtures):
    """Each game's lists as the predict job would have seen them: the archived Tuesday list where
    there is one for that team, otherwise the 17 who played. Returns (tuesday, final) in the archive's
    columns; final is always the 17 who played."""
    from features import PRE_KICKOFF_FILE
    ids = set(fixtures["match_id"])
    archive = pd.read_csv(PRE_KICKOFF_FILE)
    archive = archive[archive["match_id"].isin(ids)]
    played = pd.read_csv(ROOT / "data" / "processed" / "player_match_stats.csv",
                         usecols=["match_id", "team", "player_id", "player_name", "jersey_number", "position"])
    played = played[played["match_id"].isin(ids)]
    have = set(zip(archive["match_id"], archive["team"]))
    missing = played[[k not in have for k in zip(played["match_id"], played["team"])]]
    cols = ["match_id", "team", "player_id", "player_name", "jersey_number", "position"]
    tuesday = pd.concat([archive[cols], missing[cols]], ignore_index=True)
    return tuesday, played[cols].reset_index(drop=True)


def setup(start, rng=None):
    """Predict the trial's rounds and record everything publish needs in data/pipeline/trial/."""
    import explain
    import predict
    warnings.filterwarnings("ignore")
    matches = load_matches()
    games = matches[(matches["season"] == SEASON) & matches["round"].isin(ROUNDS)].copy()
    games["start_time_utc"] = pd.to_datetime(games["start_time_utc"], utc=True)
    times = timetable(games, start)
    bundle = predict.load_bundle(SEASON)
    version = bundle.get("version")
    tuesday, final = team_lists(games)
    preds, drivers, drawn = [], [], []
    previous = None
    for rnd in ROUNDS:
        fx = games[games["round"] == rnd].copy()
        fx["start_time_utc"] = fx["start_time_utc"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        lists = tuesday[tuesday["match_id"].isin(fx["match_id"])]
        # live: no weather until the week's forecast (as the predict job)
        out, rows, errors, _ = predict.predict_fixtures(fx, lists, bundle, keep_weather=False)
        if errors:
            raise SystemExit(f"round {rnd}: validation failed: {errors}")
        if len(out) != len(fx):
            raise SystemExit(f"round {rnd}: predicted {len(out)} of {len(fx)} games")
        t = times[times["round"] == rnd].set_index("match_id")
        run_id = f"trial-r{rnd}"
        out["run_id"], out["model_version"] = run_id, version
        out["start_time_utc"] = pd.to_datetime(rows["start_time_utc"], utc=True).to_numpy()  # real, for grading
        preds.append(out)
        d = explain.explain(bundle, rows, predict.variant_of(out), out.set_index("match_id")["home_win_prob"])
        drivers.append(d.assign(run_id=run_id))
        shifted = fx.assign(start_time_utc=fx["match_id"].map(t["kickoff"]))
        pick, eligible = draw_featured(shifted, previous, rng)
        game = shifted[shifted["match_id"] == pick].iloc[0]
        previous = (game["home_team"], game["away_team"])
        drawn.append({"season": SEASON, "round": rnd, "featured_match": pick, "home_team": game["home_team"],
                      "away_team": game["away_team"],
                      "eligible": ";".join(str(m) for m in eligible["match_id"]), "run_id": run_id})
    preds = pd.concat(preds, ignore_index=True)
    graded = gradelib.grade(preds.drop(columns=["home_score", "away_score"]), odds=load_odds())

    TRIAL.mkdir(parents=True, exist_ok=True)
    (TRIAL / "trial.json").write_text(json.dumps(
        {"season": SEASON, "rounds": ROUNDS, "start": str(pd.Timestamp(start).date()), "model_version": version,
         "commit": predict.git_commit()[0], "set_up_at": pd.Timestamp.now(tz="UTC").isoformat()}, indent=2) + "\n")
    times.to_csv(TRIAL / "timetable.csv", index=False)
    preds.to_csv(TRIAL / "predictions.csv", index=False)
    pd.concat(drivers, ignore_index=True).to_csv(TRIAL / "drivers.csv", index=False)
    tuesday.assign(version="tuesday").pipe(lambda t: pd.concat([t, final.assign(version="final")])) \
        .to_csv(TRIAL / "team_lists.csv", index=False)
    pd.DataFrame(drawn).to_csv(TRIAL / "rounds.csv", index=False)
    graded.to_csv(TRIAL / "graded.csv", index=False)
    return times, preds


# ---------------------------------------------------------------- publish: what's visible now

def reschedule(start):
    """Move the trial to a new first day without predicting again."""
    trial = load_trial()
    real = load_matches().set_index("match_id")["start_time_utc"]
    games = trial["timetable"][["match_id", "round"]].assign(
        start_time_utc=lambda g: pd.to_datetime(g["match_id"].map(real), utc=True))
    times = timetable(games, start)
    times.to_csv(TRIAL / "timetable.csv", index=False)
    meta = {**trial["meta"], "start": str(pd.Timestamp(start).date())}
    (TRIAL / "trial.json").write_text(json.dumps(meta, indent=2) + "\n")
    return times


def load_trial():
    """The records setup wrote, with timestamps parsed."""
    if not (TRIAL / "trial.json").exists():
        raise SystemExit("no trial set up: run `python pipeline/trial.py setup --start YYYY-MM-DD` first")
    when = lambda df, cols: df.assign(**{c: pd.to_datetime(df[c], utc=True) for c in cols})  # noqa: E731
    return {
        "meta": json.loads((TRIAL / "trial.json").read_text(encoding="utf-8")),
        "timetable": when(pd.read_csv(TRIAL / "timetable.csv"), ["opens_at", "kickoff", "results_at"]),
        "predictions": when(pd.read_csv(TRIAL / "predictions.csv"), ["start_time_utc"]),
        "drivers": pd.read_csv(TRIAL / "drivers.csv"),
        "team_lists": pd.read_csv(TRIAL / "team_lists.csv"),
        "rounds": pd.read_csv(TRIAL / "rounds.csv"),
        "graded": pd.read_csv(TRIAL / "graded.csv"),
    }


def snapshots(times, sheet):
    """The two prices each game gets: opening an hour before its round opens, closing 30 minutes before
    kickoff (when the sheet's closing price is reliable). `sheet`: publish.odds_sheet_rows."""
    s = times.merge(sheet, on="match_id")
    opening = pd.DataFrame({"match_id": s["match_id"], "bookmaker": BOOKMAKER,
                            "captured_at": s["opens_at"] - pd.Timedelta(hours=1),
                            "home_odds": s["home_odds_open"], "away_odds": s["away_odds_open"],
                            "home_line": s["home_line_open"], "total": s["total_open"]})
    c = s[s["close_ok"] & s["home_odds_close"].notna()]
    closing = pd.DataFrame({"match_id": c["match_id"], "bookmaker": BOOKMAKER,
                            "captured_at": c["kickoff"] - pd.Timedelta(minutes=30),
                            "home_odds": c["home_odds_close"], "away_odds": c["away_odds_close"],
                            "home_line": c["home_line_close"], "total": c["total_close"]})
    return pd.concat([opening, closing], ignore_index=True).dropna(subset=["home_odds", "away_odds"])


def visible(trial, now, odds):
    """The trial's own rows as they stand at `now`: rounds that have opened, prices already captured,
    lists already fetched and results already in. `odds`: the sheet with results (ingest.load_odds)."""
    now = pd.Timestamp(now)
    meta, times = trial["meta"], trial["timetable"]
    opened = times[times["opens_at"] <= now]
    ids = set(opened["match_id"])
    revealed = set(opened.loc[opened["results_at"] <= now, "match_id"])
    if opened.empty:  # before Round 1 opens: nothing of the trial's yet
        return {"model_versions": pub.model_version_rows({meta["model_version"]})}

    real = pub.match_rows([SEASON], pd.DataFrame(), odds)
    real = real[real["id"].isin(ids)]
    t = opened.set_index("match_id")
    matches = real.assign(kickoff=real["id"].map(t["kickoff"]))
    done = matches["id"].isin(revealed)
    matches["status"] = np.where(done, "final", "scheduled")
    matches["home_score"] = matches["home_score"].where(done)
    matches["away_score"] = matches["away_score"].where(done)

    snaps = snapshots(opened, pub.odds_sheet_rows(real, odds))
    snaps = snaps[snaps["captured_at"] <= now]

    # Made, and the margin game drawn, as the round opens (the timetable can move: `reschedule`).
    preds = trial["predictions"]
    preds = preds[preds["match_id"].isin(ids)].assign(created_at=lambda p: p["match_id"].map(t["opens_at"]))
    opens = opened.groupby("round")["opens_at"].min()
    drawn = trial["rounds"].assign(drawn_at=lambda r: r["round"].map(opens))
    predicted = set(zip(preds["run_id"].astype(str), preds["match_id"].astype("int64")))
    runs = [{"id": f"trial-r{r}", "job": "predict", "season": SEASON, "mode": "replay",
             "as_of": g["opens_at"].min().isoformat(), "started": g["opens_at"].min().isoformat(),
             "finished": g["opens_at"].min().isoformat(), "status": "ok", "round": int(r), "games": int(len(g)),
             "model_version": meta["model_version"], "commit": meta["commit"],
             "notes": f"trial: {SEASON} Round {r} played again from {meta['start']} (pipeline/trial.py)"}
            for r, g in opened.groupby("round")]

    lists = trial["team_lists"]
    lists = lists[lists["match_id"].isin(ids)].copy()
    fetched = np.where(lists["version"] == "tuesday", lists["match_id"].map(t["opens_at"]),
                       lists["match_id"].map(t["kickoff"]) - pd.Timedelta(hours=1))
    lists["fetched_at"] = pd.to_datetime(fetched, utc=True)
    lists = lists[lists["fetched_at"] <= now]
    team_lists = pd.DataFrame({
        "match_id": lists["match_id"].astype("int64"), "team": lists["team"], "fetched_at": lists["fetched_at"],
        "list_updated_at": lists["fetched_at"], "player_id": lists["player_id"].astype("int64"),
        "player_name": lists["player_name"], "jersey_number": lists["jersey_number"].astype(int),
        "position": lists["position"]}).drop_duplicates(["match_id", "fetched_at", "player_id"])

    elo = pub.elo_rows(odds, revealed, [SEASON])
    elo = elo[elo["match_id"].isin(revealed)].copy()
    elo["played_on"] = elo["match_id"].astype("int64").map(t["kickoff"]).dt.tz_convert(SYDNEY).dt.date

    graded = trial["graded"]
    graded = graded[graded["match_id"].isin(revealed)]
    return {
        "model_versions": pub.model_version_rows({meta["model_version"]}),
        "matches": matches,
        "odds_snapshots": snaps,
        "team_lists": team_lists,
        "rounds": pub.round_rows(drawn, ids),
        "elo_ratings": elo,
        "pipeline_runs": pub.run_rows(runs),
        "predictions": pub.prediction_rows(preds.assign(inputs=None)),
        "prediction_drivers": pub.driver_rows(trial["drivers"], predicted),
        "graded_games": pub.graded_rows(graded) if len(graded) else pd.DataFrame(),
    }


def history(odds):
    """Everything before the trial: 2021-2025's games and prices (head to head, form) and Elo for every
    season since 2009 up to 2025."""
    matches = pub.match_rows(sorted(s for s in load_matches()["season"].unique() if s < SEASON), pd.DataFrame(), odds)
    elo = pub.elo_rows(odds, set(matches["id"]))
    return {"matches": matches, "odds_sheet": pub.odds_sheet_rows(matches, odds),
            "elo_ratings": elo[elo["season"] < SEASON]}


def with_history(tables, old):
    """The trial's tables with the history before them, in an order the foreign keys allow."""
    out = {"model_versions": tables["model_versions"]}
    for k in ["matches", "odds_sheet", "elo_ratings"]:
        out[k] = pd.concat([old[k], tables[k]], ignore_index=True) if k in tables else old[k]
    return {**out, **{k: v for k, v in tables.items() if k not in out}}


def check_trial_db(cur):
    """Refuse the real database: it has 2026 games after Round 3."""
    cur.execute("select count(*) from matches where season = %s and round > %s", (SEASON, max(ROUNDS)))
    if cur.fetchone()[0]:
        raise SystemExit(f"this database has {SEASON} games after Round {max(ROUNDS)}: it isn't the trial's. "
                         "Nothing written.")


def publish_trial(tables, url):
    with psycopg.connect(url, prepare_threshold=None) as conn:
        with conn.cursor() as cur:
            check_trial_db(cur)
        return pub.publish(tables, url, SEASON, conn=conn)


def trial_url():
    url = pub.env("TRIAL_DB_URL")
    if not url:
        raise SystemExit("no TRIAL_DB_URL (the trial project's session pooler string)")
    if url == pub.env("SUPABASE_DB_URL"):
        raise SystemExit("TRIAL_DB_URL is the real database's SUPABASE_DB_URL. Nothing written.")
    return url


def invite(url):
    """A join code in the Model's name, for the trial's first tipper (nobody can invite before an admin)."""
    with psycopg.connect(url, prepare_threshold=None) as conn, conn.cursor() as cur:
        check_trial_db(cur)
        cur.execute("insert into invites (created_by, expires_at) values (%s, now() + interval '30 days') "
                    "returning code", (pub.MODEL_USER,))
        return cur.fetchone()[0]


def make_admin(url, name):
    with psycopg.connect(url, prepare_threshold=None) as conn, conn.cursor() as cur:
        check_trial_db(cur)
        cur.execute("update profiles set is_admin = true where display_name = %s and not is_model", (name,))
        return cur.rowcount


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    s = sub.add_parser("setup", help="predict the trial's rounds once")
    s.add_argument("--start", required=True, help="the trial's first day (Sydney), when Round 1 opens at 9am")
    r = sub.add_parser("reschedule", help="move the trial to a new first day")
    r.add_argument("--start", required=True)
    p = sub.add_parser("publish", help="write everything visible now to TRIAL_DB_URL")
    p.add_argument("--history", action="store_true", help="also 2021-2025 and Elo since 2009 (first publish)")
    p.add_argument("--at", help="publish as of this time (Sydney if no zone), for checking")
    p.add_argument("--dry-run", action="store_true", help="count the rows without connecting")
    sub.add_parser("invite", help="a join code for the trial's first tipper")
    a = sub.add_parser("admin", help="make a joined tipper the trial's admin")
    a.add_argument("name")
    args = parser.parse_args()

    if args.command in ("setup", "reschedule"):
        if args.command == "setup":
            times, preds = setup(args.start)
        else:
            times, preds = reschedule(args.start), load_trial()["predictions"]
        shown = times.assign(**{c: times[c].dt.tz_convert(SYDNEY).dt.strftime("%a %d %b %H:%M")
                                for c in ["opens_at", "kickoff", "results_at"]})
        print(shown.merge(preds[["match_id", "home_team", "away_team", "tip"]], on="match_id").to_string(index=False))
        return
    if args.command == "publish":
        now = pd.Timestamp(args.at) if args.at else pd.Timestamp.now(tz="UTC")
        now = now.tz_localize(SYDNEY) if now.tzinfo is None else now
        odds = load_odds()
        tables = visible(load_trial(), now, odds)
        if args.history:
            tables = with_history(tables, history(odds))
        if args.dry_run:
            print({t: len(rows) for t, rows in tables.items()})
            return
        try:
            print(f"trial publish at {now}: {publish_trial(tables, trial_url())}")
        except psycopg.Error as ex:
            print(f"trial publish FAILED: {type(ex).__name__}: {str(ex).splitlines()[0] if str(ex) else ''}",
                  file=sys.stderr)
            sys.exit(1)
        return
    if args.command == "invite":
        print(f"invite code: {invite(trial_url())}  (join at <trial site>/join/<code>)")
        return
    if args.command == "admin":
        n = make_admin(trial_url(), args.name)
        print(f"{n} profile(s) made admin" if n else f"no tipper called {args.name!r} has joined yet")


if __name__ == "__main__":
    main()
