"""
What drove each prediction (PLAN_WEB.md §7.1): every feature's contribution, from the same frozen
models that made the prediction, so the explanation can't drift from it.

The main model is the 50/50 ensemble of a linear model and LightGBM, so each half is split up and the
halves averaged:
- linear: exact. On the scaled inputs the prediction is the intercept plus coefficient x value, so each
  feature contributes its coefficient times its scaled value (its distance from the training mean).
- LightGBM: SHAP values from LightGBM's own pred_contrib, averaged over the seeds. They add up to the
  raw prediction with the bias term.

Two scales, one row per feature:
- margin_pts: points of predicted home margin, from the margin models. Exact: the baseline plus every
  feature gives the ensemble's predicted margin.
- win_logodds: log-odds of a home win, from the win models before calibration. The ensemble averages
  calibrated probabilities and blends in the margin model (MARGIN_BLEND), which isn't additive, so the
  difference between the raw parts and the final probability is its own row, "calibration".
Positive numbers favour the home team.

Usage (a check on a past round):
    python src/explain.py --season 2026 --round 10
"""

import argparse

import numpy as np
import pandas as pd

from features import FEATURE_GROUPS, logit

BASELINE, CALIBRATION = "(baseline)", "(calibration)"

# Readable groups for the ~20 model inputs (PLAN_WEB.md §7.1). Anything not named falls back to its
# feature group in features.FEATURE_GROUPS.
GROUP_LABELS = {
    "market": "The market's opening price",
    "strength": "Team strength (Elo and team rating)",
    "lineup": "Line-up strength",
    "stars": "Star absences",
    "form": "Recent form",
    "context": "Rest, travel and venue",
    "conditions": "Conditions",
    "baseline": "Home side's average edge",
    "calibration": "Calibration",
    "other": "Other",
}
FEATURE_GROUP = {
    "open_logit": "market", "open_line": "market", "open_total": "market", "bluebet": "market",
    "open_logit_bluebet": "market",
    "elo_logit": "strength", "team_margin": "strength",
    "diff_s2_stars_out_spine": "stars", "diff_s2_stars_out_other": "stars",
    "wet_conditions": "conditions",
}
FALLBACK_GROUP = {"elo": "strength", "form": "form", "context": "context", "player": "lineup", "odds": "market"}
FEATURE_LABELS = {
    "open_logit": "opening price", "open_line": "opening line", "open_total": "opening total",
    # The BlueBet inputs adjust the opening price for the 2024 bookmaker change: read as part of the price.
    "bluebet": "opening price", "open_logit_bluebet": "opening price",
    "elo_logit": "Elo ratings", "team_margin": "team margin rating",
    "diff_rapm_total": "named 17's player ratings", "diff_rapm_defence": "named 17's defence",
    "diff_rapm_attack": "named 17's attack", "diff_rapm_vs_usual": "line-up against its usual strength",
    "diff_rapm_missing": "usual players missing", "diff_rookies": "rookies named",
    "diff_s2_stars_out_spine": "stars out in the spine", "diff_s2_stars_out_other": "stars out elsewhere",
    "diff_rest_days": "days of rest", "home_travel": "home side playing outside its state", "away_travel": "away side playing outside its state",
    "neutral": "neutral venue", "is_final": "finals game", "origin_period": "Origin period",
    "wet_conditions": "wet conditions",
}
COLS = ["match_id", "variant", "group", "feature", "value", "margin_pts", "win_logodds"]


def group_of(feature):
    if feature in FEATURE_GROUP:
        return FEATURE_GROUP[feature]
    if feature == BASELINE:
        return "baseline"
    if feature == CALIBRATION:
        return "calibration"
    for name, feats in FEATURE_GROUPS.items():
        if feature in feats:
            return FALLBACK_GROUP.get(name, "other")
    return "other"


def linear_parts(pipe, X):
    """Exact contributions of a fitted imputer-scaler-linear pipeline: (per-feature frame, intercept)."""
    z = pipe[:-1].transform(X)
    est = pipe[-1]
    coef = np.ravel(est.coef_)
    return pd.DataFrame(z * coef, index=X.index, columns=X.columns), float(np.ravel(est.intercept_)[0])


def lgb_parts(boosters, X):
    """SHAP values averaged over the seeds: (per-feature frame, bias per row)."""
    contrib = np.mean([b.predict(X, pred_contrib=True) for b in boosters], axis=0)
    return pd.DataFrame(contrib[:, :-1], index=X.index, columns=X.columns), contrib[:, -1]


