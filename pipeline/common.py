"""
Shared pieces for the weekly pipeline: paths, the model code in src/, and the pipeline's own records.

Every run is recorded, and every prediction it made is kept (not overwritten), with when it was
made; so is every odds snapshot (fetch_odds.py). Grading needs the full history: a game's prediction of record is the latest one made before
its kickoff. Live records go in data/pipeline/live/<season>/ and are committed by the results job;
replays of past seasons go in data/pipeline/replay/<season>/ (ignored by git, regenerable).
"""

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import config  # noqa: E402,F401  (the model code, imported here once for every pipeline module)
from ingest import PROCESSED  # noqa: E402

RECORDS = ROOT / "data" / "pipeline"
FIXTURE_COLS = ["match_id", "season", "round", "round_title", "is_final", "start_time_utc", "venue", "venue_city",
                "home_team", "away_team", "neutral", "url"]
PREDICTION_COLS = ["run_id", "created_at", "match_id", "season", "round", "start_time_utc", "home_team",
                   "away_team", "home_win_prob", "margin", "total", "home_score", "away_score", "model",
                   "no_odds_home_win_prob", "market_open_home_prob", "model_version", "inputs"]


def load_matches():
    return pd.read_csv(PROCESSED / "matches.csv", low_memory=False)


class Records:
    """The run log, every prediction made, and the graded season record for one season."""

    def __init__(self, season, replay, root=RECORDS):
        self.dir = root / ("replay" if replay else "live") / str(season)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.runs_file = self.dir / "runs.jsonl"
        self.predictions_file = self.dir / "predictions.csv"
        self.graded_file = self.dir / "graded.csv"
        self.odds_file = self.dir / "odds_snapshots.csv"
        self.fixtures_file = self.dir / "fixtures.csv"

    def add_run(self, record):
        with self.runs_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")

    def runs(self):
        if not self.runs_file.exists():
            return []
        return [json.loads(line) for line in self.runs_file.read_text(encoding="utf-8").splitlines() if line]

    def predictions(self):
        if not self.predictions_file.exists():
            return pd.DataFrame(columns=PREDICTION_COLS)
        # Ids, hashes and versions stay text ("2026.1" isn't a number; a hex hash can look like one).
        p = pd.read_csv(self.predictions_file, dtype={"run_id": str, "model_version": str, "inputs": str})
        for col in ("created_at", "start_time_utc"):
            p[col] = pd.to_datetime(p[col], utc=True)
        return p

    def add_predictions(self, preds):
        preds = preds[PREDICTION_COLS]
        preds.to_csv(self.predictions_file, mode="a", header=not self.predictions_file.exists(), index=False)

    def graded(self):
        return pd.read_csv(self.graded_file) if self.graded_file.exists() else None

    def write_graded(self, graded):
        graded.to_csv(self.graded_file, index=False)

    def odds_snapshots(self):
        """Every price fetched from The Odds API this season (fetch_odds.py), or None before the first."""
        if not self.odds_file.exists():
            return None
        return pd.read_csv(self.odds_file, dtype={"event_id": str, "issues": str}, keep_default_na=True)

    def add_odds_snapshots(self, snaps):
        snaps.to_csv(self.odds_file, mode="a", header=not self.odds_file.exists(), index=False)

    def fixtures(self):
        """The games the predict and refresh jobs have seen, with their nrl.com match ids (the draw
        doesn't give them), so they can be published before they're played. Latest version of each."""
        if not self.fixtures_file.exists():
            return pd.DataFrame(columns=FIXTURE_COLS)
        return pd.read_csv(self.fixtures_file)

    def update_fixtures(self, fixtures):
        new = fixtures.reindex(columns=FIXTURE_COLS)
        both = pd.concat([self.fixtures(), new], ignore_index=True)
        both.drop_duplicates("match_id", keep="last").sort_values(["start_time_utc", "match_id"])             .to_csv(self.fixtures_file, index=False)
