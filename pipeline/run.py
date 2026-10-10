"""
The weekly pipeline (PLAN_WEB.md §1.1-1.2, Next steps A): three jobs, each safe to re-run.

- results (Monday): scrape the current season's finished games into the processed tables, then grade
  every finished game that has a prediction of record and write the season report.
- predict (Tuesday, after team lists): work out which games are next (`draw.games_to_predict`),
  fetch their team lists, predict with the frozen models, validate, and record the predictions.
- refresh (Wednesday to Sunday): the same, but only for games whose inputs changed since their last
  prediction (team list or opening price), or that have no prediction yet.

Nothing is published to the website yet (that is `publish.py`, after the database exists): runs and
predictions are recorded in data/pipeline/ (see common.Records).

Replays: `--as-of` runs a job on a past season as it would have run at that moment. The draw's status
comes from the clock, team lists are the archived pre-kickoff lists, and results after the clock are
hidden, so the 2026 season can stand in for a live one.

Usage:
    python pipeline/run.py --job predict                          # live, the current season
    python pipeline/run.py --job results
    python pipeline/run.py --job predict --season 2026 --as-of "2026-05-05 17:15"   # replay (Sydney time)
"""

import argparse
import hashlib
import sys
import traceback
import uuid
import warnings

import numpy as np
import pandas as pd

from common import Records, load_matches
import config
import draw as drawlib
import grade as gradelib
import predict
from features import PRE_KICKOFF_FILE
from ingest import join_odds_to_matches, load_odds

SYDNEY = "Australia/Sydney"


class NothingToDo(Exception):
    """The job had nothing to do: not a failure."""


def utc(ts):
    """A timestamp in UTC; naive times are read as Sydney time."""
    ts = pd.Timestamp(ts)
    return (ts.tz_localize(SYDNEY) if ts.tzinfo is None else ts).tz_convert("UTC")


# ---------------------------------------------------------------- inputs for the games to predict

def lists_for(games, season, rnd, replay):
    """Fixtures (with match ids) and team lists for the games: fetched now, or the archive in a replay."""
    if replay:
        fixtures = load_matches()
        fixtures = fixtures[fixtures["match_id"].isin(games["match_id"])]
        lists = pd.read_csv(PRE_KICKOFF_FILE)
        return fixtures, lists[lists["match_id"].isin(fixtures["match_id"])]
    return predict.fetch_lists(season, list(games["url"]), snapshot=f"round-{rnd}")


