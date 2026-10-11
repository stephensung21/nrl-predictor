"""
Tests for the live odds (pipeline/fetch_odds.py) on a saved response shaped like The Odds API's, so
they run without a key: team names, the impossible-price check, which snapshot is the opening price,
matching games to nrl.com's fixtures, the credit guard, and (slow) that a game priced only from live
odds is predicted exactly as if the odds sheet had the same opening prices.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))

import fetch_odds  # noqa: E402
from common import Records  # noqa: E402

SAMPLE = json.loads((ROOT / "tests" / "odds_api" / "sample_response.json").read_text())
T = lambda s: pd.Timestamp(s, tz="UTC")  # noqa: E731


def snapshot(captured_at, home_odds=1.5, away_odds=2.6, line=-6.5, total=44.5):
    events = json.loads(json.dumps(SAMPLE[:1]))
    for m in events[0]["bookmakers"][0]["markets"]:
        for o in m["outcomes"]:
            if m["key"] == "h2h":
                o["price"] = home_odds if o["name"] == "Melbourne Storm" else away_odds
            elif m["key"] == "spreads":
                o["point"] = line if o["name"] == "Melbourne Storm" else -line
            else:
                o["point"] = total
    return fetch_odds.parse(events, captured_at)


def test_parse_maps_team_names_and_keeps_betr_prices():
    s = fetch_odds.parse(SAMPLE, "2027-03-02T00:00:00+00:00")
    assert list(s["event_id"]) == ["e1", "e2"]  # e3 has no Betr prices
    storm = s.iloc[0]
    assert (storm["home_team"], storm["away_team"]) == ("Storm", "Broncos")
    assert (storm["home_odds"], storm["away_odds"], storm["home_line"], storm["total"]) == (1.5, 2.6, -6.5, 44.5)
    manly = s.iloc[1]
    assert (manly["home_team"], manly["away_team"]) == ("Sea Eagles", "Dragons")


def test_impossible_prices_are_blanked_and_named():
    manly = fetch_odds.parse(SAMPLE, "2027-03-02T00:00:00+00:00").iloc[1]
    assert np.isnan(manly["home_odds"]) and np.isnan(manly["away_odds"])  # 1/2.2 + 1/2.1 < 100%
    assert "h2h: implied probabilities add to 93.1%" in manly["issues"]
    assert manly["home_line"] == -1.5  # the line market is fine and kept
    assert np.isnan(manly["total"]) and "total" not in manly["issues"]  # not offered, not an issue


def test_an_unknown_team_stops_the_run():
    events = json.loads(json.dumps(SAMPLE[:1]))
    events[0]["away_team"] = "Adelaide Jets"
    with pytest.raises(ValueError, match="Adelaide Jets"):
        fetch_odds.parse(events, "2027-03-02T00:00:00+00:00")


def test_opening_is_the_first_snapshot_before_kickoff_and_closing_the_last():
    snaps = pd.concat([snapshot("2027-03-01T23:15:00+00:00", 1.5, 2.6, -6.5, 44.5),
                       snapshot("2027-03-04T05:15:00+00:00", 1.4, 2.9, -8.5, 42.5),
                       snapshot("2027-03-05T09:30:00+00:00", 1.1, 7.0, -20.5, 40.5)])  # after kickoff
    p = fetch_odds.game_prices(snaps).iloc[0]
    assert (p["open_home_odds"], p["open_line"], p["open_total"]) == (1.5, -6.5, 44.5)
    assert (p["close_home_odds"], p["close_line"], p["close_total"]) == (1.4, -8.5, 42.5)
    assert p["p_open"] == pytest.approx((1 / 1.5) / (1 / 1.5 + 1 / 2.6))
    assert p["opened_at"] == T("2027-03-01 23:15")


def test_a_market_that_opens_later_takes_its_own_first_price():
    first = snapshot("2027-03-01T23:15:00+00:00")
    first[fetch_odds.MARKETS["total"]] = np.nan  # totals not up yet
    later = snapshot("2027-03-02T23:15:00+00:00", total=46.5)
    p = fetch_odds.game_prices(pd.concat([first, later])).iloc[0]
    assert p["open_home_odds"] == 1.5 and p["open_total"] == 46.5


def test_fixtures_are_matched_either_way_round():
    prices = fetch_odds.game_prices(snapshot("2027-03-01T23:15:00+00:00"))
    fixtures = pd.DataFrame({"match_id": [1, 2], "start_time_utc": ["2027-03-05T09:00:00Z", "2027-03-06T06:00:00Z"],
                             "home_team": ["Broncos", "Sea Eagles"], "away_team": ["Storm", "Dragons"]})
    live = fetch_odds.for_fixtures(fixtures, prices)
    assert list(live.index) == [1]  # game 2 has no price
    assert live.loc[1, "p_open"] == pytest.approx(1 - prices.loc[0, "p_open"])
    assert (live.loc[1, "open_line"], live.loc[1, "open_total"]) == (6.5, 44.5)


@pytest.fixture
def records(tmp_path, monkeypatch):
    monkeypatch.setattr(fetch_odds, "RAW", tmp_path / "raw")
    monkeypatch.setattr(fetch_odds, "api_key", lambda: "KEY")
    return Records(2027, replay=False, root=tmp_path)


def test_record_snapshot_appends_and_the_credit_guard_skips(records, monkeypatch):
    calls = []
    monkeypatch.setattr(fetch_odds, "fetch", lambda key: calls.append(key) or (SAMPLE, 40.0))
    now = T("2027-03-02 00:15")
    got = fetch_odds.record_snapshot(records, now)
    assert got["status"] == "ok" and got["priced"] == 2 and got["credits_remaining"] == 40.0
    assert len(records.odds_snapshots()) == 2 and len(got["issues"]) == 1
    records.add_run({"as_of": now.isoformat(), "odds": got})
    skipped = fetch_odds.record_snapshot(records, now + pd.Timedelta(hours=6))
    assert skipped["status"] == "skipped" and len(calls) == 1
    # A week on, the monthly quota may have reset: try again.
    assert fetch_odds.record_snapshot(records, now + pd.Timedelta(days=8))["status"] == "ok" and len(calls) == 2


def test_no_key_is_a_skip(records, monkeypatch):
    monkeypatch.setattr(fetch_odds, "api_key", lambda: None)
    assert fetch_odds.record_snapshot(records, T("2027-03-02"))["status"] == "skipped"


def test_errors_never_carry_the_key(monkeypatch):
    def refuse(url, params, timeout):
        raise requests.ConnectionError(f"Max retries exceeded with url: {url}?apiKey={params['apiKey']}")
    monkeypatch.setattr(fetch_odds.requests, "get", refuse)
    with pytest.raises(RuntimeError) as err:
        fetch_odds.fetch("SECRET123")
    assert "SECRET123" not in str(err.value) and err.value.__cause__ is None


@pytest.mark.slow
def test_a_game_priced_from_live_odds_is_predicted_as_from_the_sheet(monkeypatch):
    """Take one game of 2026 round 10 out of the odds sheet and give its sheet opening prices as live
    odds: every prediction is the same as with the full sheet."""
    import features
    import predict
    from ingest import join_odds_to_matches
    fixtures, lists = predict.replay_round(2026, 10)
    bundle = predict.load_bundle(2026)
    ref, _, _, _ = predict.predict_fixtures(fixtures, lists, bundle, keep_weather=True)

    # A game at the home team's own ground: venue flags for games not in the sheet come from the
    # draw (tested in test_pipeline), which this test leaves out.
    full = features.load_inputs
    odds = full()[3]
    joined = join_odds_to_matches(fixtures, odds).merge(odds[["odds_id", "neutral"]], on="odds_id")
    usable = joined[~joined["neutral"].astype(bool) & joined["match_id"].isin(ref.loc[ref["model"] == "with odds", "match_id"])]
    game = ref.set_index("match_id").loc[usable["match_id"].iloc[0]].rename_axis(None)
    game["match_id"] = usable["match_id"].iloc[0]
    row = odds[odds["odds_id"] == int(usable["odds_id"].iloc[0])]
    live = row[["p_open", "open_line", "open_total"]].set_index(pd.Index([game["match_id"]], name="match_id"))
    monkeypatch.setattr(predict, "load_inputs",
                        lambda: tuple(o[o["odds_id"] != row["odds_id"].iloc[0]] if i == 3 else o
                                      for i, o in enumerate(full())))
    mine, _, _, _ = predict.predict_fixtures(fixtures, lists, bundle, keep_weather=True, live_odds=live)
    assert (mine["model"] == ref["model"]).all()
    for c in ["home_win_prob", "margin", "total", "no_odds_home_win_prob", "market_open_home_prob"]:
        np.testing.assert_allclose(mine[c].to_numpy(float), ref[c].to_numpy(float), atol=1e-12)


def test_the_odds_job_and_a_failed_fetch_in_another_job(records, monkeypatch):
    import run
    monkeypatch.setattr(fetch_odds, "fetch", lambda key: (SAMPLE, 300.0))
    job = run.run_job("odds", 2027, records=records)
    assert job["status"] == "ok" and job["odds"]["priced"] == 2 and len(records.odds_snapshots()) == 2

    def down(key):
        raise RuntimeError("The Odds API returned 503: unavailable")
    monkeypatch.setattr(fetch_odds, "fetch", down)
    job = {"warnings": []}
    run.odds_step(records, T("2027-03-03"), job)  # a failed fetch warns; the job carries on
    assert job["odds"]["status"] == "failed" and "503" in job["warnings"][0]
