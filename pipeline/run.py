"""
The weekly pipeline (PLAN_WEB.md §1.1-1.2, Next steps A): three jobs, each safe to re-run.

Every live job first fetches Betr's prices from The Odds API (fetch_odds.py), so the first price of
each game is caught early in the week; a game's first snapshot is its opening price when the odds
sheet doesn't have it. A failed fetch is a warning in the run record, not a failed job: games
without a price get the no-odds prediction. `--job odds` runs the fetch on its own, on Sunday night
(after the round's last game, when the next round's markets open) so opening prices are caught early.

- results (Monday): scrape the current season's finished games into the processed tables, then grade
  every finished game that has a prediction of record and write the season report, and the paper
  trading record at live prices (paper.py).
- predict (Tuesday, after team lists): work out which games are next (`draw.games_to_predict`),
  fetch their team lists, draw the round's margin game if it hasn't been drawn (`margin_game`),
  predict with the frozen models, validate, and record the predictions.
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
    python pipeline/run.py --job odds                             # fetch Betr's prices only
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
import fetch_odds
import fetch_sheet
import grade as gradelib
import paper
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


def fingerprints(fixtures, lists, neutral, odds, live_odds=None):
    """What a prediction depends on that can change during the week, per game: both named 17s (player
    and jersey), the opening prices (the sheet's, else the live ones, as predict.inputs_before) and the
    venue flag. A refresh re-predicts a game when this changes, e.g. when its first live price arrives."""
    named = predict.named_17(lists).sort_values(["match_id", "team", "jersey_number", "player_id"])
    squads = named.groupby("match_id").apply(
        lambda d: ";".join(f"{t}:{j}:{p}" for t, j, p in zip(d["team"], d["jersey_number"], d["player_id"])))
    joined = join_odds_to_matches(fixtures[["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    prices = joined.merge(odds[["odds_id", *predict.LIVE_ODDS_COLS]], on="odds_id", how="left").set_index("match_id")
    prices = prices[predict.LIVE_ODDS_COLS]
    if live_odds is not None and len(live_odds):
        unpriced = prices["p_open"].isna() & prices.index.isin(live_odds.index)
        prices.loc[unpriced] = live_odds.loc[prices.index[unpriced], predict.LIVE_ODDS_COLS].to_numpy(float)
    prices = prices.round(6).astype(str).agg("|".join, axis=1)
    out = {}
    for mid in fixtures["match_id"]:
        text = f"{squads.get(mid, '')}#{prices.get(mid, '')}#{int(mid in neutral)}"
        out[mid] = hashlib.sha1(text.encode()).hexdigest()[:12]
    return pd.Series(out, name="inputs")


def margin_game(records, season, rnd, fixtures, now, run_id, rng=None):
    """The round's margin game for the tipping comp, drawn once: by the first run that has the
    round's fixtures, before any of them kicks off, and kept after that. It can't be any game
    involving a team from the previous round's margin game (draw.draw_featured)."""
    drawn = records.rounds()
    mine = drawn[(drawn["season"] == season) & (drawn["round"] == rnd)]
    if len(mine):
        return int(mine["featured_match"].iloc[-1])
    games = fixtures[fixtures["round"] == rnd]
    if games.empty or (pd.to_datetime(games["start_time_utc"], utc=True) <= now).any():
        return None  # nothing to draw from, or the round has started: too late to draw fairly
    before = drawn[(drawn["season"] == season) & (drawn["round"] < rnd)].sort_values("round")
    previous = tuple(before[["home_team", "away_team"]].iloc[-1]) if len(before) else None
    pick, eligible = drawlib.draw_featured(games, previous, rng)
    game = games[games["match_id"] == pick].iloc[0]
    records.add_round({"season": season, "round": rnd, "featured_match": pick, "home_team": game["home_team"],
                       "away_team": game["away_team"], "drawn_at": now.isoformat(),
                       "eligible": ";".join(str(m) for m in eligible["match_id"]), "run_id": run_id})
    return pick


# ---------------------------------------------------------------- jobs

def predict_job(season, now, replay, records, refresh, run, model_season):
    draw = drawlib.replay_draw(season, now) if replay else drawlib.live_draw(season)
    if draw.empty:
        # Before the season's year the draw may not be out yet; from January it should be there, so
        # an empty one means nrl.com failed, and the run fails (and alerts) rather than skip a round.
        if now.year < season:
            raise NothingToDo(f"no {season} draw on nrl.com yet")
        raise RuntimeError(f"no {season} draw from nrl.com (site down or changed?)")
    rnd, games = drawlib.games_to_predict(draw, now)
    if rnd is None:
        raise NothingToDo("no games left to predict this season")
    run["round"] = rnd
    fixtures, lists = lists_for(games, season, rnd, replay)
    # Games not scraped yet get their match id from the match centre, keyed by the draw's link.
    ids = dict(zip(fixtures["url"].str.replace("https://www.nrl.com", "", regex=False), fixtures["match_id"]))
    neutral = drawlib.neutral_games(draw.assign(match_id=draw["match_id"].fillna(draw["url"].map(ids))))
    records.update_fixtures(fixtures.assign(neutral=fixtures["match_id"].isin(neutral)))
    run["margin_game"] = margin_game(records, season, rnd, fixtures, now, run["id"])
    bundle = predict.load_bundle(model_season)
    run["model_version"] = bundle.get("version")
    live_odds = None if replay else fetch_odds.for_fixtures(fixtures, fetch_odds.game_prices(records.odds_snapshots()))
    inputs = fingerprints(fixtures, lists, neutral, load_odds(), live_odds)

    if refresh:
        last = records.predictions()
        last = last[last["model_version"] == bundle.get("version")].sort_values("created_at").groupby("match_id").tail(1)
        same = fixtures["match_id"].map(last.set_index("match_id")["inputs"]).eq(fixtures["match_id"].map(inputs))
        fixtures = fixtures[~same.to_numpy()]
        if fixtures.empty:
            raise NothingToDo(f"round {rnd}: no team list or price changes")

    try:
        out, rows, errors, warns = predict.predict_fixtures(fixtures, lists, bundle, keep_weather=replay,
                                                            neutral=neutral, live_odds=live_odds)
    except SystemExit as stop:  # no game has both team lists yet
        raise NothingToDo(f"round {rnd}: {stop}")
    run.update(games=int(len(out)), with_odds_games=int(rows["open_logit"].notna().sum()), errors=errors,
               warnings=run.get("warnings", []) + warns)
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
        try:
            run["odds_sheet"] = fetch_sheet.update()
        except Exception as ex:  # the copy in the checkout is still used
            run["odds_sheet"] = {"status": "failed", "error": f"{type(ex).__name__}: {ex}"}
            run.setdefault("warnings", []).append(f"odds sheet download failed: {run['odds_sheet']['error']}")
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
    if not replay:  # live prices exist only for live seasons
        seen = pd.concat([matches[matches["season"] == season], records.fixtures()], ignore_index=True)
        bets = paper.write(records, season, seen.drop_duplicates("match_id", keep="last"),
                           records.odds_snapshots(), gradelib.prediction_of_record(records.predictions()))
        run["paper_bets"] = int(bets["profit"].notna().sum())
    return graded


def odds_step(records, now, run):
    """Fetch prices before a live job. A failure is recorded as a warning: the job still runs, and games
    without a price get the no-odds prediction."""
    try:
        run["odds"] = fetch_odds.record_snapshot(records, now)
    except Exception as ex:
        run["odds"] = {"status": "failed", "error": str(ex) or type(ex).__name__}
        run.setdefault("warnings", []).append(f"odds fetch failed: {run['odds']['error']}")
    for issue in run["odds"].get("issues", []):
        run.setdefault("warnings", []).append(f"impossible price dropped: {issue}")


def run_job(job, season, as_of=None, model_season=None, records=None, fail=False):
    """Run one job and record it. Returns the run record; raises if the job failed. `fail` makes it
    fail on purpose, after starting, to test the workflows' alerts (PLAN_WEB.md step 8)."""
    warnings.filterwarnings("ignore")
    replay = as_of is not None
    now = utc(as_of) if replay else pd.Timestamp.now(tz="UTC")
    records = records or Records(season, replay)
    commit, dirty = predict.git_commit()
    run = {"id": uuid.uuid4().hex[:12], "job": job, "season": season, "mode": "replay" if replay else "live",
           "as_of": now.isoformat(), "started": pd.Timestamp.now(tz="UTC").isoformat(), "commit": commit,
           "uncommitted_changes": dirty, "status": "ok"}
    try:
        if fail:
            raise RuntimeError("deliberate failure (--fail), to test alerts; nothing was predicted or published")
        if job == "odds":
            if replay:
                raise ValueError("the odds job only runs live (past prices come from the odds sheet)")
            run["odds"] = fetch_odds.record_snapshot(records, now)
            print(f"odds: {run['odds']}")
            return run
        if not replay:
            odds_step(records, now, run)
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
    parser.add_argument("--job", choices=["results", "predict", "refresh", "odds"], required=True)
    parser.add_argument("--season", type=int, default=config.PREDICT_SEASON)
    parser.add_argument("--as-of", help="replay the job at this time (Sydney time unless a zone is given)")
    parser.add_argument("--models", type=int, help="model season to load (default: the season)")
    parser.add_argument("--fail", action="store_true", help="fail on purpose, to test alerts")
    args = parser.parse_args()
    try:
        run_job(args.job, args.season, args.as_of, args.models, fail=args.fail)
    except Exception as ex:
        print(f"{args.job} FAILED: {ex}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
