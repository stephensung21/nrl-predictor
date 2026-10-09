"""
Train and evaluate the match models.

Walk-forward cross-validation on 2021-2024 (train on earlier seasons, test on the next),
tuning, Platt calibration, and an evaluation on the 2025 dev season against benchmarks.
The 2026 season is only touched by --final, which refits on 2021-2025 using the settings
chosen in the dev run and scores 2026 once against closing odds.

--backtest repeats the whole development procedure (selection, tuning, calibration) for
each of 2023-2025 using only earlier seasons, then predicts that season: about 630
out-of-sample games instead of 212, and a check that feature selection is stable.

Usage:
    python src/train.py              # -> reports/dev_2025.md, reports/params.json, ...
    python src/train.py --backtest   # -> reports/backtest.md
    python src/train.py --final      # ONE-TIME -> reports/final_2026.md
"""

import argparse
import json
import warnings

import lightgbm as lgb
import numpy as np
import optuna
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, mean_absolute_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from scipy.stats import norm

from features import FEATURE_GROUPS, MIN_HISTORY, logit
from ingest import PROCESSED, ROOT

REPORTS = ROOT / "reports"
PARAMS_OUT = REPORTS / "params.json"
FINAL_LOCK = REPORTS / "final.lock"

FIRST_SEASON = 2021
CV_SEASONS = [2022, 2023, 2024]
DEV_SEASON, TEST_SEASON = 2025, 2026
BACKTEST_SEASONS = [2023, 2024, 2025]
N_BOOTSTRAP = 10000

TARGETS = {"home_win": "clf", "margin": "reg", "total": "reg"}
C_GRID = np.logspace(-3, 1, 9)        # logistic regression
ALPHA_GRID = np.logspace(-1, 4, 11)   # ridge
N_TRIALS = 60                         # Optuna trials per LightGBM model
SEED = 0
MIN_GAIN = {"clf": 0.001, "reg": 0.01}
# The linear win probability is the average of the logistic model and the margin model's
# P(margin > 0) = Phi(predicted margin / sigma), sigma from out-of-fold margin errors: margins carry
# more information than win/loss (both parts improved the 2023-2025 backtest; see experiments.py).
MARGIN_BLEND = True  # forward selection: minimum pooled CV gain (log loss / MAE points)

# Fixed linear feature sets: the features chosen consistently across the 2023-2025 backtest's
# forward selection, plus the team margin rating (win), star absences (win, margin) and the
# wet-conditions flag (totals).
# Selecting per season from 1-3 CV seasons overfit, so it is off by default (--select turns it
# back on). The with-odds models add the opening odds to each set.
FEATURE_SELECTION = False
# Star absences (S2): the team's usual players who are missing and were in an Origin 17 in the last
# 12 months or are in the top 10% of their position for form, split into spine and other positions.
STAR_ABSENCES = ["diff_s2_stars_out_spine", "diff_s2_stars_out_other"]
LINEAR_FEATURES = {
    "home_win": ["elo_logit", "diff_rapm_total", "diff_rapm_defence", "diff_rapm_vs_usual", "team_margin"] + STAR_ABSENCES,
    "margin": ["elo_logit", "diff_rapm_total", "diff_rapm_defence", "diff_rapm_vs_usual"] + STAR_ABSENCES,
    "total": ["rapm_points", "origin_period", "wet_conditions"],
}

# Model variants: the same features with or without the opening odds as inputs.
VARIANTS = ("with_odds", "no_odds")
VARIANT_LABEL = {"with_odds": "With odds", "no_odds": "No odds"}
# Main model type for both variants: the ensemble (50/50 average of linear and LightGBM). It ties
# with the linear model on the pooled backtest and won 2 of the 3 seasons, so it's the more robust
# choice. Every model type is still fitted and reported.
MAIN_MODEL = "ensemble"

# LightGBM: fixed conservative settings on a compact feature set, averaged over several seeds.
# Optuna tuning on the full ~50 features overfit and was unstable (a different random seed moved each
# game's win probability by ~3 points); this setup is ~6x more stable and more accurate on the
# 2023-2025 backtest (see experiments.py --only lightgbm). --tune-lgb restores Optuna tuning.
LGB_TUNING = False
LGB_FIXED = {"max_depth": 2, "num_leaves": 4, "learning_rate": 0.02, "min_child_samples": 40,
             "lambda_l2": 10.0, "feature_fraction": 0.7, "bagging_fraction": 0.8}
