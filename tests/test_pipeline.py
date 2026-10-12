"""
Tests for the weekly pipeline (pipeline/): which games a run predicts, neutral venues, the
prediction of record, grading against the final test, and (slow) a replayed predict run giving
exactly `predict.py --replay`'s predictions.
"""

import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))

import draw  # noqa: E402
import grade  # noqa: E402
from common import Records, load_matches  # noqa: E402

T = lambda s: pd.Timestamp(s, tz="UTC")  # noqa: E731


def fake_draw(games):
    """games: (round, kickoff, status) tuples."""
    return pd.DataFrame([{"match_id": i, "season": 2027, "round": r, "is_final": False, "start_time_utc": T(k),
                          "status": s, "home_team": f"H{i}", "away_team": f"A{i}", "venue": f"V{i}"}
                         for i, (r, k, s) in enumerate(games)])


# ---------------------------------------------------------------- which games to predict

def test_tuesday_predicts_the_next_round():
    d = fake_draw([(1, "2027-03-06", "final"), (1, "2027-03-07", "final"),
                   (2, "2027-03-13", "scheduled"), (2, "2027-03-14", "scheduled"), (3, "2027-03-20", "scheduled")])
    rnd, games = draw.games_to_predict(d, T("2027-03-09 07:15"))
    assert rnd == 2 and list(games["match_id"]) == [2, 3]


def test_mid_round_refresh_covers_only_games_still_to_start():
    d = fake_draw([(2, "2027-03-13", "final"), (2, "2027-03-14 06:00", "scheduled"), (3, "2027-03-20", "scheduled")])
    rnd, games = draw.games_to_predict(d, T("2027-03-14 01:00"))
    assert rnd == 2 and list(games["match_id"]) == [1]


def test_a_postponed_game_is_predicted_with_the_round_it_is_now_played_in():
    # Round 2's second game moved to the Wednesday after round 3 starts.
    d = fake_draw([(2, "2027-03-13", "final"), (2, "2027-03-25", "scheduled"), (3, "2027-03-20", "final"),
                   (3, "2027-03-26", "scheduled"), (4, "2027-04-02", "scheduled")])
    rnd, games = draw.games_to_predict(d, T("2027-03-22 07:15"))
    assert rnd == 3 and list(games["match_id"]) == [1, 3]


def test_a_round_with_byes_and_the_end_of_the_season():
    d = fake_draw([(1, "2027-03-06", "final"), (2, "2027-03-13", "scheduled")])
    assert draw.games_to_predict(d, T("2027-03-09"))[0] == 2
    assert draw.games_to_predict(d, T("2027-03-20"))[0] is None


def test_replay_draw_status_follows_the_clock():
    kickoff = draw.replay_draw(2026, T("2026-01-01")).query("round == 10")["start_time_utc"].min()
    d = draw.replay_draw(2026, kickoff + pd.Timedelta(minutes=30))
    assert d[d["round"] == 10].iloc[0]["status"] == "live"
    assert (d[d["round"] == 10].iloc[1:]["status"] == "scheduled").all()
    assert (d.loc[d["round"] < 10, "status"] == "final").all()
    assert (d.loc[d["round"] > 10, "status"] == "scheduled").all()


