"""
Tests for paper trading (pipeline/paper.py): bets only at a price that existed when the prediction
was made, the side with the bigger edge, the minimum edge, a draw losing, and closing line value.
"""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline"))

import paper  # noqa: E402

T = lambda s: pd.Timestamp(s, tz="UTC")  # noqa: E731
KICK = T("2027-03-06 08:00")


def record(prob, made="2027-03-03 07:15", match_id=1):
    return pd.DataFrame([{"match_id": match_id, "created_at": T(made), "start_time_utc": KICK, "home_win_prob": prob,
                          "season": 2027, "round": 1, "home_team": "Storm", "away_team": "Broncos"}])


def snaps(*rows, match_id=1):
    return pd.DataFrame([{"match_id": match_id, "captured_at": T(t), "home_odds": h, "away_odds": a} for t, h, a in rows])


def results(home, away, match_id=1):
    return pd.DataFrame([{"match_id": match_id, "home_score": home, "away_score": away}])


PRICES = snaps(("2027-03-01 11:15", 1.8, 2.0), ("2027-03-03 05:15", 1.9, 1.95), ("2027-03-04 23:15", 1.7, 2.2),
               ("2027-03-06 09:00", 1.1, 6.0))  # the last is after kickoff


def test_bets_at_the_price_when_the_prediction_was_made_and_grades_closing_value():
    bets = paper.paper_bets(record(0.6), PRICES, results(24, 16))
    b = bets.iloc[0]
    assert (b["side"], b["odds"], b["close_odds"]) == ("home", 1.9, 1.7)  # Tuesday's price; closing before kickoff
    assert b["edge"] == pytest.approx(0.6 * 1.9 - 1) and b["won"] and b["profit"] == pytest.approx(0.9)
    assert b["clv"] == pytest.approx(1.9 / 1.7 - 1)


def test_takes_the_side_with_the_bigger_edge_and_skips_small_edges():
    assert paper.paper_bets(record(0.4), PRICES, results(10, 20)).iloc[0]["side"] == "away"  # 0.6 x 1.95
    assert paper.paper_bets(record(0.53), PRICES, results(10, 20)).empty  # 0.53 x 1.9 = 1.007: under 2%


def test_no_bet_without_a_price_at_the_time_and_a_draw_loses():
    assert paper.paper_bets(record(0.6, made="2027-03-01 09:00"), PRICES, results(24, 16)).empty
    assert paper.paper_bets(record(0.6), PRICES, results(18, 18)).iloc[0]["profit"] == -1


def test_unplayed_games_are_bets_still_to_settle():
    b = paper.paper_bets(record(0.6), PRICES, results(None, None)).iloc[0]
    assert b["won"] is None and pd.isna(b["profit"])
    assert "No settled bets yet." in paper.report(paper.paper_bets(record(0.6), PRICES, results(None, None)), 2027)


def test_the_live_results_job_writes_the_paper_trading_record(tmp_path, monkeypatch):
    """A live results run grades the season and rebuilds paper_bets.csv and paper.md from the records."""
    import scrape
    import run
    from common import Records, load_matches
    for name in ("fetch_season", "fetch_origin", "build_tables", "build_origin_table"):
        monkeypatch.setattr(scrape, name, lambda *a, **k: None)
    monkeypatch.setattr(run.fetch_odds, "api_key", lambda: None)
    monkeypatch.setattr(run.fetch_sheet, "update", lambda: {"status": "skipped in tests"})
    rec = Records(2026, replay=False, root=tmp_path)
    g = load_matches().query("season == 2026 and round == 10").iloc[0]
    kick = pd.Timestamp(g["start_time_utc"])
    rec.add_predictions(pd.DataFrame([{
        "run_id": "tue", "created_at": kick - pd.Timedelta(days=2), "match_id": g["match_id"], "season": 2026,
        "round": 10, "start_time_utc": kick, "home_team": g["home_team"], "away_team": g["away_team"],
        "home_win_prob": 0.7, "margin": 6.0, "total": 40.0, "home_score": 23, "away_score": 17, "model": "with odds",
        "no_odds_home_win_prob": 0.6, "market_open_home_prob": 0.6, "model_version": "2026.1", "inputs": "x"}]))
    rec.add_odds_snapshots(pd.DataFrame([{
        "captured_at": (kick - pd.Timedelta(days=3)).isoformat(), "event_id": "e1", "commence_time": kick.isoformat(),
        "home_team": g["home_team"], "away_team": g["away_team"], "bookmaker": "betr_au", "home_odds": 1.8,
        "away_odds": 2.0, "home_line": -2.5, "home_line_odds": 1.9, "away_line_odds": 1.9, "total": 40.5,
        "over_odds": 1.9, "under_odds": 1.9, "issues": ""}]))
    job = run.run_job("results", 2026, records=rec)
    assert job["status"] == "ok" and job["paper_bets"] == 1
    bets = pd.read_csv(rec.dir / "paper_bets.csv")
    assert bets.loc[0, "odds"] == 1.8 and bets.loc[0, "won"] == (g["home_score"] > g["away_score"])
    assert "Bets settled: 1" in (rec.dir / "paper.md").read_text(encoding="utf-8")