LGB_SEEDS = 5
LGB_COMPACT = True
LGB_COMPACT_EXTRA = ["diff_rapm_attack", "diff_rapm_missing", "diff_rookies", "diff_rest_days",
                     "home_travel", "away_travel", "neutral", "is_final"]

BASE = FEATURE_GROUPS["elo"] + FEATURE_GROUPS["form"] + FEATURE_GROUPS["context"]
FEATURE_SETS = {
    "base": BASE,
    "+player": BASE + FEATURE_GROUPS["player"],
    "+odds": BASE + FEATURE_GROUPS["player"] + FEATURE_GROUPS["odds"],
}


# ---------------------------------------------------------------- data and folds

def load_data():
    """Usable games from FIRST_SEASON: both teams have MIN_HISTORY earlier games, and no draws.

    Earlier seasons in features.csv (2020 from the six-again restart) still shape the features
    as history; they only become training rows with --train-from 2020.
    """
    f = pd.read_csv(PROCESSED / "features.csv")
    keep = (f["min_hist"] >= MIN_HISTORY) & ~f["is_draw"] & (f["season"] >= FIRST_SEASON)
    return f[keep].reset_index(drop=True)


def walk_forward(df, test_seasons):
    """Train on every season from 2021 up to the one before, test on the season."""
    for s in test_seasons:
        yield df.index[df["season"].between(FIRST_SEASON, s - 1)], df.index[df["season"] == s]


def score(y, p, kind):
    return log_loss(y, p, labels=[0, 1]) if kind == "clf" else mean_absolute_error(y, p)


# ---------------------------------------------------------------- linear models

def linear(kind, reg):
    """Median imputation and scaling inside the pipeline, so they learn from the training fold only."""
    est = LogisticRegression(C=reg, max_iter=5000) if kind == "clf" else Ridge(alpha=reg)
    return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), est)


def linear_predict(model, X, kind):
    return model.predict_proba(X)[:, 1] if kind == "clf" else model.predict(X)


def cv_linear(df, feats, target, reg, seasons=CV_SEASONS):
    """Pooled out-of-fold score and predictions."""
    kind = TARGETS[target]
    oof = pd.Series(np.nan, index=df.index)
    for tr, te in walk_forward(df, seasons):
        m = linear(kind, reg).fit(df.loc[tr, feats], df.loc[tr, target])
        oof[te] = linear_predict(m, df.loc[te, feats], kind)
    done = oof.notna()
    return score(df.loc[done, target], oof[done], kind), oof


def tune_linear(df, feats, target, seasons=CV_SEASONS):
    grid = C_GRID if TARGETS[target] == "clf" else ALPHA_GRID
    return float(min((cv_linear(df, feats, target, g, seasons)[0], g) for g in grid)[1])


def season_scores(df, oof, target):
    """Out-of-fold score in each walk-forward test season."""
    kind, done = TARGETS[target], oof.notna()
    return df[done].groupby("season").apply(lambda g: score(g[target], oof[g.index], kind))


def base_rate_oof(df, target, seasons=CV_SEASONS):
    """Out-of-fold predictions of the training mean: the score of a model with no features."""
    oof = pd.Series(np.nan, index=df.index)
    for tr, te in walk_forward(df, seasons):
        oof[te] = df.loc[tr, target].mean()
    return oof


def forward_select(df, pool, target="home_win", seasons=CV_SEASONS):
    """Greedy forward selection for the linear model on walk-forward CV.

    A feature is only eligible if adding it (with C / alpha re-tuned) improves the score in
    every CV season, not just the pooled score; of those, the best pooled one is added if it
    gains at least MIN_GAIN for the target's kind. This guards against features that fit one
    season's noise.
    Returns the chosen features and a trace of each step.
    """
    oof = base_rate_oof(df, target, seasons)
    done = oof.notna()
    best, best_seasons = score(df.loc[done, target], oof[done], TARGETS[target]), season_scores(df, oof, target)
    chosen, trace = [], []
    while len(chosen) < len(pool):
        cands = []
        for f in pool:
            if f in chosen:
                continue
            reg = tune_linear(df, chosen + [f], target, seasons)
            pooled, oof = cv_linear(df, chosen + [f], target, reg, seasons)
            by_season = season_scores(df, oof, target)
            if (by_season < best_seasons).all():
                cands.append((pooled, f, by_season))
        if not cands or min(cands, key=lambda c: c[0])[0] > best - MIN_GAIN[TARGETS[target]]:
            break
        best, f, best_seasons = min(cands, key=lambda c: c[0])
        chosen.append(f)
        trace.append({"target": target, "step": len(chosen), "feature": f, "cv_score": best,
                      **{f"cv_{s}": v for s, v in best_seasons.items()}})
        print(f"  + {f:32s} CV {best:.4f}")
    return chosen, pd.DataFrame(trace, columns=["target", "step", "feature", "cv_score"] +
                                [f"cv_{s}" for s in seasons]).set_index("step")


