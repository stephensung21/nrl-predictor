"""
Replay the weekly schedule over a finished season, as a test of the whole pipeline (Next steps A1).

Runs every job at its scheduled time (Sydney): results Monday 10:15, predict Tuesday 17:15, refresh
Wednesday to Sunday at 09:15 and 15:15, from the Tuesday before the first round to the Monday after
the last. Records go to data/pipeline/replay/<season>/, cleared first.

With --check, each Tuesday's predictions are compared with `predict.py --replay` for that round, and
the run fails on any difference.

Usage:
    python pipeline/replay.py --season 2026 --rounds 1 10 --check
"""

import argparse
import shutil
import warnings

import numpy as np
import pandas as pd

from common import Records, load_matches
import predict
from run import SYDNEY, run_job

SCHEDULE = {0: [("results", "10:15")], 1: [("predict", "17:15")],
            **{d: [("refresh", "09:15"), ("refresh", "15:15")] for d in range(2, 7)}}


def schedule(season, first, last):
    """Every scheduled job time from the Tuesday before `first` kicks off to the Monday after `last` ends."""
    m = load_matches()
    m = m[(m["season"] == season) & m["round"].between(first, last)]
    kickoff = pd.to_datetime(m["start_time_utc"], utc=True).dt.tz_convert(SYDNEY)
    start = kickoff.min().normalize() - pd.Timedelta(days=(kickoff.min().weekday() - 1) % 7 or 7)
    end = kickoff.max().normalize() + pd.Timedelta(days=(0 - kickoff.max().weekday()) % 7 or 7)
    for day in pd.date_range(start, end, freq="D"):
        for job, hhmm in SCHEDULE[day.weekday()]:
            yield job, day + pd.Timedelta(hhmm + ":00")


def check(out, season, rnd):
    """The pipeline's predictions for a round match `predict.py --replay` exactly."""
    fixtures, lists = predict.replay_round(season, rnd)
    ref, _, _, _ = predict.predict_fixtures(fixtures, lists, predict.load_bundle(season), keep_weather=True)
    cols = ["match_id", "home_win_prob", "margin", "total", "no_odds_home_win_prob", "home_score", "away_score"]
    mine = out[out["round"] == rnd][cols].sort_values("match_id").reset_index(drop=True)
    ref = ref[cols].sort_values("match_id").reset_index(drop=True)
    if len(mine) != len(ref) or not np.allclose(mine.to_numpy(float), ref.to_numpy(float), atol=1e-9):
        raise SystemExit(f"round {rnd}: pipeline and predict.py --replay differ\n{mine}\n{ref}")
    print(f"  check: round {rnd} matches predict.py --replay ({len(ref)} games)")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--rounds", type=int, nargs=2, metavar=("FIRST", "LAST"), required=True)
    parser.add_argument("--check", action="store_true", help="compare each Tuesday run with predict.py --replay")
    args = parser.parse_args()
    warnings.filterwarnings("ignore")

    records = Records(args.season, replay=True)
    shutil.rmtree(records.dir)
    records = Records(args.season, replay=True)
    checked = set()
    for job, when in schedule(args.season, *args.rounds):
        print(f"\n== {job} {when:%a %d %b %H:%M}")
        run = run_job(job, args.season, as_of=when, records=records)
        # A round's first predict run is the equivalent of predict.py --replay; later ones cover what's left.
        if args.check and job == "predict" and run["status"] == "ok" and run["round"] not in checked:
            checked.add(run["round"])
            preds = records.predictions()
            check(preds[preds["run_id"] == run["id"]], args.season, run["round"])
    runs = pd.DataFrame(records.runs())
    print("\n" + runs.groupby(["job", "status"]).size().to_string())
    print(f"records in {records.dir}")


if __name__ == "__main__":
    main()
