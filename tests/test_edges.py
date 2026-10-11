"""
Live edges (pipeline/edges.py): the Model's fair odds against Betr's latest price for the coming games,
and the bet paper trading's rule would place. The database's edges_at() is checked against these
numbers in tests/test_publish.py.
"""

import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))

import edges  # noqa: E402
from common import Records  # noqa: E402

T = lambda s: pd.Timestamp(s, tz="UTC")  # noqa: E731
NOW = T("2027-03-03 07:15")


def record(*games):
    """Predictions of record: (match_id, kickoff, home win probability), Storm v Broncos style names."""
    return pd.DataFrame([{"match_id": mid, "season": 2027, "round": 1, "start_time_utc": T(kick),
                          "home_team": f"H{mid}", "away_team": f"A{mid}", "home_win_prob": p} for mid, kick, p in games])


def snaps(*rows):
    """Oriented snapshots: (match_id, captured_at, home odds, away odds)."""
    return pd.DataFrame([{"match_id": m, "captured_at": T(c), "home_odds": h, "away_odds": a} for m, c, h, a in rows],
                        columns=["match_id", "captured_at", "home_odds", "away_odds"])


def test_fair_odds_edges_and_the_bet_on_the_bigger_edge():
    e = edges.live_edges(record((1, "2027-03-06 08:00", 0.60), (2, "2027-03-07 06:00", 0.40)),
                         snaps((1, "2027-03-02 11:15", 1.80, 2.10), (2, "2027-03-02 11:15", 1.60, 2.40)), NOW)
    one, two = e.iloc[0], e.iloc[1]
    assert one.fair_home == pytest.approx(1 / 0.6) and one.fair_away == pytest.approx(2.5)
    # 0.6 x 1.8 - 1 = +8%; 0.4 x 2.1 - 1 = -16%: back the home team.
    assert one.home_edge == pytest.approx(0.08) and one.away_edge == pytest.approx(-0.16)
    assert (one.bet_side, one.bet_team) == ("home", "H1") and one.bet_edge == pytest.approx(0.08)
    assert one.market_home_prob == pytest.approx((1 / 1.8) / (1 / 1.8 + 1 / 2.1))
    # 0.4 x 1.6 - 1 = -36%; 0.6 x 2.4 - 1 = +44%: back the away team.
    assert (two.bet_side, two.bet_team) == ("away", "A2") and two.bet_edge == pytest.approx(0.44)


def test_no_bet_under_the_threshold_and_home_on_a_tie():
    e = edges.live_edges(record((1, "2027-03-06 08:00", 0.50), (2, "2027-03-07 06:00", 0.50)),
                         snaps((1, "2027-03-02 11:15", 2.03, 1.95), (2, "2027-03-02 11:15", 2.20, 2.20)), NOW)
    assert e.iloc[0].home_edge == pytest.approx(0.015) and pd.isna(e.iloc[0].bet_side)  # +1.5%: under 2%
    assert e.iloc[1].bet_side == "home" and e.iloc[1].bet_edge == pytest.approx(0.10)  # level: home, as paper.py


def test_the_latest_price_by_now_and_before_kickoff():
    s = snaps((1, "2027-03-01 11:15", 1.50, 2.60), (1, "2027-03-02 23:15", 1.80, 2.10),
              (1, "2027-03-04 05:15", 3.00, 1.40))  # after `now`: not seen yet
    e = edges.live_edges(record((1, "2027-03-06 08:00", 0.60)), s, NOW)
    assert e.iloc[0].home_odds == 1.80 and e.iloc[0].price_at == T("2027-03-02 23:15")


def test_started_games_are_left_out_and_an_unpriced_game_keeps_its_fair_odds():
    e = edges.live_edges(record((1, "2027-03-03 07:00", 0.60), (2, "2027-03-07 06:00", 0.70)), snaps(), NOW)
    assert list(e["match_id"]) == [2]
    assert e.iloc[0].fair_home == pytest.approx(1 / 0.7) and pd.isna(e.iloc[0].home_odds) and pd.isna(e.iloc[0].bet_side)
    assert "no price yet" in edges.report(e)


@pytest.fixture
def records(tmp_path):
    return Records(2027, replay=False, root=tmp_path)


def test_write_uses_the_prediction_of_record_and_turns_a_reversed_listing_round(records):
    kick = T("2027-03-06 08:00")
    records.update_fixtures(pd.DataFrame([{"match_id": 7, "season": 2027, "round": 1, "round_title": "Round 1",
                                           "is_final": False, "start_time_utc": kick.isoformat(), "venue": "AAMI Park",
                                           "venue_city": "Melbourne", "home_team": "Storm", "away_team": "Broncos",
                                           "neutral": False, "url": "/x/"}]))
    base = {"match_id": 7, "season": 2027, "round": 1, "start_time_utc": kick, "home_team": "Storm",
            "away_team": "Broncos", "margin": 4.0, "total": 40.0, "home_score": 22, "away_score": 18, "model": "with odds",
            "no_odds_home_win_prob": 0.55, "market_open_home_prob": 0.58, "model_version": "2027.1", "inputs": "x"}
    records.add_predictions(pd.DataFrame([dict(base, run_id="tue", created_at=T("2027-03-02 07:15"), home_win_prob=0.55),
                                          dict(base, run_id="wed", created_at=T("2027-03-02 23:15"), home_win_prob=0.62)]))
    # The API lists the game Broncos v Storm: its "home" price is the Broncos'.
    records.add_odds_snapshots(pd.DataFrame([{
        "captured_at": "2027-03-02T11:15:00+00:00", "event_id": "e7", "commence_time": kick.isoformat(),
        "home_team": "Broncos", "away_team": "Storm", "bookmaker": "betr_au", "home_odds": 2.60, "away_odds": 1.75,
        "home_line": 4.5, "home_line_odds": 1.9, "away_line_odds": 1.9, "total": 44.5, "over_odds": 1.9,
        "under_odds": 1.9, "issues": ""}]))
    assert edges.write(records, NOW) == {"games": 1, "bets": 1}
    e = pd.read_csv(records.dir / "edges.csv").iloc[0]
    assert e.home_prob == 0.62 and (e.home_odds, e.away_odds) == (1.75, 2.60)  # Wednesday's; Storm's price is 1.75
    assert e.bet_team == "Storm" and e.bet_edge == pytest.approx(0.62 * 1.75 - 1)
    md = (records.dir / "edges.md").read_text(encoding="utf-8")
    assert "Storm v Broncos" in md and "Prices as of 2027-03-02 11:15 UTC" in md and "1 bet at 2%" in md


def test_off_season_writes_nothing_and_a_finished_round_says_so(records):
    assert edges.write(records, NOW) == {"games": 0, "bets": 0}
    assert not (records.dir / "edges.md").exists()
    (records.dir / "edges.md").write_text("old", encoding="utf-8")
    edges.write(records, NOW)
    assert "No games to come." in (records.dir / "edges.md").read_text(encoding="utf-8")