# ---------------------------------------------------------------- LightGBM

def lgb_base(kind):
    return {"objective": "binary" if kind == "clf" else "regression",
            "metric": "binary_logloss" if kind == "clf" else "l1",
            "bagging_freq": 1, "num_threads": 1, "deterministic": True, "seed": SEED, "verbosity": -1}


def cv_lgb(df, feats, target, params, seasons=CV_SEASONS, n_rounds=None):
    """With n_rounds=None each fold stops early on its test season (tuning only, optimistic);
    otherwise every fold trains a fixed number of trees (honest out-of-fold predictions)."""
    kind = TARGETS[target]
    oof, best_iters = pd.Series(np.nan, index=df.index), []
    for tr, te in walk_forward(df, seasons):
        dtrain = lgb.Dataset(df.loc[tr, feats], df.loc[tr, target])
        if n_rounds is None:
            dvalid = lgb.Dataset(df.loc[te, feats], df.loc[te, target], reference=dtrain)
            booster = lgb.train(params, dtrain, num_boost_round=3000, valid_sets=[dvalid],
                                callbacks=[lgb.early_stopping(100, verbose=False)])
            best_iters.append(booster.best_iteration)
        else:
            booster = lgb.train(params, dtrain, num_boost_round=n_rounds)
        oof[te] = booster.predict(df.loc[te, feats], num_iteration=booster.best_iteration or None)
    done = oof.notna()
    rounds = n_rounds if n_rounds is not None else max(1, int(round(np.mean(best_iters))))
    return score(df.loc[done, target], oof[done], kind), oof, rounds


def tune_lgb(df, feats, target, seasons=CV_SEASONS, sampler_seed=SEED):
    kind = TARGETS[target]

    def objective(trial):
        params = {
            **lgb_base(kind),
            "max_depth": trial.suggest_int("max_depth", 2, 4),
            "num_leaves": trial.suggest_int("num_leaves", 3, 16),
            "min_child_samples": trial.suggest_int("min_child_samples", 10, 80),
            "learning_rate": trial.suggest_float("learning_rate", 0.005, 0.1, log=True),
            "lambda_l2": trial.suggest_float("lambda_l2", 1e-3, 50, log=True),
            "feature_fraction": trial.suggest_float("feature_fraction", 0.4, 1.0),
            "bagging_fraction": trial.suggest_float("bagging_fraction", 0.5, 1.0),
        }
        s, _, rounds = cv_lgb(df, feats, target, params, seasons)
        trial.set_user_attr("rounds", rounds)
        return s

    study = optuna.create_study(direction="minimize", sampler=optuna.samplers.TPESampler(seed=sampler_seed))
    study.optimize(objective, n_trials=N_TRIALS)
    return {**lgb_base(kind), **study.best_params}, study.best_trial.user_attrs["rounds"]


# ---------------------------------------------------------------- calibration

def platt(p_oof, y):
    """Fit Platt scaling on out-of-fold probabilities; returns the calibration function."""
    lr = LogisticRegression(C=1e6).fit(logit(np.asarray(p_oof)).reshape(-1, 1), y)
    return lambda p: lr.predict_proba(logit(np.asarray(p)).reshape(-1, 1))[:, 1]


# ---------------------------------------------------------------- fitting with chosen settings

def fit_predict(df, last_train, test_season, cfg):
    """Fit every model on seasons up to last_train and predict test_season.

    Win probabilities are Platt-calibrated on walk-forward out-of-fold predictions for
    2022..last_train, made with the same fixed settings; with MARGIN_BLEND the linear win
    probability is then averaged with the linear margin model's. Ensembles average the linear
    and LightGBM predictions (calibrated probabilities for the win model); LightGBM itself is the
    average of LGB_SEEDS models with different random seeds.
    """
    train = df[df["season"] <= last_train]
    test = df[df["season"] == test_season]
    return fit_predict_frames(train, test, cfg, list(range(FIRST_SEASON + 1, last_train + 1)))


