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
    """Answers like client.beta.messages.create; `stop` sets the stop reason of every reply, `replies`
    the texts in turn (the last one repeats)."""

    def __init__(self, stop="end_turn", replies=("A preview.",)):
        self.calls, self.stop, self.replies = [], stop, list(replies)
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **request):
        self.calls.append(request)
        text = self.replies[min(len(self.calls), len(self.replies)) - 1]
        return SimpleNamespace(stop_reason=self.stop,
                               content=[SimpleNamespace(type="thinking", thinking=""),
                                        SimpleNamespace(type="text", text=text)])


def prompt_facts(request):
    """The facts JSON at the end of a prompt."""
    content = request["messages"][0]["content"]
    return json.loads(content[content.index("\n{") + 1:])


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
    facts = prompt_facts(request)
    first = games.sort_values("start_time_utc").iloc[0]
    assert facts["game"]["home_team"] == first["home_team"] and len(facts["form"]["last_meetings"]) <= 3
    assert all(len(v) == 5 for v in facts["form"]["last_5"].values())
    # No brief was recorded with these predictions, so one is built from the prediction record.
    assert set(facts) == {"game", "prediction", "market", "form"} and written[0]["brief_run_id"] is None


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
    facts = prompt_facts(client.calls[0])
    assert facts["model_tips_correct"] == f"{int(graded['tip_correct'].sum())}/3" and len(facts["games"]) == 3
    assert summaries.recap(rec, client, T("2026-05-13")) == []  # once per round


def test_a_preview_with_invented_numbers_is_asked_for_again_then_dropped(records):
    rec, games = records
    before = pd.to_datetime(games["start_time_utc"], utc=True).min() - pd.Timedelta(days=1)
    # 70% is in the first game's facts (the model's chance); 93% isn't in any game's.
    client = FakeClient(replies=["They're 93% to win.", "They're 70% to win."])
    written = summaries.previews(rec, client, before)
    # The first game's retry is grounded; the other two games' aren't (70% isn't theirs): dropped.
    assert [w["body"] for w in written] == ["They're 70% to win."] and len(client.calls) == 6
    assert "93" in client.calls[1]["messages"][0]["content"]  # the retry says which number was wrong
    assert summaries.previews(rec, FakeClient(replies=["They're 93% to win."]), before, rewrite=True) == []


def test_a_preview_uses_the_brief_recorded_with_its_prediction(records):
    rec, games = records
    pred = rec.predictions().iloc[0]
    brief = {"brief_version": "1", "run_id": "tue", "match_id": int(pred["match_id"]), "season": 2026, "round": 10,
             "game": {"home_team": pred["home_team"], "away_team": pred["away_team"]},
             "sections": {"drivers": {"unit": "points of predicted margin", "drivers": []}}}
    rec.add_briefs([brief])
    client = FakeClient()
    before = pd.to_datetime(games["start_time_utc"], utc=True).min() - pd.Timedelta(days=1)
    written = summaries.previews(rec, client, before)
    mine = [w for w in written if w["match_id"] == brief["match_id"]][0]
    assert mine["brief_run_id"] == "tue"
    assert {"game", "drivers"} in [set(prompt_facts(c)) for c in client.calls]
