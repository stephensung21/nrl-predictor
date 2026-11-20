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


# ---------------------------------------------------------------- pipeline/players.py

def _game(match_id, kickoff, season=2026):
    return {"match_id": match_id, "season": season, "start_time_utc": kickoff, "home_score": 10, "away_score": 4}


def _row(match_id, player_id, team, position, minutes=80, **stats):
    from players import TOTALS
    row = {"match_id": match_id, "season": 2026, "player_id": player_id, "player_name": f"P{player_id}", "team": team,
           "position": position, **{v: 0 for v in TOTALS.values()}}
    row.update({"minutesPlayed": minutes, **stats})
    return row


def test_season_rows_position_team_and_totals():
    from players import season_rows
    matches = pd.DataFrame([_game(1, "2026-03-01T08:00:00Z"), _game(2, "2026-03-08T08:00:00Z"),
                            _game(3, "2026-03-15T08:00:00Z")])
    players = pd.DataFrame([
        _row(1, 7, "Eels", "Centre", tries=2, points=8, tacklesMade=10),
        _row(2, 7, "Eels", "Winger", tries=1, points=4, tacklesMade=5),
        _row(3, 7, "Storm", "Winger", tacklesMade=1),            # traded: team follows his last game
        _row(1, 8, "Eels", "Interchange", minutes=20, errors=1),  # bench only
        _row(2, 8, "Eels", "Interchange", minutes=0),             # named, never took the field: not a game
        _row(1, 9, "Eels", "Prop"), _row(2, 9, "Eels", "Lock"),   # 1-1 tie: the latest start wins
    ])
    out = season_rows(players, matches, 2026).set_index("player_id")
    assert out.loc[7, ["team", "position", "games", "tries", "points", "tackles"]].tolist() == ["Storm", "Winger", 3, 3, 12, 16]
    assert out.loc[8, ["position", "games", "errors"]].tolist() == ["Interchange", 1, 1]
    assert out.loc[9, "position"] == "Lock"


def test_season_rows_empty_season():
    from players import SEASON_COLS, season_rows
    out = season_rows(pd.DataFrame([_row(1, 7, "Eels", "Centre")]), pd.DataFrame([_game(1, "2026-03-01T08:00:00Z")]), 2027)
    assert out.empty and list(out.columns) == SEASON_COLS