def fit_predict_frames(train, test, cfg, calib_seasons):
    """fit_predict on explicit training and test rows. Calibration uses walk-forward out-of-fold
    predictions over calib_seasons (complete seasons only), so training rows from the test season's
    earlier rounds (weekly refitting) are used for fitting but not for calibration."""
    preds, fitted = pd.DataFrame(index=test.index), {}

    for variant, fs in cfg["feature_sets"].items():
        gbm_feats = fs["lightgbm"]
        for target, kind in TARGETS.items():
            lin_feats, mc = fs["linear"][target], cfg["models"][variant][target]
            lin = linear(kind, mc["linear"]).fit(train[lin_feats], train[target])
            seeds = [{**mc["lgb"], "seed": s} for s in range(mc.get("lgb_seeds", 1))]
            gbm = [lgb.train(p, lgb.Dataset(train[gbm_feats], train[target]), num_boost_round=mc["lgb_rounds"])
                   for p in seeds]
            p_lin = linear_predict(lin, test[lin_feats], kind)
            p_gbm = np.mean([g.predict(test[gbm_feats]) for g in gbm], axis=0)
            if kind == "clf":
                _, oof_lin = cv_linear(train, lin_feats, target, mc["linear"], calib_seasons)
                oof_gbm = pd.concat([cv_lgb(train, gbm_feats, target, p, calib_seasons, n_rounds=mc["lgb_rounds"])[1]
                                     for p in seeds], axis=1).mean(axis=1)
                done = oof_lin.notna()
                p_lin = platt(oof_lin[done], train.loc[done, target])(p_lin)
                p_gbm = platt(oof_gbm[done], train.loc[done, target])(p_gbm)
            preds[f"{variant}|linear|{target}"] = p_lin
            preds[f"{variant}|lightgbm|{target}"] = p_gbm
            preds[f"{variant}|ensemble|{target}"] = (p_lin + p_gbm) / 2
            fitted[(variant, target)] = (lin, lin_feats, gbm, gbm_feats)
        if MARGIN_BLEND:
            mc, m_feats = cfg["models"][variant]["margin"], fs["linear"]["margin"]
            _, oof = cv_linear(train, m_feats, "margin", mc["linear"], calib_seasons)
            done = oof.notna()
            p_margin = margin_win_prob(preds[f"{variant}|linear|margin"], train.loc[done, "margin"] - oof[done])
            p_lin = (preds[f"{variant}|linear|home_win"] + p_margin) / 2
            preds[f"{variant}|linear|home_win"] = p_lin
            preds[f"{variant}|ensemble|home_win"] = (p_lin + preds[f"{variant}|lightgbm|home_win"]) / 2
    return preds, fitted


def margin_win_prob(margin_pred, oof_residuals):
    """P(home wins) from a predicted margin: Phi(margin / sigma), sigma = SD of out-of-fold errors."""
    return norm.cdf(np.asarray(margin_pred) / np.std(oof_residuals))


# ---------------------------------------------------------------- evaluation

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
    return pd.DataFrame({t: train[t].mean() for t in TARGETS}, index=test.index)


def results_table(test, preds, baseline, closing):
    """Models and benchmarks scored on the same games. `closing` = (prob, line, total) columns."""
    rows = {}
    for col in preds.columns:
        variant, model, target = col.split("|")
        if target == "home_win":
            key = f"{VARIANT_LABEL[variant]}: {model}"
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
        shap = pd.Series(np.abs(contrib).mean(axis=0),
                         index=gbm_feats, name="lightgbm_mean_abs_shap")
        both = pd.concat([coef, shap], axis=1).rename_axis("feature").reset_index()
        out.append(both.assign(variant=variant, target=target))
    cols = ["variant", "target", "feature", "linear_coef", "lightgbm_mean_abs_shap"]
    return pd.concat(out, ignore_index=True)[cols]


def md_table(df, floatfmt="{:.4f}"):
    """Minimal Markdown table (no tabulate dependency). Missing values show as '-'."""
    df = df.rename_axis(df.index.name or "").reset_index()

    def fmt(v):
        if not isinstance(v, float):
            return str(v)
        return "-" if np.isnan(v) else str(int(v)) if v.is_integer() and abs(v) >= 1 else floatfmt.format(v)

    cells = [[fmt(v) for v in row] for row in df.itertuples(index=False)]
    head = "| " + " | ".join(map(str, df.columns)) + " |"
    sep = "|" + "|".join("---" for _ in df.columns) + "|"
    return "\n".join([head, sep] + ["| " + " | ".join(r) + " |" for r in cells])


