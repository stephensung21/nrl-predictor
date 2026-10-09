"""
Fast unit tests for the pipeline's building blocks (run in seconds; the leakage test is the slow,
end-to-end check). Run just these with: python -m pytest -m "not slow"
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import config  # noqa: E402
import models  # noqa: E402
from elo import run_elo  # noqa: E402
from evaluate import bootstrap_diff  # noqa: E402
from features import distance_km, repair_scraped_games, tz_change  # noqa: E402
from ingest import join_odds_to_matches, shin_prob, two_way_prob  # noqa: E402
from reports import md_table  # noqa: E402


# ---------------------------------------------------------------- ingest and features

def test_two_way_prob_removes_margin():
    p = two_way_prob(np.array([1.80, 2.00]), np.array([2.00, 2.00]))
    assert p[1] == pytest.approx(0.5)
    assert p[0] == pytest.approx((1 / 1.8) / (1 / 1.8 + 1 / 2.0))


def test_shin_prob_favours_the_favourite_and_sums_to_one():
    h, a = np.array([1.20, 1.90]), np.array([4.50, 1.90])
    p_home, p_away = shin_prob(h, a), shin_prob(a, h)
    assert p_home + p_away == pytest.approx([1.0, 1.0])
    assert p_home[1] == pytest.approx(0.5)
    assert p_home[0] > two_way_prob(h, a)[0]  # more of the margin comes off the longshot


def test_join_odds_to_matches_within_a_day():
    matches = pd.DataFrame({"match_id": [1, 2], "home_team": ["Storm", "Broncos"], "away_team": ["Eels", "Titans"],
                            "start_time_utc": ["2024-03-08T09:00:00Z", "2024-03-09T07:00:00Z"]})
    odds = pd.DataFrame({"odds_id": [10, 11, 12], "home_team": ["Storm", "Broncos", "Broncos"],
                         "away_team": ["Eels", "Titans", "Titans"],
                         "date": pd.to_datetime(["2024-03-08", "2024-03-09", "2024-07-20"])})
    joined = join_odds_to_matches(matches, odds).set_index("match_id")["odds_id"]
    assert joined.to_dict() == {1: 10, 2: 11}  # the July rematch is not picked


def test_repair_scraped_games_fixes_scores_and_minutes():
    matches = pd.DataFrame({"match_id": [1, 2], "season": 2021, "round": [1, 2], "home_team": ["Storm", "Storm"],
                            "away_team": ["Eels", "Titans"],
                            "start_time_utc": ["2021-03-11T09:00:00Z", "2021-03-18T09:00:00Z"],
                            "home_score": [0, 30], "away_score": [0, 10]})
    odds = pd.DataFrame({"odds_id": [0, 1], "home_team": ["Storm", "Storm"], "away_team": ["Eels", "Titans"],
                         "date": pd.to_datetime(["2021-03-11", "2021-03-18"]), "home_score": [42, 30],
                         "away_score": [20, 10]})
    team_stats = pd.DataFrame({"match_id": [1, 1, 2, 2], "team": ["Storm", "Eels", "Storm", "Titans"],
                               "points_for": [0, 0, 30, 10], "points_against": [0, 0, 10, 30]})
    players = pd.DataFrame({"match_id": [1, 1, 1, 2, 2], "position": ["Fullback", "Interchange", "Reserve",
                                                                         "Fullback", "Interchange"],
                            "minutesPlayed": [0, 0, 0, 80, 30]})
    m, ts, pl = repair_scraped_games(matches, team_stats, players, odds)
    assert m.loc[m["match_id"] == 1, ["home_score", "away_score"]].values.tolist() == [[42, 20]]
    assert ts.loc[(ts["match_id"] == 1) & (ts["team"] == "Storm"), ["points_for", "points_against"]].values.tolist() == [[42, 20]]
    filled = pl[pl["match_id"] == 1]
    assert filled["minutesPlayed"].tolist() == [80, 30, 0]  # typical starter / interchange minutes; reserve stays 0


def test_travel_helpers():
    assert distance_km("Sydney", "Brisbane") == pytest.approx(730, abs=30)
    assert distance_km("Sydney", "Nowhere") == 0.0
    assert tz_change("Sydney", "Perth") == 2
    assert tz_change("Sydney", "Las Vegas") == 6  # the shorter way around the clock


def test_elo_rewards_the_winner():
    games = pd.DataFrame({"season": [2020, 2020], "home_team": ["A", "A"], "away_team": ["B", "B"],
                          "home_score": [30, np.nan], "away_score": [10, np.nan], "neutral": [False, False]})
    out = run_elo(games, k=20, hfa=50)
    assert out.loc[0, "elo_prob"] > 0.5                  # home advantage before any results
    assert out.loc[1, "elo_home"] > out.loc[0, "elo_home"]  # the winner's rating went up
    assert out.loc[1, "elo_prob"] > out.loc[0, "elo_prob"]


# ---------------------------------------------------------------- models and config

def test_walk_forward_trains_on_earlier_seasons_only():
    df = pd.DataFrame({"season": [2021, 2021, 2022, 2023, 2023]})
    folds = list(models.walk_forward(df, [2022, 2023]))
    assert [list(tr) for tr, _ in folds] == [[0, 1], [0, 1, 2]]
    assert [list(te) for _, te in folds] == [[2], [3, 4]]


def test_margin_win_prob():
    p = models.margin_win_prob([0.0, 10.0, -10.0], np.array([-13.0, 13.0]))
    assert p[0] == pytest.approx(0.5)
    assert p[1] == pytest.approx(1 - p[2])
    assert p[1] > 0.5


def test_linear_odds_keeps_bookmaker_inputs_out_of_totals():
    assert set(config.BOOKMAKER_INPUTS) <= set(models.linear_odds("home_win"))
    assert not set(config.BOOKMAKER_INPUTS) & set(models.linear_odds("total"))


def test_lgb_compact_features_have_no_duplicates():
    feats = models.lgb_features(True)
    assert len(feats) == len(set(feats))
    assert set(config.LGB_COMPACT_EXTRA) <= set(feats)
    assert {f for fs in config.LINEAR_FEATURES.values() for f in fs} <= set(feats)


def test_config_override_restores_settings():
    before = config.LGB_SEEDS
    with config.override(LGB_SEEDS=1):
        assert config.LGB_SEEDS == 1
    assert config.LGB_SEEDS == before


# ---------------------------------------------------------------- evaluation and reports

def test_bootstrap_diff_of_identical_predictions_is_zero():
    out = bootstrap_diff([1, 0, 1, 1], [0.6, 0.4, 0.7, 0.55], [0.6, 0.4, 0.7, 0.55])
    assert out["mean_diff"] == 0 and out["ci_low"] == 0 and out["ci_high"] == 0


def test_md_table_formats_numbers():
    table = md_table(pd.DataFrame({"games": [212.0], "log_loss": [0.62346], "missing": [np.nan]},
                                  index=pd.Index(["With odds: ensemble"], name="model")))
    assert table.splitlines()[0] == "| model | games | log_loss | missing |"
    assert table.splitlines()[2] == "| With odds: ensemble | 212 | 0.6235 | - |"