def fingerprints(fixtures, lists, neutral, odds):
    """What a prediction depends on that can change during the week, per game: both named 17s (player
    and jersey), the opening prices and the venue flag. A refresh re-predicts a game when this changes."""
    named = predict.named_17(lists).sort_values(["match_id", "team", "jersey_number", "player_id"])
    squads = named.groupby("match_id").apply(
        lambda d: ";".join(f"{t}:{j}:{p}" for t, j, p in zip(d["team"], d["jersey_number"], d["player_id"])))
    joined = join_odds_to_matches(fixtures[["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    prices = joined.merge(odds[["odds_id", "p_open", "open_line", "open_total"]], on="odds_id", how="left")
    prices = prices.set_index("match_id")[["p_open", "open_line", "open_total"]].round(6).astype(str).agg("|".join, axis=1)
    out = {}
    for mid in fixtures["match_id"]:
        text = f"{squads.get(mid, '')}#{prices.get(mid, '')}#{int(mid in neutral)}"
        out[mid] = hashlib.sha1(text.encode()).hexdigest()[:12]
    return pd.Series(out, name="inputs")


# ---------------------------------------------------------------- jobs

def predict_job(season, now, replay, records, refresh, run, model_season):
    draw = drawlib.replay_draw(season, now) if replay else drawlib.live_draw(season)
    rnd, games = drawlib.games_to_predict(draw, now)
    if rnd is None:
        raise NothingToDo("no games left to predict this season")
    run["round"] = rnd
    fixtures, lists = lists_for(games, season, rnd, replay)
    # Games not scraped yet get their match id from the match centre, keyed by the draw's link.
    ids = dict(zip(fixtures["url"].str.replace("https://www.nrl.com", "", regex=False), fixtures["match_id"]))
    neutral = drawlib.neutral_games(draw.assign(match_id=draw["match_id"].fillna(draw["url"].map(ids))))
    bundle = predict.load_bundle(model_season)
    run["model_version"] = bundle.get("version")
    inputs = fingerprints(fixtures, lists, neutral, load_odds())

    if refresh:
        last = records.predictions()
        last = last[last["model_version"] == bundle.get("version")].sort_values("created_at").groupby("match_id").tail(1)
        same = fixtures["match_id"].map(last.set_index("match_id")["inputs"]).eq(fixtures["match_id"].map(inputs))
        fixtures = fixtures[~same.to_numpy()]
        if fixtures.empty:
            raise NothingToDo(f"round {rnd}: no team list or price changes")

    try:
        out, rows, errors, warns = predict.predict_fixtures(fixtures, lists, bundle, keep_weather=replay,
                                                            neutral=neutral)
    except SystemExit as stop:  # no game has both team lists yet
        raise NothingToDo(f"round {rnd}: {stop}")
    run.update(games=int(len(out)), with_odds_games=int(rows["open_logit"].notna().sum()), errors=errors,
               warnings=warns)
    if errors:
        raise RuntimeError("validation failed; nothing recorded: " + "; ".join(errors))
    out["run_id"], out["created_at"], out["model_version"] = run["id"], now, bundle.get("version")
    out["start_time_utc"] = pd.to_datetime(rows["start_time_utc"], utc=True).to_numpy()
    out["inputs"] = out["match_id"].map(inputs)
    records.add_predictions(out)
    print(out[["round", "home_team", "away_team", "tip", "home_win_prob", "margin", "total", "model"]]
          .to_string(index=False))
    return out


def results_job(season, now, replay, records, run):
    if not replay:
        import scrape
        scrape.fetch_season(season)  # only fetches games not already cached
        scrape.fetch_origin(season)
        scrape.build_tables([season], merge=True)
        scrape.build_origin_table([season], merge=True)
    matches = load_matches()
    kickoff = pd.to_datetime(matches["start_time_utc"], utc=True)
    finished = matches[(matches["season"] == season) & (kickoff + drawlib.KICKOFF_TO_FINAL <= now)]
    record = gradelib.prediction_of_record(records.predictions())
    record = record[record["match_id"].isin(finished["match_id"])]
    if record.empty:
        raise NothingToDo("no finished games with a prediction of record")
    graded = gradelib.grade(record, finished)
    records.write_graded(graded)
    (records.dir / "season.md").write_text(gradelib.season_report(graded, season, "replay" if replay else "live"),
                                           encoding="utf-8")
    run["games"] = int(len(graded))
    print(gradelib.metrics(graded).round(4).to_string())
    return graded


def run_job(job, season, as_of=None, model_season=None, records=None):
    """Run one job and record it. Returns the run record; raises if the job failed."""
    warnings.filterwarnings("ignore")
    replay = as_of is not None
    now = utc(as_of) if replay else pd.Timestamp.now(tz="UTC")
    records = records or Records(season, replay)
    commit, dirty = predict.git_commit()
    run = {"id": uuid.uuid4().hex[:12], "job": job, "season": season, "mode": "replay" if replay else "live",
           "as_of": now.isoformat(), "started": pd.Timestamp.now(tz="UTC").isoformat(), "commit": commit,
           "uncommitted_changes": dirty, "status": "ok"}
    try:
        if job == "results":
            results_job(season, now, replay, records, run)
        else:
            model_season = model_season or (season if replay else config.PREDICT_SEASON)
            predict_job(season, now, replay, records, job == "refresh", run, model_season)
    except NothingToDo as quiet:
        run.update(status="nothing to do", notes=str(quiet))
        print(f"{job}: nothing to do ({quiet})")
    except BaseException as ex:
        run.update(status="failed", notes=str(ex) or type(ex).__name__, trace=traceback.format_exc(limit=5))
        raise
    finally:
        run["finished"] = pd.Timestamp.now(tz="UTC").isoformat()
        records.add_run(run)
    return run


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--job", choices=["results", "predict", "refresh"], required=True)
    parser.add_argument("--season", type=int, default=config.PREDICT_SEASON)
    parser.add_argument("--as-of", help="replay the job at this time (Sydney time unless a zone is given)")
    parser.add_argument("--models", type=int, help="model season to load (default: the season)")
    args = parser.parse_args()
    try:
        run_job(args.job, args.season, args.as_of, args.models)
    except Exception as ex:
        print(f"{args.job} FAILED: {ex}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