def ensemble_parts(m, rows):
    """A target's ensemble (linear + LightGBM) / 2, split into per-feature parts and a baseline per row,
    on the models' raw scale (margin points, or log-odds before calibration for the win model)."""
    lin, lin_base = linear_parts(m["linear"], rows[m["linear_features"]])
    gbm, gbm_base = lgb_parts(m["lightgbm"], rows[m["lightgbm_features"]])
    feats = list(dict.fromkeys(m["linear_features"] + m["lightgbm_features"]))
    parts = (lin.reindex(columns=feats, fill_value=0.0) + gbm.reindex(columns=feats, fill_value=0.0)) / 2
    return parts, (lin_base + gbm_base) / 2


def explain(bundle, rows, variants, final_prob=None):
    """Drivers for each row (indexed by match_id) with the variant that predicted it.

    `variants` gives each row's variant ("with_odds" or "no_odds"); `final_prob` the published home-win
    probability, so the calibration row closes the gap to it. Returns one row per game and feature, plus
    a baseline row and (with final_prob) a calibration row, in COLS."""
    variants = pd.Series(variants, index=rows.index)
    out = []
    for variant in variants.unique():
        sub = rows[(variants == variant).to_numpy()]
        margin, m_base = ensemble_parts(bundle["models"][(variant, "margin")], sub)
        win, w_base = ensemble_parts(bundle["models"][(variant, "home_win")], sub)
        feats = list(dict.fromkeys(list(margin.columns) + list(win.columns)))
        margin, win = margin.reindex(columns=feats, fill_value=0.0), win.reindex(columns=feats, fill_value=0.0)
        long = pd.DataFrame({
            "match_id": np.repeat(sub.index.to_numpy(), len(feats)),
            "feature": np.tile(feats, len(sub)),
            "value": sub[feats].to_numpy(float).ravel(),
            "margin_pts": margin.to_numpy().ravel(),
            "win_logodds": win.to_numpy().ravel(),
        })
        base = pd.DataFrame({"match_id": sub.index.to_numpy(), "feature": BASELINE, "value": np.nan,
                             "margin_pts": np.broadcast_to(m_base, len(sub)),
                             "win_logodds": np.broadcast_to(w_base, len(sub))})
        parts = [long, base]
        if final_prob is not None:
            raw = win.sum(axis=1).to_numpy() + w_base
            final = logit(np.asarray(pd.Series(final_prob, index=rows.index).loc[sub.index], float))
            parts.append(pd.DataFrame({"match_id": sub.index.to_numpy(), "feature": CALIBRATION, "value": np.nan,
                                       "margin_pts": 0.0, "win_logodds": final - raw}))
        out.append(pd.concat(parts, ignore_index=True).assign(variant=variant))
    drivers = pd.concat(out, ignore_index=True)
    drivers["group"] = drivers["feature"].map(group_of)
    return drivers[COLS]


def by_group(drivers):
    """Contributions per game and readable group (baseline and calibration kept as their own groups)."""
    g = drivers.groupby(["match_id", "group"], as_index=False)[["margin_pts", "win_logodds"]].sum()
    g["label"] = g["group"].map(GROUP_LABELS)
    return g


def main():
    import warnings

    import predict
    warnings.filterwarnings("ignore")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--round", type=int, required=True)
    parser.add_argument("--models", type=int, help="model season to load (default: --season)")
    args = parser.parse_args()
    bundle = predict.load_bundle(args.models or args.season)
    fixtures, lists = predict.replay_round(args.season, args.round)
    out, rows, _, _ = predict.predict_fixtures(fixtures, lists, bundle, keep_weather=True)
    d = explain(bundle, rows, predict.variant_of(out), out.set_index("match_id")["home_win_prob"])
    groups = by_group(d)
    for r in out.itertuples():
        g = groups[groups["match_id"] == r.match_id].sort_values("margin_pts", key=abs, ascending=False)
        print(f"\n{r.home_team} v {r.away_team}: margin {r.margin:+.1f}, home {r.home_win_prob:.0%} ({r.model})")
        for x in g.itertuples():
            print(f"  {x.label:<38} {x.margin_pts:+6.1f} pts  {x.win_logodds:+.3f} log-odds")


if __name__ == "__main__":
    main()
