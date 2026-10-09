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
MIN_GAIN = {"clf": 0.001, "reg": 0.01}  # forward selection: minimum pooled CV gain (log loss / MAE points)

BASE = FEATURE_GROUPS["elo"] + FEATURE_GROUPS["form"] + FEATURE_GROUPS["context"]
FEATURE_SETS = {
    "base": BASE,
    "+player": BASE + FEATURE_GROUPS["player"],
    "+odds": BASE + FEATURE_GROUPS["player"] + FEATURE_GROUPS["odds"],
}


# ---------------------------------------------------------------- data and folds

def load_data():
    """Usable games: both teams have MIN_HISTORY earlier games, and no draws."""
    f = pd.read_csv(PROCESSED / "features.csv")
    return f[(f["min_hist"] >= MIN_HISTORY) & ~f["is_draw"]].reset_index(drop=True)


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


def tune_lgb(df, feats, target, seasons=CV_SEASONS):
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

    study = optuna.create_study(direction="minimize", sampler=optuna.samplers.TPESampler(seed=SEED))
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
    2022..last_train, made with the same fixed settings. Ensembles average the linear and
    LightGBM predictions (calibrated probabilities for the win model).
    """
    train = df[df["season"] <= last_train]
    test = df[df["season"] == test_season]
    calib_seasons = list(range(FIRST_SEASON + 1, last_train + 1))
    preds, fitted = pd.DataFrame(index=test.index), {}

    for variant, fs in cfg["feature_sets"].items():
        gbm_feats = fs["lightgbm"]
        for target, kind in TARGETS.items():
            lin_feats, mc = fs["linear"][target], cfg["models"][variant][target]
            lin = linear(kind, mc["linear"]).fit(train[lin_feats], train[target])
            gbm = lgb.train(mc["lgb"], lgb.Dataset(train[gbm_feats], train[target]), num_boost_round=mc["lgb_rounds"])
            p_lin = linear_predict(lin, test[lin_feats], kind)
            p_gbm = gbm.predict(test[gbm_feats])
            if kind == "clf":
                _, oof_lin = cv_linear(train, lin_feats, target, mc["linear"], calib_seasons)
                _, oof_gbm, _ = cv_lgb(train, gbm_feats, target, mc["lgb"], calib_seasons, n_rounds=mc["lgb_rounds"])
                done = oof_lin.notna()
                p_lin = platt(oof_lin[done], train.loc[done, target])(p_lin)
                p_gbm = platt(oof_gbm[done], train.loc[done, target])(p_gbm)
            preds[f"{variant}|linear|{target}"] = p_lin
            preds[f"{variant}|lightgbm|{target}"] = p_gbm
            preds[f"{variant}|ensemble|{target}"] = (p_lin + p_gbm) / 2
            fitted[(variant, target)] = (lin, lin_feats, gbm, gbm_feats)
    return preds, fitted


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
            key = f"Model {variant}: {model}"
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
        shap = pd.Series(np.abs(gbm.predict(test[gbm_feats], pred_contrib=True)[:, :-1]).mean(axis=0),
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

def develop(cv_df, cv_seasons):
    """Forward selection and tuning on walk-forward CV over cv_seasons. Returns cfg, trace, CV table.

    The linear models get two selected feature sets: one chosen on win log loss (used for the
    win and margin models) and one chosen on total-points MAE (used for the total model).
    """
    full, odds = FEATURE_SETS["+player"], FEATURE_GROUPS["odds"]
    selected, traces = {}, []
    for target in ("home_win", "total"):
        print(f"forward selection (linear, {target}), CV {cv_seasons}...")
        selected[target], trace = forward_select(cv_df, full, target, seasons=cv_seasons)
        traces.append(trace)
    trace = pd.concat(traces)
    linear_b = {"home_win": selected["home_win"], "margin": selected["home_win"], "total": selected["total"]}
    cfg = {"feature_sets": {"B": {"linear": linear_b, "lightgbm": full},
                            "A": {"linear": {t: f + odds for t, f in linear_b.items()}, "lightgbm": full + odds}},
           "models": {}}
    cv_rows = {}
    for variant, fs in cfg["feature_sets"].items():
        cfg["models"][variant] = {}
        for target in TARGETS:
            print(f"tuning model {variant} / {target}...")
            reg = tune_linear(cv_df, fs["linear"][target], target, cv_seasons)
            lgb_params, rounds = tune_lgb(cv_df, fs["lightgbm"], target, cv_seasons)
            cfg["models"][variant][target] = {"linear": reg, "lgb": lgb_params, "lgb_rounds": rounds}
            cv_rows[(variant, target, "linear")] = cv_linear(cv_df, fs["linear"][target], target, reg, cv_seasons)[0]
            cv_rows[(variant, target, "lightgbm")] = cv_lgb(cv_df, fs["lightgbm"], target, lgb_params,
                                                            cv_seasons, n_rounds=rounds)[0]
    cv_table = pd.Series(cv_rows).unstack([1])
    cv_table.index = pd.Index([f"Model {v}: {m}" for v, m in cv_table.index], name="model")
    return cfg, trace, cv_table


# ---------------------------------------------------------------- dev run

def run_dev():
    df = load_data()
    cv_df = df[df["season"] <= max(CV_SEASONS)]
    report = [f"# Dev evaluation ({DEV_SEASON})", ""]

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
    report += ["## Forward feature selection (linear models)", "",
               f"Greedy selection from the {len(full)} base + player features on walk-forward CV, adding a "
               f"feature only if it improves the score in every CV season and the pooled score by at least "
               f"{MIN_GAIN['clf']} (log loss, `home_win`) or {MIN_GAIN['reg']} points (MAE, `total`). The win and "
               f"margin models use the `home_win` selection, the total model the `total` one; Model A adds the "
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
    report += ["## Feature importance (`home_win`, Model B; linear coefficients for selected features only)", "",
               md_table(imp[(imp["variant"] == "B") & (imp["target"] == "home_win")]
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
    for col in ["B|linear|home_win", "B|ensemble|home_win", "A|linear|home_win", "A|ensemble|home_win"]:
        variant, model, _ = col.split("|")
        for bench, name in (("p_avg", "market average"), ("p_open", "market opening"), ("elo_prob", "Elo")):
            boots[(f"Model {variant}: {model}", name)] = bootstrap_diff(test["home_win"], preds[col], test[bench])
    boots = pd.DataFrame(boots).T.rename_axis(["model", "vs"])
    boots.index = [f"{m} vs {b}" for m, b in boots.index]
    boots = boots.rename_axis("comparison")

    # Real closing odds where they exist and are reliable (mostly 2023).
    ok = test["close_ok"].astype(bool)
    closing = results_table(test[ok], preds[ok], baseline[ok], ("p_close", "close_line", "close_total"))
    closing_boot = pd.DataFrame({"Model B: linear vs market closing": bootstrap_diff(
        test.loc[ok, "home_win"], preds.loc[ok, "B|linear|home_win"], test.loc[ok, "p_close"])}).T.rename_axis("comparison")

    pool = FEATURE_SETS["+player"]
    stability = pd.DataFrame({s: [f in sel["home_win"] for f in pool] for s, sel in selections.items()}, index=pool)
    stability = stability[stability.any(axis=1)].astype(int).rename_axis("feature")
    order = pd.DataFrame({t: {s: ", ".join(f"{i + 1}. {f}" for i, f in enumerate(sel[t])) or "(none)"
                              for s, sel in selections.items()} for t in ("home_win", "total")}).rename_axis("season")

    seasons_txt = f"{BACKTEST_SEASONS[0]}–{BACKTEST_SEASONS[-1]}"
    report = [f"# Backtest {seasons_txt}", "",
              "For each season, the whole development procedure (forward selection, tuning of the linear "
              "models and LightGBM, Platt calibration) is rerun on earlier seasons only, then the season is "
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
               md_table(closing_boot), "",
               "## Feature selection stability, `home_win` (1 = selected for that season)", "", md_table(stability), "",
               md_table(order), ""]

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

    report = [f"# Final test ({TEST_SEASON})", "",
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
    args = parser.parse_args()
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    warnings.filterwarnings("ignore", category=UserWarning, module="lightgbm")
    if args.final:
        run_final(args.force)
    elif args.backtest:
        run_backtest()
    else:
        run_dev()
