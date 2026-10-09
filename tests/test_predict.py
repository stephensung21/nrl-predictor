"""
Tests for predict.py: the named-17 rule, display scores, and (slow) that a replayed round's inputs,
with every later result hidden, give exactly the features of the full build.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import config  # noqa: E402
import features  # noqa: E402
import models  # noqa: E402
import predict  # noqa: E402


def team_list(numbers, positions):
    return pd.DataFrame({"match_id": 1, "team": "Storm", "player_id": range(len(numbers)),
                         "jersey_number": numbers, "position": positions})


def test_named_17_from_a_tuesday_squad_with_six_interchange():
    numbers = list(range(1, 23))
    positions = ["Fullback"] * 13 + ["Interchange"] * 6 + ["Reserve"] * 3  # 2026 style: 14-19 interchange
    named = features.named_from_list(team_list(numbers, positions))
    assert sorted(named["jersey_number"]) == list(range(1, 18))


def test_named_17_from_a_final_list_keeps_late_replacements():
    numbers = list(range(1, 17)) + [20, 18, 19]  # number 17 withdrew; 20 came in
    positions = ["Fullback"] * 13 + ["Interchange"] * 4 + ["Reserve"] * 2
    named = features.named_from_list(team_list(numbers, positions))
    assert len(named) == 17 and 20 in set(named["jersey_number"])


def test_display_scores_never_contradict_the_tip():
    p_home = np.array([0.55, 0.45, 0.70])
    margin = np.array([-0.4, 0.3, 10.0])  # the first two disagree with the win probability
    total = np.array([40.0, 40.0, 44.0])
    home, away = predict.display_scores(p_home, margin, total)
    assert home[0] > away[0] and away[1] > home[1]
    assert (home[2], away[2]) == (27, 17)


@pytest.mark.slow
def test_replayed_round_has_the_full_builds_features():
    """Round 10 of 2026 as of its first kickoff (results hidden, archived Tuesday lists) must give
    the same features as the full build from the same lists: nothing from the round leaks in."""
    fixtures, lists = predict.replay_round(2026, 10)
    named = predict.named_17(lists).groupby(["match_id", "team"]).size().eq(17).groupby(level=0).sum().eq(2)
    ready = fixtures[fixtures["match_id"].isin(named[named].index)]
    inputs = predict.inputs_before(ready, keep_weather=True)
    replay = features.build_features(*inputs[:5], elo_params=features.load_params(inputs[3]), reserve=inputs[5],
                                     pre_kickoff=lists).set_index("match_id").loc[ready["match_id"]]
    m, t, p, o, origin, reserve = features.load_inputs()
    full = features.build_features(m, t, p, o, origin, elo_params=features.load_params(o), reserve=reserve,
                                   pre_kickoff=pd.read_csv(features.PRE_KICKOFF_FILE))
    full = full.set_index("match_id").loc[ready["match_id"]]
    # The models' inputs (some unused team-news features need the final 17 and are empty before kickoff).
    cols = sorted(set(models.lgb_features(True)) | set(config.FEATURE_GROUPS["odds"])
                  | {f for fs in config.LINEAR_FEATURES.values() for f in fs})
    assert replay[cols].notna().all().all()
    np.testing.assert_allclose(replay[cols].to_numpy(float), full[cols].to_numpy(float), atol=1e-6)