def bootstrap_diff(y, p_model, p_bench, seed=SEED):
    """Paired bootstrap of the per-game log-loss difference (model - benchmark; negative = model better)."""
    y, pm, pb = np.asarray(y), np.clip(np.asarray(p_model), 1e-6, 1 - 1e-6), np.clip(np.asarray(p_bench), 1e-6, 1 - 1e-6)
    diff = -(y * np.log(pm) + (1 - y) * np.log(1 - pm)) + (y * np.log(pb) + (1 - y) * np.log(1 - pb))
    idx = np.random.default_rng(seed).integers(0, len(diff), size=(N_BOOTSTRAP, len(diff)))
    boot = diff[idx].mean(axis=1)
    return {"games": len(diff), "mean_diff": diff.mean(), "ci_low": np.percentile(boot, 2.5),
            "ci_high": np.percentile(boot, 97.5), "p_model_better": (boot < 0).mean()}


# ---------------------------------------------------------------- development procedure

BOOKMAKER_INPUTS = ["bluebet", "open_logit_bluebet"]


def linear_odds(target):
    """The opening-odds inputs a with-odds linear model gets. The BlueBet inputs fix the win and margin
    models' calibration after the bookmaker change but made the totals model worse, so it doesn't get them."""
    odds = FEATURE_GROUPS["odds"]
    return [f for f in odds if f not in BOOKMAKER_INPUTS] if target == "total" else list(odds)


def lgb_features(compact):
    """LightGBM's features (before odds): the full base + player set, or the compact set of every
    linear-model feature plus LGB_COMPACT_EXTRA."""
    if not compact:
        return list(FEATURE_SETS["+player"])
    return list(dict.fromkeys(sorted({f for fs in LINEAR_FEATURES.values() for f in fs}) + LGB_COMPACT_EXTRA))


def develop(cv_df, cv_seasons):
    """Linear feature sets and tuning on walk-forward CV over cv_seasons. Returns cfg, trace, CV table.

    The linear models use LINEAR_FEATURES, or with FEATURE_SELECTION two selected sets: one
    chosen on win log loss (win and margin models) and one on total-points MAE (total model).
    """
    full, odds = FEATURE_SETS["+player"], FEATURE_GROUPS["odds"]
    if FEATURE_SELECTION:
        selected, traces = {}, []
        for target in ("home_win", "total"):
            print(f"forward selection (linear, {target}), CV {cv_seasons}...")
            selected[target], trace = forward_select(cv_df, full, target, seasons=cv_seasons)
            traces.append(trace)
        trace = pd.concat(traces)
        linear_b = {"home_win": selected["home_win"], "margin": selected["home_win"], "total": selected["total"]}
    else:
        linear_b = {t: list(f) for t, f in LINEAR_FEATURES.items()}
        trace = pd.DataFrame([{"target": t, "step": i + 1, "feature": f}
                              for t in ("home_win", "total") for i, f in enumerate(linear_b[t])]).set_index("step")
    gbm = lgb_features(LGB_COMPACT)
    cfg = {"feature_sets": {"with_odds": {"linear": {t: f + linear_odds(t) for t, f in linear_b.items()},
                                          "lightgbm": gbm + odds},
                            "no_odds": {"linear": linear_b, "lightgbm": gbm}},
           "models": {}}
    cv_rows = {}
    for variant, fs in cfg["feature_sets"].items():
        cfg["models"][variant] = {}
        for target in TARGETS:
            print(f"tuning model {variant} / {target}...")
            reg = tune_linear(cv_df, fs["linear"][target], target, cv_seasons)
            if LGB_TUNING:
                lgb_params, rounds = tune_lgb(cv_df, fs["lightgbm"], target, cv_seasons)
            else:  # fixed settings: only the number of trees is chosen, by walk-forward early stopping
                lgb_params = {**lgb_base(TARGETS[target]), **LGB_FIXED}
                rounds = cv_lgb(cv_df, fs["lightgbm"], target, lgb_params, cv_seasons)[2]
            cfg["models"][variant][target] = {"linear": reg, "lgb": lgb_params, "lgb_rounds": rounds,
                                              "lgb_seeds": 1 if LGB_TUNING else LGB_SEEDS}
            cv_rows[(variant, target, "linear")] = cv_linear(cv_df, fs["linear"][target], target, reg, cv_seasons)[0]
            cv_rows[(variant, target, "lightgbm")] = cv_lgb(cv_df, fs["lightgbm"], target, lgb_params,
                                                            cv_seasons, n_rounds=rounds)[0]
    cv_table = pd.Series(cv_rows).unstack([1])
    cv_table.index = pd.Index([f"{VARIANT_LABEL[v]}: {m}" for v, m in cv_table.index], name="model")
    return cfg, trace, cv_table


