"""
Tests for the LLM-written previews and recaps (pipeline/summaries.py) with a fake Claude client, so
they run without a key: what's asked for, what goes into a prompt, writing each text once, and what
happens when Claude declines.
"""

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))

import summaries  # noqa: E402
from common import Records, load_matches  # noqa: E402

T = lambda s: pd.Timestamp(s, tz="UTC")  # noqa: E731


class FakeClient:
    """Answers like client.beta.messages.create; `stop` sets the stop reason of every reply."""

    def __init__(self, stop="end_turn"):
        self.calls, self.stop = [], stop
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **request):
        self.calls.append(request)
        return SimpleNamespace(stop_reason=self.stop,
                               content=[SimpleNamespace(type="thinking", thinking=""),
                                        SimpleNamespace(type="text", text=f"Text {len(self.calls)}.")])


@pytest.fixture
def records(tmp_path):
    """Round 10 of 2026: three games predicted, two of them graded."""
    rec = Records(2026, replay=False, root=tmp_path)
    m = load_matches()
    games = m[(m["season"] == 2026) & (m["round"] == 10)].head(3)
    preds = pd.DataFrame({
        "run_id": "tue", "created_at": T("2026-05-05 07:15"), "match_id": games["match_id"].to_numpy(),
        "season": 2026, "round": 10, "start_time_utc": pd.to_datetime(games["start_time_utc"], utc=True).to_numpy(),
        "home_team": games["home_team"].to_numpy(), "away_team": games["away_team"].to_numpy(),
        "home_win_prob": [0.7, 0.4, 0.55], "margin": [8.0, -3.0, 1.5], "total": [40.0, 42.0, 38.0],
        "home_score": [24, 20, 20], "away_score": [16, 23, 18], "model": "with odds",
        "no_odds_home_win_prob": 0.6, "market_open_home_prob": [0.65, 0.5, 0.52], "model_version": "2026.1",
        "inputs": "x"})
    rec.add_predictions(preds)
    return rec, games


def test_previews_are_written_once_per_coming_game(records):
    rec, games = records
    client = FakeClient()
    before_kickoff = pd.to_datetime(games["start_time_utc"], utc=True).min() - pd.Timedelta(days=1)
    written = summaries.previews(rec, client, before_kickoff)
    assert [w["match_id"] for w in written] == list(games.sort_values("start_time_utc")["match_id"])
    assert all(w["llm_model"] == "claude-opus-5-5" and w["prompt_version"] == summaries.PROMPT_VERSION for w in written)
    assert summaries.previews(rec, client, before_kickoff) == []  # already written
    assert len(client.calls) == 3

    request = client.calls[0]
    assert request["model"] == "claude-opus-5-5" and request["fallbacks"] == "default"
    assert request["betas"] == ["server-side-fallback-2026-07-01"]
    facts = json.loads(request["messages"][0]["content"].split("\n\n", 1)[1])
    first = games.sort_values("start_time_utc").iloc[0]
    assert facts["game"].startswith(first["home_team"]) and len(facts["last_meetings"]) <= 3
    assert all(len(v) == 5 for v in facts["form_last_5"].values())


def test_games_already_started_get_no_preview(records):
    rec, games = records
    after = pd.to_datetime(games["start_time_utc"], utc=True).max() + pd.Timedelta(hours=1)
    assert summaries.previews(rec, FakeClient(), after) == []


def test_a_declined_preview_is_left_for_the_next_run(records):
    rec, games = records
    before = pd.to_datetime(games["start_time_utc"], utc=True).min() - pd.Timedelta(days=1)
    assert summaries.previews(rec, FakeClient(stop="refusal"), before) == []
    assert len(summaries.previews(rec, FakeClient(), before)) == 3


def test_a_recap_waits_for_the_whole_round(records):
    from grade import grade, prediction_of_record
    rec, games = records
    graded = grade(prediction_of_record(rec.predictions()))
    rec.write_graded(graded.iloc[:2])
    assert summaries.recap(rec, FakeClient(), T("2026-05-12")) == []  # one game still to grade
    rec.write_graded(graded)
    client = FakeClient()
    written = summaries.recap(rec, client, T("2026-05-12"))
    assert [(w["kind"], w["round"], w["match_id"]) for w in written] == [("round_recap", 10, None)]
    facts = json.loads(client.calls[0]["messages"][0]["content"].split("\n\n", 1)[1])
    assert facts["model_tips_correct"] == f"{int(graded['tip_correct'].sum())}/3" and len(facts["games"]) == 3
    assert summaries.recap(rec, client, T("2026-05-13")) == []  # once per round