def test_neutral_venues_from_the_draw_match_the_odds_sheet():
    """The draw-only rule agrees with the odds sheet's venue flags on 2026's games (Las Vegas,
    Magic Round and the grand final are neutral)."""
    from ingest import join_odds_to_matches, load_odds
    d = draw.replay_draw(2026, T("2026-01-01"))
    neutral = draw.neutral_games(d)
    odds = load_odds()
    joined = join_odds_to_matches(d[["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    sheet = joined.merge(odds[["odds_id", "neutral"]], on="odds_id")
    agree = (sheet["match_id"].isin(neutral) == sheet["neutral"].astype(bool)).mean()
    assert agree > 0.97, agree
    vegas = d.loc[d["venue_city"] == "Las Vegas", "match_id"]
    assert len(vegas) and set(vegas) <= neutral


# ---------------------------------------------------------------- prediction of record and grading

def test_prediction_of_record_is_the_latest_before_kickoff():
    k = T("2027-03-13 09:00")
    p = pd.DataFrame({"match_id": [1, 1, 1, 2], "start_time_utc": [k] * 4, "home_win_prob": [0.6, 0.7, 0.9, 0.4],
                      "created_at": [T("2027-03-09"), T("2027-03-12"), T("2027-03-13 09:30"), T("2027-03-09")]})
    rec = grade.prediction_of_record(p).set_index("match_id")["home_win_prob"]
    assert rec.to_dict() == {1: 0.7, 2: 0.4}  # the 09:30 run came after kickoff


def final_test_rows(path=ROOT / "reports" / "final_2026.md"):
    """The main model and benchmark rows of both tables in reports/final_2026.md."""
    tables, current = [], None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("| model |"):
            current = {}
            tables.append(current)
        elif current is not None and line.startswith("| ") and not line.startswith("|---"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            current[cells[0]] = [float(c) if re.match(r"^-?[\d.]+$", c) else np.nan for c in cells[1:]]
        elif not line.startswith("|"):
            current = None
    return tables[0], tables[1]  # reliable closing odds (197), all games (213)


@pytest.mark.skipif(not (ROOT / "reports" / "predictions_2026.csv").exists(),
                    reason="needs the final test's predictions (python src/train.py --final)")
def test_grading_the_final_test_reproduces_its_report():
    """Grading the final test's predictions, as each game's prediction of record, gives exactly the
    numbers in reports/final_2026.md: the grading code and the backtest agree."""
    p = pd.read_csv(ROOT / "reports" / "predictions_2026.csv")
    m = load_matches().set_index("match_id")
    kickoff = pd.to_datetime(p["match_id"].map(m["start_time_utc"]), utc=True)
    record = pd.DataFrame({"match_id": p["match_id"], "start_time_utc": kickoff,
                           "created_at": kickoff - pd.Timedelta(hours=1),
                           "home_win_prob": p["with_odds|ensemble|home_win"], "margin": p["with_odds|ensemble|margin"],
                           "total": p["with_odds|ensemble|total"]})
    g = grade.grade(record)
    reliable, everything = final_test_rows()
    cols = ["games", "log_loss", "brier", "accuracy", "margin_mae", "total_mae"]
    pairs = [("Model", "With odds: ensemble"), ("Market opening", "Benchmark: market opening"),
             ("Elo", "Benchmark: Elo only")]
    for subset, table, closing in [(g, everything, None),
                                   (g[g["close_ok"].fillna(False).astype(bool)], reliable,
                                    ("Market closing", "Benchmark: market closing (p_close)"))]:
        got = grade.metrics(subset)
        for mine, theirs in pairs + ([closing] if closing else []):
            want = dict(zip(cols, table[theirs][:6]))
            for c in cols:
                if not np.isnan(want[c]):
                    assert got.loc[mine, c] == pytest.approx(want[c], abs=5e-5), (mine, c)


# ---------------------------------------------------------------- results the odds sheet doesn't have yet

def sheet_without_2026():
    from ingest import add_scraped_results, load_odds
    odds = load_odds()
    m26 = load_matches().query("season == 2026")
    rebuilt = add_scraped_results(odds[odds["season"] < 2026].copy(), load_matches(), draw.neutral_games(m26))
    return odds, rebuilt, m26


def by_match(odds, games):
    from elo import load_params, run_elo
    from features import team_ratings
    from ingest import join_odds_to_matches
    o = odds.join(run_elo(odds, **load_params(odds), after=True))
    o = o.merge(team_ratings(odds)[["odds_id", "team_margin"]], on="odds_id", how="left")
    j = join_odds_to_matches(games[["match_id", "start_time_utc", "home_team", "away_team"]], o)
    return j[["match_id", "odds_id"]].merge(o, on="odds_id").set_index("match_id").sort_index()


def test_scraped_results_change_nothing_while_the_sheet_has_every_game():
    from ingest import add_scraped_results, load_odds
    odds = load_odds()
    assert add_scraped_results(odds, load_matches()) is odds


def test_scraped_results_stand_in_for_a_season_the_sheet_doesnt_have_yet():
    """With 2026 taken out of the odds sheet, the scraped results (neutral venues from the draw) give
    every 2026 game the same date, venue flags, Elo and team rating as the sheet does."""
    odds, rebuilt, m26 = sheet_without_2026()
    a, b = by_match(odds, m26), by_match(rebuilt, m26)
    assert len(a) == len(b) == len(m26)
    assert (a["date"] == b["date"]).all()
    for c in ["season", "home_score", "away_score", "neutral", "is_final"]:
        assert (a[c].astype(float) == b[c].astype(float)).all(), c
    for c in ["elo_home", "elo_away", "elo_prob", "elo_home_after", "elo_away_after", "team_margin"]:
        assert np.allclose(a[c], b[c], atol=1e-9, equal_nan=True), c


def test_a_0_0_scraped_result_is_left_out():
    from ingest import add_scraped_results, load_odds
    odds = load_odds()
    m = load_matches().query("season == 2026").head(2).copy()
    m["start_time_utc"] = ["2027-03-06T09:00:00Z", "2027-03-07T06:00:00Z"]
    m["season"], m["home_score"], m["away_score"] = 2027, [0, 24], [0, 12]
    out = add_scraped_results(odds, m)
    added = out[out["season"] == 2027]
    assert list(zip(added["home_score"], added["away_score"])) == [(24, 12)]
    assert added["p_open"].isna().all() and not added["close_ok"].any()


def test_grading_takes_betr_s_prices_for_games_the_sheet_doesnt_price():
    odds, rebuilt, m26 = sheet_without_2026()
    games = m26.head(3)
    live = pd.DataFrame({"p_open": [0.6, 0.4], "open_line": [-4.5, 2.5], "open_total": [44.5, 40.5],
                         "p_close": [0.65, np.nan], "close_line": [-6.5, np.nan], "close_total": [43.5, np.nan]},
                        index=pd.Index(games["match_id"].iloc[:2], name="match_id"))
    got = grade.market_and_elo(games, rebuilt, live).set_index("match_id")
    first, second, third = games["match_id"]
    assert got.loc[first, ["p_open", "p_close", "close_line"]].tolist() == [0.6, 0.65, -6.5]
    assert got.loc[first, "close_ok"] and not got.loc[second, "close_ok"]
    assert got.loc[[first, second], "market_source"].eq("Betr live").all()
    assert pd.isna(got.loc[third, "market_source"]) and pd.isna(got.loc[third, "p_open"])
    assert got["elo_prob"].notna().all()
    with_sheet = grade.market_and_elo(games, odds, live).set_index("match_id")
    assert with_sheet["market_source"].eq("sheet").all()  # the sheet's prices come first
    assert "Betr's from The Odds API" in grade.market_note(got.assign(market_source=got["market_source"]))


# ---------------------------------------------------------------- the jobs, replayed

@pytest.mark.slow
def test_replayed_predict_run_matches_predict_replay(tmp_path):
    """The predict job run on Tuesday of 2026 round 10 picks round 10 and predicts exactly what
    `predict.py --replay --round 10` does, and the results job then grades those games."""
    import predict
    import run
    records = Records(2026, replay=True, root=tmp_path)
    job = run.run_job("predict", 2026, as_of="2026-05-05 17:15", records=records)
    assert job["status"] == "ok" and job["round"] == 10
    mine = records.predictions().sort_values("match_id").reset_index(drop=True)
    fixtures, lists = predict.replay_round(2026, 10)
    ref, _, _, _ = predict.predict_fixtures(fixtures, lists, predict.load_bundle(2026), keep_weather=True)
    ref = ref.sort_values("match_id").reset_index(drop=True)
    for c in ["match_id", "home_win_prob", "margin", "total", "home_score", "away_score"]:
        np.testing.assert_allclose(mine[c].to_numpy(float), ref[c].to_numpy(float), atol=1e-12)

    again = run.run_job("refresh", 2026, as_of="2026-05-06 09:15", records=records)
    assert again["status"] == "nothing to do"  # nothing changed since Tuesday

    graded = run.run_job("results", 2026, as_of="2026-05-11 10:15", records=records)
    assert graded["status"] == "ok" and graded["games"] == len(ref)


def test_no_draw_is_nothing_to_do_before_the_season_and_a_failure_during_it(tmp_path, monkeypatch):
    import run
    monkeypatch.setattr(draw, "live_draw", lambda season: pd.DataFrame(columns=draw.COLUMNS))
    records = Records(2027, replay=False, root=tmp_path)
    monkeypatch.setattr(run.fetch_odds, "api_key", lambda: None)
    clock = {"now": T("2026-10-11")}
    monkeypatch.setattr(run.pd.Timestamp, "now", classmethod(lambda cls, tz=None: clock["now"]))
    assert run.run_job("predict", 2027, records=records)["status"] == "nothing to do"
    clock["now"] = T("2027-02-10")
    with pytest.raises(RuntimeError, match="no 2027 draw"):
        run.run_job("predict", 2027, records=records)
    assert records.runs()[-1]["status"] == "failed"


# ---------------------------------------------------------------- the margin game (step 11a)

def round_games(pairs, round_=5, start="2027-04-03 08:00"):
    return pd.DataFrame([{"match_id": 100 + i, "round": round_, "home_team": h, "away_team": a,
                          "start_time_utc": T(start) + pd.Timedelta(hours=i)} for i, (h, a) in enumerate(pairs)])


def test_the_margin_game_avoids_last_round_s_teams():
    games = round_games([("Storm", "Broncos"), ("Eels", "Panthers"), ("Roosters", "Sharks")])
    assert list(draw.eligible_for_draw(games, ("Broncos", "Panthers"))["match_id"]) == [102]
    assert list(draw.eligible_for_draw(games, None)["match_id"]) == [100, 101, 102]
    # Nothing qualifies: every game is eligible again.
    assert list(draw.eligible_for_draw(games.iloc[:2], ("Storm", "Eels"))["match_id"]) == [100, 101]


def test_the_draw_picks_every_eligible_game_and_nothing_else():
    import random
    games = round_games([("Storm", "Broncos"), ("Eels", "Panthers"), ("Roosters", "Sharks"), ("Titans", "Dragons")])
    rng = random.Random(1)
    picks = {draw.draw_featured(games, ("Storm", "Eels"), rng)[0] for _ in range(200)}
    assert picks == {102, 103}


def test_the_predict_job_draws_each_round_once_and_never_after_kickoff(tmp_path):
    import random
    import run
    rec = Records(2027, replay=False, root=tmp_path)
    r4 = round_games([("Storm", "Broncos"), ("Eels", "Panthers")], round_=4, start="2027-03-27 08:00")
    r5 = round_games([("Broncos", "Raiders"), ("Eels", "Titans"), ("Roosters", "Sharks")])
    tuesday = T("2027-03-23 07:15")
    first = run.margin_game(rec, 2027, 4, r4, tuesday, "a", random.Random(3))
    assert run.margin_game(rec, 2027, 4, r4, tuesday + pd.Timedelta(days=1), "b") == first  # kept, not redrawn
    previous = r4[r4["match_id"] == first].iloc[0]
    pick = run.margin_game(rec, 2027, 5, r5, T("2027-03-30 07:15"), "c", random.Random(3))
    chosen = r5[r5["match_id"] == pick].iloc[0]
    assert not {chosen["home_team"], chosen["away_team"]} & {previous["home_team"], previous["away_team"]}
    assert list(rec.rounds()["round"]) == [4, 5]
    # A round that has already started isn't drawn (its first game could have been tipped already).
    r6 = round_games([("Storm", "Raiders")], round_=6, start="2027-04-10 08:00")
    assert run.margin_game(rec, 2027, 6, r6, T("2027-04-10 09:00"), "d") is None
