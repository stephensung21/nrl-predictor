"""
Leakage test: a match's features must not depend on its own result or on any later game.

For a handful of target matches, the inputs are cut back to what was known at kickoff:
- later scraped matches, team stats and player stats are removed;
- later odds-sheet games keep their fixture (the draw is published before the season)
  but lose their results;
- the target match's own scores, team stats and player stats (including minutes played)
  are replaced with noise.
The features rebuilt from those inputs must equal the features from the full data.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from elo import load_params  # noqa: E402
from features import FORM_STATS, ORIGIN_WINDOW_DAYS, build_features, feature_columns, load_inputs  # noqa: E402
from ingest import join_odds_to_matches  # noqa: E402

FEATURES = feature_columns()  # the core features (experimental ones too if features.EXPERIMENTAL is set)
# Player columns only known after the match. The line-up must come from the named 17, so even
# who got minutes is scrambled.
PLAYER_RESULT_COLS = ["fantasyPointsTotal", "minutesPlayed", "conversionAttempts"]


@pytest.fixture(scope="module")
def full():
    matches, team_stats, players, odds, origin, reserve = load_inputs()
    params = load_params(odds)
    feats = build_features(matches, team_stats, players, odds, origin, elo_params=params,
                           reserve=reserve).set_index("match_id")
    return matches, team_stats, players, odds, origin, reserve, params, feats


def pick_targets(feats):
    """A spread of matches: early-season (season carry-over), mid-season, finals, a neutral venue."""
    f = feats.reset_index()
    picks = [
        f[(f["season"] == 2022) & (f["round"] == 2)].iloc[0],
        f[(f["season"] == 2023) & (f["round"] == 14)].iloc[0],
        f[(f["season"] == 2024) & (f["is_final"] == 1)].iloc[0],
        f[(f["season"] == 2025) & (f["neutral"] == 1)].iloc[0],
        f[f["season"] == 2026].iloc[-1],  # grand final
    ]
    return [int(p["match_id"]) for p in picks]


def truncate_and_scramble(matches, team_stats, players, odds, origin, reserve, match_id, rng):
    kickoff = pd.to_datetime(matches["start_time_utc"], utc=True)
    t = kickoff[matches["match_id"] == match_id].iloc[0]
    keep_ids = set(matches.loc[kickoff <= t, "match_id"])

    m = matches[matches["match_id"].isin(keep_ids)].astype({"home_score": float, "away_score": float})
    ts = team_stats[team_stats["match_id"].isin(keep_ids)].astype({c: float for c in FORM_STATS})
    pl = players[players["match_id"].isin(keep_ids)].astype({c: float for c in PLAYER_RESULT_COLS})
    o = odds.copy()
    # Origin squads are named in advance, so games up to the window after kickoff may be used.
    origin_kickoff = pd.to_datetime(origin["start_time_utc"], utc=True)
    og = origin[origin_kickoff <= t + pd.Timedelta(days=ORIGIN_WINDOW_DAYS)]
    # Reserve grade: only games that started before the target's kickoff.
    rg = None if reserve is None else reserve[reserve["start_time_utc"] < t]

    # Odds sheet: later games keep their fixture but lose their results.
    target_odds_id = join_odds_to_matches(matches[matches["match_id"] == match_id], odds)["odds_id"].iloc[0]
    later = o["odds_id"] > target_odds_id
    o.loc[later, ["home_score", "away_score"]] = np.nan

    # Target match: replace its own outcome and stats with noise.
    hs, as_ = rng.integers(0, 60, size=2)
    m.loc[m["match_id"] == match_id, ["home_score", "away_score"]] = [hs, as_]
    o.loc[o["odds_id"] == target_odds_id, ["home_score", "away_score"]] = [hs, as_]
    is_target = ts["match_id"] == match_id
    ts.loc[is_target, FORM_STATS] = rng.uniform(0, 2000, size=(is_target.sum(), len(FORM_STATS)))
    is_target = pl["match_id"] == match_id
    pl.loc[is_target, PLAYER_RESULT_COLS] = rng.integers(0, 150, size=(is_target.sum(), len(PLAYER_RESULT_COLS)))
    pl.loc[is_target, "minutesPlayed"] = rng.choice([0, 80], size=is_target.sum())  # half "didn't play"
    return m, ts, pl, o, og, rg


@pytest.mark.slow
def test_features_ignore_own_result_and_later_games(full):
    matches, team_stats, players, odds, origin, reserve, params, feats = full
    rng = np.random.default_rng(0)
    for match_id in pick_targets(feats):
        inputs = truncate_and_scramble(matches, team_stats, players, odds, origin, reserve, match_id, rng)
        rebuilt = build_features(*inputs[:5], elo_params=params, reserve=inputs[5]).set_index("match_id")
        expected = feats.loc[match_id, FEATURES].astype(float)
        got = rebuilt.loc[match_id, FEATURES].astype(float)
        diff = ~np.isclose(expected, got, equal_nan=True)
        assert not diff.any(), f"match {match_id} leaks via {list(np.array(FEATURES)[diff])}"


@pytest.mark.slow
def test_scrambling_changes_targets(full):
    """Guard against a vacuous pass: the scramble must actually reach the target's outcome."""
    matches, team_stats, players, odds, origin, reserve, params, feats = full
    match_id = pick_targets(feats)[1]
    inputs = truncate_and_scramble(matches, team_stats, players, odds, origin, reserve, match_id, np.random.default_rng(1))
    rebuilt = build_features(*inputs[:5], elo_params=params, reserve=inputs[5]).set_index("match_id")
    assert rebuilt.loc[match_id, "margin"] != feats.loc[match_id, "margin"]