# ---------------------------------------------------------------- dev run

def run_dev():
    df = load_data()
    cv_df = df[df["season"] <= max(CV_SEASONS)]
    report = [f"# Dev evaluation ({DEV_SEASON})", "", f"**Main models:** the {MAIN_MODEL} (average of linear and LightGBM) for both variants, with odds and no odds.", ""]

    # 1. Feature-set comparison with logistic / ridge.
    print("comparing feature sets...")
    comparison = {}
    for name, feats in FEATURE_SETS.items():
        c = tune_linear(cv_df, feats, "home_win")
        ll, oof = cv_linear(cv_df, feats, "home_win", c)
        done = oof.notna()
        alpha = tune_linear(cv_df, feats, "margin")
        comparison[name] = {"C": c, "log_loss": ll,
                            "brier": brier_score_loss(cv_df.loc[done, "home_win"], oof[done]),
                            "accuracy": accuracy_score(cv_df.loc[done, "home_win"], oof[done] > 0.5),
                            "margin_mae": cv_linear(cv_df, feats, "margin", alpha)[0]}
    comparison = pd.DataFrame(comparison).T.rename_axis("feature set")
    report += ["## Feature sets (walk-forward CV 2022–2024, logistic / ridge)", "",
               md_table(comparison), ""]

    # 2-3. Forward selection for the linear models (LightGBM keeps the full set), then tuning.
    cfg, trace, cv_table = develop(cv_df, CV_SEASONS)
    full = FEATURE_SETS["+player"]
    if not FEATURE_SELECTION:
        report += ["## Linear model features (fixed)", "",
                   "Fixed sets from the features chosen consistently in the backtest's forward selection. "
                   "The win and margin models use the `home_win` set, the total model the `total` set; "
                   "The with-odds models add the opening odds. LightGBM uses the full set.", "", md_table(trace), ""]
    else:
        report += ["## Forward feature selection (linear models)", "",
               f"Greedy selection from the {len(full)} base + player features on walk-forward CV, adding a "
               f"feature only if it improves the score in every CV season and the pooled score by at least "
               f"{MIN_GAIN['clf']} (log loss, `home_win`) or {MIN_GAIN['reg']} points (MAE, `total`). The win and "
               f"margin models use the `home_win` selection, the total model the `total` one; the with-odds models add the "
               f"opening odds. LightGBM uses the full set.", "",
               md_table(trace), ""]

    report += ["## Tuned models, walk-forward CV 2022–2024", "",
               "Log loss for `home_win`, MAE for `margin` and `total`. LightGBM uses its fixed tuned "
               "number of trees here, so these scores are not inflated by early stopping.", "",
               md_table(cv_table), ""]

    # 4. Dev season.
    print(f"fitting on {FIRST_SEASON}-{max(CV_SEASONS)}, evaluating {DEV_SEASON}...")
    preds, fitted = fit_predict(df, max(CV_SEASONS), DEV_SEASON, cfg)
    train, test = df[df["season"] <= max(CV_SEASONS)], df.loc[preds.index]
    results = results_table(test, preds, baseline_preds(train, test), closing=("p_avg", None, "close_total"))
    report += [f"## {DEV_SEASON} results", "",
               "Win probabilities are Platt-calibrated. Margin and total for the market are the "
               "line (sign flipped) and the total. Closing lines are missing for 2025, so the "
               "closing benchmark is the Odds Portal average price plus the closing total.", "",
               md_table(results), ""]

    imp = importance(fitted, test)
    report += ["## Feature importance (`home_win`, with odds; linear coefficients for the linear model's features only)", "",
               md_table(imp[(imp["variant"] == "with_odds") & (imp["target"] == "home_win")]
                        .drop(columns=["variant", "target"])
                        .sort_values("lightgbm_mean_abs_shap", ascending=False).set_index("feature")), ""]

    REPORTS.mkdir(exist_ok=True)
    PARAMS_OUT.write_text(json.dumps(cfg, indent=2))
    comparison.to_csv(REPORTS / "cv_feature_sets.csv")
    trace.to_csv(REPORTS / "cv_forward_selection.csv")
    imp.to_csv(REPORTS / f"importance_{DEV_SEASON}.csv", index=False)
    save_predictions(test, preds, REPORTS / f"predictions_{DEV_SEASON}.csv")
    (REPORTS / f"dev_{DEV_SEASON}.md").write_text("\n".join(report), encoding="utf-8")
    print(md_table(results))
    print(f"wrote reports/dev_{DEV_SEASON}.md")


