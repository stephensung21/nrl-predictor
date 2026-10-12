"""
Tests for what drove each prediction (src/explain.py) and the match briefs (pipeline/brief.py):
- the parts add up: baseline + every feature gives the ensemble's predicted margin exactly, and with
  the calibration row the published win probability, for both model variants;
- a brief's sections: which side each driver favours, sections left out when there's no data;
- the grounding check: numbers in a text must be in its facts;
- (slow) a replayed Tuesday run records the same drivers and briefs twice.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))

import common  # noqa: E402,F401  (puts src/ on the path)
import brief  # noqa: E402
import config  # noqa: E402
import explain  # noqa: E402
import predict  # noqa: E402
from features import logit  # noqa: E402
from models import predict_models  # noqa: E402


@pytest.fixture(scope="module")
def round_rows():
    """2026 Round 10's model rows from features.csv and the 2026 models' predictions of them."""
    if not (config.PROCESSED / "features.csv").exists():  # not committed: CI doesn't build the features
        pytest.skip("needs data/processed/features.csv (python src/features.py)")
    bundle = predict.load_bundle(2026)
    f = pd.read_csv(config.PROCESSED / "features.csv")
    rows = f[(f["season"] == 2026) & (f["round"] == 10)].set_index("match_id")
    preds = predict_models(bundle, rows)
    return bundle, rows, preds


@pytest.mark.parametrize("variant", ["with_odds", "no_odds"])
def test_the_parts_add_up_to_the_prediction(round_rows, variant):
    bundle, rows, preds = round_rows
    rows = rows[rows["open_logit"].notna()] if variant == "with_odds" else rows
    prob = preds.loc[rows.index, f"{variant}|ensemble|home_win"]
    d = explain.explain(bundle, rows, pd.Series(variant, index=rows.index), prob)
    total = d.groupby("match_id")[["margin_pts", "win_logodds"]].sum()
    np.testing.assert_allclose(total["margin_pts"], preds.loc[total.index, f"{variant}|ensemble|margin"], atol=1e-9)
    np.testing.assert_allclose(total["win_logodds"], logit(prob.loc[total.index]), atol=1e-9)
    # Every model input appears once per game, plus the baseline and calibration rows.
    m = bundle["models"][(variant, "margin")]
    feats = set(m["linear_features"] + m["lightgbm_features"] + bundle["models"][(variant, "home_win")]["linear_features"])
    per_game = d.groupby("match_id")["feature"].apply(set)
    assert all(feats | {explain.BASELINE, explain.CALIBRATION} == s for s in per_game)
    assert not d["group"].eq("other").any()  # every input has a readable group


def test_mixed_variants_are_each_explained_by_their_own_model(round_rows):
    bundle, rows, preds = round_rows
    variants = pd.Series(np.where(rows["open_logit"].notna(), "with_odds", "no_odds"), index=rows.index)
    variants.iloc[0] = "no_odds"
    d = explain.explain(bundle, rows, variants)
    got = d.groupby("match_id")["margin_pts"].sum()
    want = [preds.loc[mid, f"{v}|ensemble|margin"] for mid, v in variants.items()]
    np.testing.assert_allclose(got.loc[variants.index], want, atol=1e-9)
    assert not d[d["match_id"] == rows.index[0]]["group"].eq("market").any()  # no odds, no market driver


# ---------------------------------------------------------------- briefs

PRED = {"run_id": "tue", "match_id": 1, "season": 2027, "round": 1, "created_at": "2027-03-02 07:15",
        "start_time_utc": pd.Timestamp("2027-03-05 09:00", tz="UTC"), "home_team": "Storm", "away_team": "Broncos",
        "home_win_prob": 0.3, "margin": -6.04, "total": 41.96, "home_score": 18, "away_score": 24, "tip": "Broncos",
        "model": "with odds", "no_odds_home_win_prob": 0.35, "model_version": "2027.1"}
DRIVERS = pd.DataFrame([
    {"match_id": 1, "variant": "with_odds", "group": "lineup", "feature": "diff_rapm_total", "value": -2,
     "margin_pts": -5.0, "win_logodds": -0.5},
    {"match_id": 1, "variant": "with_odds", "group": "lineup", "feature": "diff_rapm_vs_usual", "value": -1,
     "margin_pts": -1.5, "win_logodds": -0.1},
    {"match_id": 1, "variant": "with_odds", "group": "market", "feature": "open_logit", "value": -0.4,
     "margin_pts": -3.0, "win_logodds": -0.3},
    {"match_id": 1, "variant": "with_odds", "group": "market", "feature": "open_logit_bluebet", "value": -0.4,
     "margin_pts": 0.5, "win_logodds": 0.05},
    {"match_id": 1, "variant": "with_odds", "group": "strength", "feature": "elo_logit", "value": 0.1,
     "margin_pts": 0.66, "win_logodds": 0.05},
    {"match_id": 1, "variant": "with_odds", "group": "baseline", "feature": explain.BASELINE, "value": None,
     "margin_pts": 2.8, "win_logodds": 0.3}])


def test_a_brief_says_which_side_each_driver_favours():
    b = brief.build(PRED, {"p_open": 0.4, "open_line": 3.5, "elo_prob": 0.55}, drivers=DRIVERS)
    s = b["sections"]
    assert s["prediction"]["model_tip"] == "Broncos" and s["prediction"]["model_win_chance_pct"] == 70
    assert s["prediction"]["predicted_margin_pts"] == 6.0 and s["prediction"]["margin_favours"] == "Broncos"
    d = s["drivers"]
    assert d["home_side_average_edge_pts"] == 2.8
    assert [(x["driver"], x["points"], x["favours"]) for x in d["drivers"]] == [
        ("Line-up strength", 6.5, "Broncos"), ("The market's opening price", 2.5, "Broncos"),
        ("Team strength (Elo and team rating)", 0.7, "Storm")]
    # The BlueBet adjustment is read as part of the opening price, so the market has one part, not two.
    assert "parts" not in d["drivers"][1] and len(d["drivers"][0]["parts"]) == 2
    assert s["market"]["model_minus_market_home_pct_points"] == -10 and s["market"]["market_favourite"] == "Broncos"


def test_a_brief_names_the_star_players_out():
    stars = pd.DataFrame([
        {"match_id": 1, "variant": "with_odds", "group": "stars", "feature": "diff_s2_stars_out_spine", "value": -1,
         "margin_pts": -1.2, "win_logodds": -0.1, "players": '[{"team": "Storm", "name": "Jahrome Hughes"}]'},
        {"match_id": 1, "variant": "with_odds", "group": "stars", "feature": "diff_s2_stars_out_other", "value": 0,
         "margin_pts": 0.3, "win_logodds": 0.02,
         "players": '[{"team": "Storm", "name": "Eli Katoa"}, {"team": "Broncos", "name": "Payne Haas"}]'}])
    b = brief.build(PRED, {"p_open": 0.4, "open_line": 3.5, "elo_prob": 0.55},
                    drivers=pd.concat([DRIVERS.assign(players=None), stars], ignore_index=True))
    d = {x["driver"]: x for x in b["sections"]["drivers"]["drivers"]}
    assert d["Star absences"]["players_out"] == {"Storm": ["Jahrome Hughes", "Eli Katoa"], "Broncos": ["Payne Haas"]}
    assert "players_out" not in d["Line-up strength"]


@pytest.mark.slow
def test_the_star_players_out_are_the_ones_the_model_counted():
    bundle = predict.load_bundle(2026)
    fixtures, lists = predict.replay_round(2026, 10)
    out, rows, _, _ = predict.predict_fixtures(fixtures, lists, bundle, keep_weather=True)
    d = explain.explain(bundle, rows, predict.variant_of(out), out.set_index("match_id")["home_win_prob"])
    for mid, r in rows.iterrows():
        for feature, spine in explain.STAR_FEATURES.items():
            named = [p for p in r["stars_out"] if p["spine"] == spine]
            home = sum(p["team"] == r["home_team"] for p in named)
            assert home - (len(named) - home) == r[feature]  # the input is home minus away
            cell = d[(d["match_id"] == mid) & (d["feature"] == feature)]["players"]
            if feature in bundle["models"][(predict.variant_of(out)[mid], "margin")]["linear_features"]:
                shown = json.loads(cell.iloc[0]) if cell.notna().any() else []
                assert sorted(p["name"] for p in shown) == sorted(p["player_name"] for p in named)
    assert d.loc[~d["feature"].isin(explain.STAR_FEATURES), "players"].isna().all()


def test_sections_without_data_are_left_out():
    b = brief.build(PRED, {})
    assert set(b["sections"]) == {"prediction"}
    assert b["run_id"] == "tue" and b["brief_version"] == brief.BRIEF_VERSION


def test_the_grounding_check():
    facts = {"prediction": {"model_win_chance_pct": 70, "predicted_margin_pts": 6.0},
             "form": {"last_5": {"Storm": ["W 24-16 v Eels"]}}, "drivers": [{"points": 6.5}]}
    assert brief.ungrounded("Broncos 70% to win by 6, after the Storm beat the Eels 24-16; line-ups 6.5.", facts) == []
    assert brief.ungrounded("Broncos 72% to win by 7.", facts) == [72.0, 7.0]


# ---------------------------------------------------------------- end to end

@pytest.mark.slow
def test_a_replayed_run_records_the_same_drivers_and_briefs_twice(tmp_path):
    import run
    from common import Records
    out = []
    for i in range(2):
        rec = Records(2026, replay=True, root=tmp_path / str(i))
        job = run.run_job("predict", 2026, as_of="2026-05-05 17:15", records=rec)
        assert job["explained"] == job["games"] and not any("briefs failed" in w for w in job.get("warnings", []))
        out.append((rec.drivers().drop(columns="run_id"), [dict(b, run_id=None) for b in rec.briefs()], rec.predictions()))
    pd.testing.assert_frame_equal(out[0][0], out[1][0])
    assert out[0][1] == out[1][1]
    # The drivers add up to the recorded predictions.
    total = out[0][0].groupby("match_id")["margin_pts"].sum()
    np.testing.assert_allclose(total, out[0][2].set_index("match_id").loc[total.index, "margin"], atol=1e-9)
