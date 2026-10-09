"""
Predict a round of NRL games with the frozen models (item 24; see PLAN_WEB.md).

The models are fitted once before the season (`python src/train.py --freeze`) and loaded here; only
the features are rebuilt, from every result before the round and each game's current team list.
That is the backtest's procedure applied to games not yet played, and predicting from the Tuesday
list was tested in item 40.

Two modes:
- live: fetch the round's fixtures and current team lists from nrl.com (each fetch is saved in
  data/raw/teamlists_live/, so every version of a list is kept);
- replay: re-predict a past round as it would have been on its Tuesday, hiding every result from
  the round's first kickoff on and using the archived pre-kickoff lists (teamlists.py). This tests
  the whole path on real data.

Opening odds come from the odds sheet when it has the game (the with-odds models need them);
games without odds get the no-odds models' prediction only. Ground conditions are unknown before
the day, so the wet-conditions flag is 0 in live mode (replays keep the recorded conditions so
they can be checked against the backtest; pass --no-weather to blank them).

Usage:
    python src/predict.py --season 2027 --round 1              # live
    python src/predict.py --replay --season 2026 --round 10    # replay a past round
Writes reports/predictions/<season>_round<round>.csv and .md, and a run record (.json).
"""

import argparse
import json
import subprocess
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

import config
from elo import load_params
from features import PRE_KICKOFF_FILE, build_features, load_inputs, named_from_list
from ingest import join_odds_to_matches
from models import predict_models
from reports import md_table

OUT = config.REPORTS / "predictions"
LIVE_LISTS = config.ROOT / "data" / "raw" / "teamlists_live"
CLOSING_COLS = ["p_close", "close_line", "close_total", "p_avg", "p_close_shin", "p_avg_shin",
                "home_odds_close", "away_odds_close", "home_line_odds_close", "away_line_odds_close",
                "over_odds_close", "under_odds_close"]
RESULT_COLS = ["home_score", "away_score", "home_ht_score", "away_ht_score", "attendance", "game_seconds"]


# ---------------------------------------------------------------- fixtures and team lists

def live_round(season, rnd):
    """Fixtures and current team lists for one round from nrl.com, saved as a timestamped snapshot."""
    import scrape
    draw = scrape.get_q_data(f"https://www.nrl.com/draw/?competition={scrape.COMPETITION_ID}&round={rnd}"
                             f"&season={season}", "vue-draw")
    fixtures, rows = [], []
    fetched = pd.Timestamp.now(tz="UTC")
    for fx in [f for f in (draw or {}).get("fixtures", []) if f.get("type") == "Match"]:
        data = scrape.get_q_data(scrape.match_url(fx["matchCentreUrl"]), "vue-match-centre")
        m = (data or {}).get("match")
        if not m:
            print(f"  no match data: {fx['matchCentreUrl']}")
            continue
        title = m.get("roundTitle", "")
        fixtures.append({"match_id": int(m["matchId"]), "season": season, "round": m.get("roundNumber"),
                         "round_title": title, "is_final": not title.lower().startswith("round"),
                         "start_time_utc": m.get("startTime"), "venue": m.get("venue"),
                         "venue_city": m.get("venueCity"), "home_team": m["homeTeam"]["nickName"],
                         "away_team": m["awayTeam"]["nickName"], "match_state": m.get("matchState"),
                         "url": m.get("url")})
        for side in ("homeTeam", "awayTeam"):
            for p in m[side].get("players", []):
                rows.append({"match_id": int(m["matchId"]), "season": season, "team": m[side]["nickName"],
                             "player_id": p["playerId"], "player_name": f"{p['firstName']} {p['lastName']}",
                             "jersey_number": p["number"], "position": p["position"],
                             "list_updated_utc": m.get("updated"), "fetched_utc": fetched})
    fixtures, lists = pd.DataFrame(fixtures), pd.DataFrame(rows)
    snap = LIVE_LISTS / str(season) / f"round-{rnd}"
    snap.mkdir(parents=True, exist_ok=True)
    lists.to_csv(snap / f"{fetched:%Y%m%dT%H%M%SZ}.csv", index=False)
    return fixtures, lists