# ---------------------------------------------------------------- backtest

def run_backtest():
    """Repeat the development procedure for each backtest season using only earlier seasons."""
    df = load_data()
    df = df[df["season"] <= max(BACKTEST_SEASONS)]  # never touches the 2026 test season
    all_preds, baselines, selections, per_season = [], [], {}, {}

    for season in BACKTEST_SEASONS:
        print(f"\n=== {season}: develop on {FIRST_SEASON}-{season - 1}, predict {season} ===")
        cv_seasons = list(range(FIRST_SEASON + 1, season))
        cfg, trace, _ = develop(df[df["season"] < season], cv_seasons)
        preds, _ = fit_predict(df, season - 1, season, cfg)
        test = df.loc[preds.index]
        baseline = baseline_preds(df[df["season"] < season], test)
        per_season[season] = results_table(test, preds, baseline, ("p_avg", None, None))
        selections[season] = {t: trace.loc[trace["target"] == t, "feature"].tolist() for t in ("home_win", "total")}
        all_preds.append(preds)
        baselines.append(baseline)

    preds, baseline = pd.concat(all_preds), pd.concat(baselines)
    test = df.loc[preds.index]
    pooled = results_table(test, preds, baseline, ("p_avg", None, "close_total"))

    # Paired bootstrap against the market (Odds Portal average) and Elo, pooled over all seasons.
    boots = {}
    for col in [f"{v}|{m}|home_win" for v in VARIANTS for m in ("linear", "ensemble")]:
        variant, model, _ = col.split("|")
        for bench, name in (("p_avg", "market average"), ("p_open", "market opening"), ("elo_prob", "Elo")):
            boots[(f"{VARIANT_LABEL[variant]}: {model}", name)] = bootstrap_diff(test["home_win"], preds[col], test[bench])
    boots = pd.DataFrame(boots).T.rename_axis(["model", "vs"])
    boots.index = [f"{m} vs {b}" for m, b in boots.index]
    boots = boots.rename_axis("comparison")

    # Real closing odds where they exist and are reliable (mostly 2023).
    ok = test["close_ok"].astype(bool)
    closing = results_table(test[ok], preds[ok], baseline[ok], ("p_close", "close_line", "close_total"))
    closing_boot = pd.DataFrame({f"{VARIANT_LABEL[v]}: linear vs market closing": bootstrap_diff(
        test.loc[ok, "home_win"], preds.loc[ok, f"{v}|linear|home_win"], test.loc[ok, "p_close"])
        for v in VARIANTS}).T.rename_axis("comparison")

    pool = FEATURE_SETS["+player"]
    stability = pd.DataFrame({s: [f in sel["home_win"] for f in pool] for s, sel in selections.items()}, index=pool)
    stability = stability[stability.any(axis=1)].astype(int).rename_axis("feature")
    order = pd.DataFrame({t: {s: ", ".join(f"{i + 1}. {f}" for i, f in enumerate(sel[t])) or "(none)"
                              for s, sel in selections.items()} for t in ("home_win", "total")}).rename_axis("season")

    seasons_txt = f"{BACKTEST_SEASONS[0]}–{BACKTEST_SEASONS[-1]}"
    method = "forward selection, " if FEATURE_SELECTION else "fixed linear feature sets, "
    report = [f"# Backtest {seasons_txt}", "", f"**Main models:** the {MAIN_MODEL} (average of linear and LightGBM) for both variants, with odds and no odds.", "",
              f"Training seasons start in {FIRST_SEASON}. For each season, the whole development procedure "
              f"({method}tuning of the linear models and LightGBM, Platt calibration) is rerun on earlier "
              "seasons only, then the season is "
              "predicted. Win-probability metrics are log loss (lower is better); the market benchmark is the "
              "Odds Portal average price, since closing odds are missing for most of 2024 and all of 2025.", "",
              "Caveat: the RAPM settings (penalty 300, 90-day half-life) were chosen on 2022–2024 CV, so the "
              "2023 and 2024 results are slightly optimistic for the RAPM features. The grid was flat, so the "
              "effect should be small.", "",
              f"## Pooled over {seasons_txt} ({len(test)} games)", "", md_table(pooled), "",
              "## Paired bootstrap, pooled (log-loss difference; negative = model better)", "", md_table(boots), ""]
    for season, table in per_season.items():
        report += [f"## {season} ({int(table['games'].iloc[0])} games)", "", md_table(table), ""]
    report += [f"## Real closing odds, where reliable ({ok.sum()} games, mostly 2023)", "", md_table(closing), "",
               md_table(closing_boot), ""]
    if FEATURE_SELECTION:
        report += ["## Feature selection stability, `home_win` (1 = selected for that season)", "",
                   md_table(stability), "", md_table(order), ""]

    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "backtest.md").write_text("\n".join(report), encoding="utf-8")
    save_predictions(test, preds, REPORTS / "backtest_predictions.csv")
    print(md_table(pooled))
    print(md_table(boots))
    print(md_table(order))
    print("wrote reports/backtest.md")


