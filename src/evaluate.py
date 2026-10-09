"""
Evaluation: metrics, the benchmarks, the paired bootstrap and feature importance.
"""

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, mean_absolute_error

import config


def evaluate(test, p=None, margin=None, total=None):
    """One row of metrics. Any prediction can be None (benchmark doesn't provide it)."""
    row = {"games": len(test)}
    if p is not None:
        p = np.asarray(p, dtype=float)
        y = test["home_win"].to_numpy()
        row.update(log_loss=log_loss(y, p, labels=[0, 1]), brier=brier_score_loss(y, p),
                   accuracy=accuracy_score(y, p > 0.5))
    if margin is not None:
        row["margin_mae"] = mean_absolute_error(test["margin"], margin)
    if total is not None:
        row["total_mae"] = mean_absolute_error(test["total"], total)
    if margin is not None and total is not None:
        home = (np.asarray(total) + np.asarray(margin)) / 2
        away = (np.asarray(total) - np.asarray(margin)) / 2
        row["score_mae"] = (mean_absolute_error(test["home_score"], home)
                            + mean_absolute_error(test["away_score"], away)) / 2
    return row


def baseline_preds(train, test):
    """'Always home' benchmark: the training seasons' home-win rate, mean margin and mean total."""
    return pd.DataFrame({t: train[t].mean() for t in config.TARGETS}, index=test.index)


def results_table(test, preds, baseline, closing):
    """Models and benchmarks scored on the same games. `closing` = (prob, line, total) columns."""
    rows = {}
    for col in preds.columns:
        variant, model, target = col.split("|")
        if target == "home_win":
            key = f"{config.VARIANT_LABEL[variant]}: {model}"
            rows[key] = evaluate(test, preds[col], preds[f"{variant}|{model}|margin"],
                                 preds[f"{variant}|{model}|total"])
    rows["Benchmark: home team"] = evaluate(test, baseline["home_win"], baseline["margin"], baseline["total"])
    rows["Benchmark: Elo only"] = evaluate(test, test["elo_prob"])
    rows["Benchmark: market opening"] = evaluate(test, test["p_open"], -test["open_line"], test["open_total"])
    prob, line, tot = closing
    rows[f"Benchmark: market closing ({prob})"] = evaluate(
        test, test[prob], -test[line] if line else None, test[tot] if tot else None)
    return pd.DataFrame(rows).T.rename_axis("model")


def importance(fitted, test):
    """Standardised linear coefficients and mean |SHAP| (LightGBM pred_contrib) on the test season."""
    out = []
    for (variant, target), (lin, lin_feats, gbm, gbm_feats) in fitted.items():
        if target == "total":
            continue
        coef = pd.Series(np.ravel(lin[-1].coef_), index=lin_feats, name="linear_coef")
        contrib = np.mean([g.predict(test[gbm_feats], pred_contrib=True)[:, :-1] for g in gbm], axis=0)
        shap = pd.Series(np.abs(contrib).mean(axis=0), index=gbm_feats, name="lightgbm_mean_abs_shap")
        both = pd.concat([coef, shap], axis=1).rename_axis("feature").reset_index()
        out.append(both.assign(variant=variant, target=target))
    cols = ["variant", "target", "feature", "linear_coef", "lightgbm_mean_abs_shap"]
    return pd.concat(out, ignore_index=True)[cols]


def bootstrap_diff(y, p_model, p_bench, seed=None):
    """Paired bootstrap of the per-game log-loss difference (model - benchmark; negative = model better)."""
    y = np.asarray(y)
    pm = np.clip(np.asarray(p_model), 1e-6, 1 - 1e-6)
    pb = np.clip(np.asarray(p_bench), 1e-6, 1 - 1e-6)
    diff = -(y * np.log(pm) + (1 - y) * np.log(1 - pm)) + (y * np.log(pb) + (1 - y) * np.log(1 - pb))
    rng = np.random.default_rng(config.SEED if seed is None else seed)
    boot = diff[rng.integers(0, len(diff), size=(config.N_BOOTSTRAP, len(diff)))].mean(axis=1)
    return {"games": len(diff), "mean_diff": diff.mean(), "ci_low": np.percentile(boot, 2.5),
            "ci_high": np.percentile(boot, 97.5), "p_model_better": (boot < 0).mean()}