def replay_round(season, rnd):
    """A past round's fixtures (from matches.csv) and its archived pre-kickoff lists."""
    matches = pd.read_csv(config.PROCESSED / "matches.csv")
    fixtures = matches[(matches["season"] == season) & (matches["round"] == rnd)].copy()
    if fixtures.empty:
        raise SystemExit(f"No games found for {season} round {rnd}.")
    lists = pd.read_csv(PRE_KICKOFF_FILE)
    return fixtures, lists[lists["match_id"].isin(fixtures["match_id"])]


def named_17(lists):
    """The named 17 (features.named_from_list: the 17 lowest-numbered players who aren't reserves)."""
    return named_from_list(lists)


# ---------------------------------------------------------------- inputs as of the round

def inputs_before(fixtures, keep_weather):
    """Every input as it stood before the round's first kickoff: later games are removed, and the
    round's own games keep only what is known in advance (draw, venue, opening odds)."""
    matches, team_stats, players, odds, origin, reserve = load_inputs()
    fx = fixtures.copy()
    fx["start_time_utc"] = pd.to_datetime(fx["start_time_utc"], utc=True)
    first = fx["start_time_utc"].min()
    ids = set(fx["match_id"])

    kickoff = pd.to_datetime(matches["start_time_utc"], utc=True)
    earlier = set(matches.loc[kickoff < first, "match_id"]) - ids
    matches = matches[matches["match_id"].isin(earlier)]
    new = fx.reindex(columns=matches.columns)
    new["start_time_utc"] = fx["start_time_utc"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    if not keep_weather:
        new[["ground_conditions", "weather"]] = np.nan
    new[RESULT_COLS] = np.nan
    matches = pd.concat([matches, new], ignore_index=True)

    team_stats = team_stats[team_stats["match_id"].isin(earlier)]
    placeholder = pd.concat([pd.DataFrame({"match_id": fx["match_id"], "season": fx["season"], "round": fx["round"],
                                           "team": fx[team], "opponent": fx[opp], "is_home": team == "home_team"})
                             for team, opp in (("home_team", "away_team"), ("away_team", "home_team"))])
    team_stats = pd.concat([team_stats, placeholder.reindex(columns=team_stats.columns)], ignore_index=True)
    players = players[players["match_id"].isin(earlier)]
    origin = origin[pd.to_datetime(origin["start_time_utc"], utc=True) < first]

    # Odds: earlier games as recorded; the round's games keep only their opening prices.
    joined = join_odds_to_matches(fx[["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    round_odds = set(joined["odds_id"].dropna().astype(int))
    first_local = first.tz_convert("Australia/Sydney").tz_localize(None).normalize()
    played = join_odds_to_matches(matches.loc[matches["match_id"].isin(earlier),
                                              ["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    played_odds = set(played["odds_id"].dropna().astype(int))  # incl. this round's games already played
    odds = odds[(odds["date"] < first_local) | odds["odds_id"].isin(round_odds | played_odds)].copy()
    in_round = odds["odds_id"].isin(round_odds)
    odds.loc[in_round, ["home_score", "away_score"]] = np.nan
    odds.loc[in_round, [c for c in CLOSING_COLS if c in odds.columns]] = np.nan
    odds.loc[in_round, "close_ok"] = False
    missing = fx[~fx["match_id"].isin(joined.loc[joined["odds_id"].notna(), "match_id"])]
    if len(missing):  # games the odds sheet doesn't have yet: no prices, venue flags from the draw
        local = missing["start_time_utc"].dt.tz_convert("Australia/Sydney").dt.tz_localize(None).dt.normalize()
        extra = pd.DataFrame({"date": local.to_numpy(), "home_team": missing["home_team"].to_numpy(),
                              "away_team": missing["away_team"].to_numpy(), "season": missing["season"].to_numpy(),
                              "is_final": missing["is_final"].astype(bool).to_numpy(), "notes": "",
                              "home_at_ground": True, "away_at_ground": False, "neutral": False,
                              "bookmaker": "BlueBet", "close_ok": False, "data_issue": False,
                              "kickoff_local": ""})
        extra["odds_id"] = np.arange(len(extra)) + odds["odds_id"].max() + 1
        odds = pd.concat([odds, extra.reindex(columns=odds.columns)], ignore_index=True)
        print(f"  no odds yet for {len(missing)} game(s): no-odds prediction only")
    odds = odds.sort_values(["date", "kickoff_local"]).reset_index(drop=True)
    return matches, team_stats, players, odds, origin, reserve


# ---------------------------------------------------------------- predictions

def display_scores(p_home, margin, total):
    """Whole-number scores for display that never contradict the tip (the tip comes from the win
    probability; the unrounded margin and total are stored)."""
    home, away = np.round((total + margin) / 2), np.round((total - margin) / 2)
    tip_home = p_home >= 0.5
    home = np.where(tip_home & (home <= away), away + 1, home)
    away = np.where(~tip_home & (away <= home), home + 1, away)
    return home.astype(int), away.astype(int)


def validate(out, lists, rows, bundle):
    """Checks before publishing (PLAN_WEB.md §1.4). Returns (errors, warnings)."""
    errors, warns = [], []
    # Every model input must be present: the linear models would silently fill a gap with the median.
    for variant in ("no_odds", "with_odds"):
        used = rows if variant == "no_odds" else rows[rows["open_logit"].notna()]
        inputs = sorted({f for (v, _), m in bundle["models"].items() if v == variant
                         for f in m["linear_features"] + m["lightgbm_features"]})
        gaps = used[inputs].isna().sum()
        for f, n in gaps[gaps > 0].items():
            errors.append(f"{variant} input {f} missing for {n} game(s)")
    for col in ("home_win_prob", "no_odds_home_win_prob"):
        vals = out[col].dropna()
        if ((vals <= 0) | (vals >= 1)).any():
            errors.append(f"{col} outside (0, 1)")
    if out["home_win_prob"].isna().any():
        errors.append("a game has no prediction")
    teams = pd.concat([out["home_team"], out["away_team"]])
    if teams.duplicated().any():
        errors.append(f"team(s) twice in the round: {sorted(teams[teams.duplicated()])}")
    named = named_17(lists).groupby(["match_id", "team"]).size()
    for r in out.itertuples():
        for team in (r.home_team, r.away_team):
            n = named.get((r.match_id, team), 0)
            if n != 17:
                errors.append(f"{team}: {n} players named, not 17")
    disagree = out[(out["home_win_prob"] >= 0.5) != (out["margin"] > 0)]
    for r in disagree.itertuples():
        warns.append(f"{r.home_team} v {r.away_team}: win probability and margin point different ways "
                     f"({r.home_win_prob:.2f}, {r.margin:+.1f})")
    return errors, warns


def git_commit():
    run = lambda *a: subprocess.run(["git", *a], capture_output=True, text=True, cwd=config.ROOT).stdout.strip()
    return run("rev-parse", "HEAD"), bool(run("status", "--porcelain", "--untracked-files=no"))


def predict_round(season, rnd, replay=False, keep_weather=None, model_season=None):
    warnings.filterwarnings("ignore")
    model_dir = config.MODELS_DIR / str(model_season or season)
    if not (model_dir / "bundle.joblib").exists():
        raise SystemExit(f"No frozen models in {model_dir}: run `python src/train.py --freeze {model_season or season}`.")
    bundle = joblib.load(model_dir / "bundle.joblib")
    fixtures, lists = replay_round(season, rnd) if replay else live_round(season, rnd)
    keep_weather = replay if keep_weather is None else keep_weather

    # Only games with a full named 17 for both teams can be predicted.
    named = named_17(lists)
    full = named.groupby(["match_id", "team"]).size().eq(17).groupby(level=0).sum().eq(2)
    ready = fixtures[fixtures["match_id"].isin(full[full].index)]
    if ready.empty:
        raise SystemExit("No games in this round have both team lists yet.")
    for r in fixtures[~fixtures["match_id"].isin(ready["match_id"])].itertuples():
        print(f"  skipped {r.home_team} v {r.away_team}: team lists not available")

    matches, team_stats, players, odds, origin, reserve = inputs_before(ready, keep_weather)
    feats = build_features(matches, team_stats, players, odds, origin, elo_params=load_params(odds),
                           reserve=reserve, pre_kickoff=lists[lists["match_id"].isin(ready["match_id"])])
    rows = feats[feats["match_id"].isin(ready["match_id"])].set_index("match_id").loc[ready["match_id"]]

    has_odds = rows["open_logit"].notna()
    preds = predict_models(bundle, rows, variants=["no_odds"])
    if has_odds.any():
        preds = preds.join(predict_models(bundle, rows[has_odds], variants=["with_odds"]))
    model = config.MAIN_MODEL
    main = {t: preds.get(f"with_odds|{model}|{t}", pd.Series(np.nan, index=rows.index))
            .fillna(preds[f"no_odds|{model}|{t}"]) for t in config.TARGETS}
    out = pd.DataFrame({
        "match_id": rows.index, "season": season, "round": rnd,
        "kickoff_sydney": pd.to_datetime(rows["start_time_utc"], utc=True).dt.tz_convert("Australia/Sydney")
        .dt.strftime("%a %d %b %H:%M").to_numpy(),
        "home_team": rows["home_team"].to_numpy(), "away_team": rows["away_team"].to_numpy(),
        "home_win_prob": main["home_win"].to_numpy(), "margin": main["margin"].to_numpy(),
        "total": main["total"].to_numpy(),
        "model": np.where(has_odds, "with odds", "no odds"),
        "no_odds_home_win_prob": preds[f"no_odds|{model}|home_win"].to_numpy(),
        "market_open_home_prob": rows["p_open"].to_numpy(),
    }).reset_index(drop=True)
    out["tip"] = np.where(out["home_win_prob"] >= 0.5, out["home_team"], out["away_team"])
    out["home_score"], out["away_score"] = display_scores(out["home_win_prob"].to_numpy(), out["margin"].to_numpy(),
                                                          out["total"].to_numpy())
    errors, warns = validate(out, lists, rows, bundle)
    for w in warns:
        print(f"  warning: {w}")

    commit, dirty = git_commit()
    stem = f"{season}_round{rnd}" + ("_replay" if replay else "")
    record = {"run_at": f"{pd.Timestamp.now(tz='UTC'):%Y-%m-%d %H:%M} UTC", "season": season, "round": rnd,
              "mode": "replay" if replay else "live", "model_version": bundle.get("version"),
              "model_trained_on": bundle.get("trained_on"), "commit": commit, "uncommitted_changes": dirty,
              "keep_weather": keep_weather, "games": int(len(out)), "with_odds_games": int(has_odds.sum()),
              "errors": errors, "warnings": warns}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{stem}.json").write_text(json.dumps(record, indent=2))
    if errors:
        for e in errors:
            print(f"  ERROR: {e}")
        raise SystemExit(f"Validation failed; nothing published (see reports/predictions/{stem}.json).")
    out.to_csv(OUT / f"{stem}.csv", index=False)
    table = pd.DataFrame({
        "kickoff": out["kickoff_sydney"], "game": out["home_team"] + " v " + out["away_team"],
        "tip": out["tip"], "win %": (np.maximum(out["home_win_prob"], 1 - out["home_win_prob"]) * 100).round(0),
        "predicted score": out["home_score"].astype(str) + "-" + out["away_score"].astype(str),
        "margin": out["margin"].round(1), "total": out["total"].round(1),
        "market (home %)": (out["market_open_home_prob"] * 100).round(0), "model": out["model"]})
    md = [f"# Predictions: {season} round {rnd}" + (" (replay)" if replay else ""), "",
          f"Model {bundle.get('version')} (trained on {bundle['trained_on']['seasons'][0]}-"
          f"{bundle['trained_on']['seasons'][-1]}), commit `{commit[:7]}`. Win % is for the tipped team; "
          "the market column is the opening price's home-win probability.", "",
          md_table(table.set_index("kickoff")), ""]
    (OUT / f"{stem}.md").write_text("\n".join(md), encoding="utf-8")
    print(table.to_string(index=False))
    print(f"wrote reports/predictions/{stem}.csv")
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", type=int, default=config.PREDICT_SEASON)
    parser.add_argument("--round", type=int, required=True)
    parser.add_argument("--replay", action="store_true", help="re-predict a past round from archived lists")
    parser.add_argument("--no-weather", action="store_true", help="replay without the recorded ground conditions")
    parser.add_argument("--models", type=int, help="model season to load (default: --season)")
    args = parser.parse_args()
    predict_round(args.season, args.round, args.replay, keep_weather=False if args.no_weather else None,
                  model_season=args.models)


if __name__ == "__main__":
    main()