# ---------------------------------------------------------------- final run

def run_final(force):
    if FINAL_LOCK.exists() and not force:
        raise SystemExit(f"The {TEST_SEASON} final test has already been run ({FINAL_LOCK.read_text().strip()}). "
                         "Pass --force only if you really mean to score it again.")
    if not PARAMS_OUT.exists():
        raise SystemExit("reports/params.json not found: run `python src/train.py` (the dev run) first.")
    cfg = json.loads(PARAMS_OUT.read_text())
    df = load_data()

    print(f"refitting on {FIRST_SEASON}-{DEV_SEASON}, evaluating {TEST_SEASON}...")
    preds, _ = fit_predict(df, DEV_SEASON, TEST_SEASON, cfg)
    train, test = df[df["season"] <= DEV_SEASON], df.loc[preds.index]
    ok = test["close_ok"].astype(bool)
    closing = ("p_close", "close_line", "close_total")
    baseline = baseline_preds(train, test)
    reliable = results_table(test[ok], preds[ok], baseline[ok], closing)
    everything = results_table(test, preds, baseline, ("p_avg", None, None))

    report = [f"# Final test ({TEST_SEASON})", "", f"**Main models:** the {MAIN_MODEL} (average of linear and LightGBM) for both variants, with odds and no odds.", "",
              f"Settings and feature sets come from the dev run; models refit on {FIRST_SEASON}–{DEV_SEASON}.", "",
              f"## Games with reliable closing odds ({ok.sum()} of {len(test)})", "", md_table(reliable), "",
              f"## All {len(test)} games (closing benchmark = Odds Portal average)", "", md_table(everything), ""]
    (REPORTS / f"final_{TEST_SEASON}.md").write_text("\n".join(report), encoding="utf-8")
    save_predictions(test, preds, REPORTS / f"predictions_{TEST_SEASON}.csv")
    FINAL_LOCK.write_text(f"run {pd.Timestamp.now():%Y-%m-%d %H:%M}\n")
    print(md_table(reliable))
    print(f"wrote reports/final_{TEST_SEASON}.md")


def save_predictions(test, preds, path):
    cols = ["match_id", "season", "round_title", "home_team", "away_team", "home_score", "away_score",
            "home_win", "margin", "total", "elo_prob", "p_open", "p_close", "p_avg"]
    test[cols].join(preds).to_csv(path, index=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--final", action="store_true", help=f"one-time evaluation on {TEST_SEASON}")
    parser.add_argument("--force", action="store_true", help="allow --final to run again")
    parser.add_argument("--backtest", action="store_true",
                        help=f"rerun development for each of {BACKTEST_SEASONS} and predict it")
    parser.add_argument("--select", action="store_true",
                        help="forward feature selection for the linear models instead of LINEAR_FEATURES")
    parser.add_argument("--tune-lgb", action="store_true",
                        help="tune LightGBM with Optuna on the full feature set (the earlier setup)")
    parser.add_argument("--train-from", type=int, default=FIRST_SEASON,
                        help=f"first season of training rows (default {FIRST_SEASON})")
    args = parser.parse_args()
    FEATURE_SELECTION, FIRST_SEASON = args.select, args.train_from
    if args.tune_lgb:
        LGB_TUNING, LGB_COMPACT = True, False
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    warnings.filterwarnings("ignore", category=UserWarning, module="lightgbm")
    if args.final:
        run_final(args.force)
    elif args.backtest:
        run_backtest()
    else:
        run_dev()
