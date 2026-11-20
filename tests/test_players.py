"""The players page's data (pipeline/players.py) and the Model's player ratings (features.player_ratings)."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from features import NOT_NAMED, load_inputs, player_ratings, rapm_features  # noqa: E402


@pytest.fixture(scope="module")
def recent():
    """2025-2026 games and player rows, as build_features sees them."""
    matches, _, players, *_ = load_inputs()
    matches = matches.copy()
    matches["start_time_utc"] = pd.to_datetime(matches["start_time_utc"], utc=True)
    matches = matches[matches["season"] >= 2025]
    return matches, players[players["match_id"].isin(matches["match_id"])]


def test_ratings_add_up_to_the_models_team_rating(recent):
    """With every named player counting 1, a team's rapm_total is the sum of its named 17's ratings
    from the fit before that round: player_ratings is the model's own rating, not a copy of it."""
    matches, players = recent
    team = rapm_features(matches, players, bench_weight=False)
    first = matches.sort_values("start_time_utc")
    game = first[(first["season"] == 2026) & (first["round"] == 12)].iloc[0]  # first kickoff of a round
    ratings = player_ratings(matches, players, game["start_time_utc"], bench_weight=False).set_index("player_id")
    for side in ("home_team", "away_team"):
        named = players[(players["match_id"] == game["match_id"]) & (players["team"] == game[side])
                        & ~players["position"].isin(NOT_NAMED)]
        expected = team.loc[(game["match_id"], game[side]), "rapm_total"]
        assert ratings["rating"].reindex(named["player_id"]).fillna(0).sum() == pytest.approx(expected, abs=1e-9)


def test_ratings_only_use_earlier_games(recent):
    matches, players = recent
    as_of = matches["start_time_utc"].sort_values().iloc[200]
    a = player_ratings(matches, players, as_of)
    later = matches[matches["start_time_utc"] >= as_of]
    scrambled = matches.copy()
    scrambled.loc[later.index, "home_score"] = 0
    scrambled.loc[later.index, "away_score"] = 99
    b = player_ratings(scrambled, players, as_of)
    pd.testing.assert_frame_equal(a, b)
    assert np.isfinite(a["rating"]).all() and (a["games"] > 0).all()
