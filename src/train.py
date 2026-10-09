"""
Train and evaluate the match models.

Walk-forward cross-validation on 2021-2024 (train on earlier seasons, test on the next),
tuning, Platt calibration, and an evaluation on the 2025 dev season against benchmarks.
The 2026 season is only touched by --final, which refits on 2021-2025 using the settings
chosen in the dev run and scores 2026 once against closing odds.

Usage:
    python src/train.py           # -> reports/dev_2025.md, reports/params.json, ...
    python src/train.py --final   # ONE-TIME -> reports/final_2026.md
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

TARGETS = {"home_win": "clf", "margin": "reg", "total": "reg"}
C_GRID = np.logspace(-3, 1, 9)        # logistic regression
ALPHA_GRID = np.logspace(-1, 4, 11)   # ridge
N_TRIALS = 60                         # Optuna trials per LightGBM model
SEED = 0
MIN_GAIN = 0.001                      # forward selection: minimum pooled CV log-loss gain to add a feature

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


def tune_linear(df, feats, target):
    grid = C_GRID if TARGETS[target] == "clf" else ALPHA_GRID
    return float(min((cv_linear(df, feats, target, g)[0], g) for g in grid)[1])


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


def forward_select(df, pool, target="home_win"):
    """Greedy forward selection for the linear model on walk-forward CV.

    A feature is only eligible if adding it (with C / alpha re-tuned) improves the score in
    every CV season, not just the pooled score; of those, the best pooled one is added if it
    gains at least MIN_GAIN. This guards against features that fit one season's noise.
    Returns the chosen features and a trace of each step.
    """
    oof = base_rate_oof(df, target)
    done = oof.notna()
    best, best_seasons = score(df.loc[done, target], oof[done], TARGETS[target]), season_scores(df, oof, target)
    chosen, trace = [], []
    while len(chosen) < len(pool):
        cands = []
        for f in pool:
            if f in chosen:
                continue
            reg = tune_linear(df, chosen + [f], target)
            pooled, oof = cv_linear(df, chosen + [f], target, reg)
            seasons = season_scores(df, oof, target)
            if (seasons < best_seasons).all():
                cands.append((pooled, f, seasons))
        if not cands or min(cands, key=lambda c: c[0])[0] > best - MIN_GAIN:
            break
        best, f, best_seasons = min(cands, key=lambda c: c[0])
        chosen.append(f)
        trace.append({"step": len(chosen), "feature": f, "cv_log_loss": best,
                      **{f"cv_{s}": v for s, v in best_seasons.items()}})
        print(f"  + {f:32s} CV {best:.4f}")
    return chosen, pd.DataFrame(trace).set_index("step")


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


def tune_lgb(df, feats, target):
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
        s, _, rounds = cv_lgb(df, feats, target, params)
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
        lin_feats, gbm_feats = fs["linear"], fs["lightgbm"]
        for target, kind in TARGETS.items():
            mc = cfg["models"][variant][target]
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


def results_table(train, test, preds, closing):
    """Models and benchmarks scored on the same games. `closing` = (prob, line, total) columns."""
    rows = {}
    for col in preds.columns:
        variant, model, target = col.split("|")
        if target == "home_win":
            key = f"Model {variant}: {model}"
            rows[key] = evaluate(test, preds[col], preds[f"{variant}|{model}|margin"],
                                 preds[f"{variant}|{model}|total"])
    rows["Benchmark: home team"] = evaluate(
        test, np.full(len(test), train["home_win"].mean()),
        np.full(len(test), train["margin"].mean()), np.full(len(test), train["total"].mean()))
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

    # 2. Forward selection for the linear models; LightGBM keeps the full set.
    print("forward selection (linear, home_win)...")
    selected, trace = forward_select(cv_df, FEATURE_SETS["+player"])
    full, odds = FEATURE_SETS["+player"], FEATURE_GROUPS["odds"]
    cfg = {"feature_sets": {"B": {"linear": selected, "lightgbm": full},
                            "A": {"linear": selected + odds, "lightgbm": full + odds}},
           "models": {}}
    report += ["## Forward feature selection (linear models)", "",
               f"Greedy selection from the {len(full)} base + player features on walk-forward CV log loss, "
               f"adding a feature only if it improves log loss in every CV season and the pooled score by at least "
               f"{MIN_GAIN}. Model B's linear models use these "
               f"{len(selected)} features and Model A adds the opening odds. LightGBM uses the full set.", "",
               md_table(trace), ""]

    # 3. Tuning per variant and target.
    cv_rows = {}
    for variant, fs in cfg["feature_sets"].items():
        cfg["models"][variant] = {}
        for target in TARGETS:
            print(f"tuning model {variant} / {target}...")
            reg = tune_linear(cv_df, fs["linear"], target)
            lgb_params, rounds = tune_lgb(cv_df, fs["lightgbm"], target)
            cfg["models"][variant][target] = {"linear": reg, "lgb": lgb_params, "lgb_rounds": rounds}
            cv_rows[(variant, target, "linear")] = cv_linear(cv_df, fs["linear"], target, reg)[0]
            cv_rows[(variant, target, "lightgbm")] = cv_lgb(cv_df, fs["lightgbm"], target, lgb_params,
                                                            n_rounds=rounds)[0]
    cv_table = pd.Series(cv_rows).unstack([1])
    cv_table.index = pd.Index([f"Model {v}: {m}" for v, m in cv_table.index], name="model")
    report += ["## Tuned models, walk-forward CV 2022–2024", "",
               "Log loss for `home_win`, MAE for `margin` and `total`. LightGBM uses its fixed tuned "
               "number of trees here, so these scores are not inflated by early stopping.", "",
               md_table(cv_table), ""]

    # 4. Dev season.
    print(f"fitting on {FIRST_SEASON}-{max(CV_SEASONS)}, evaluating {DEV_SEASON}...")
    preds, fitted = fit_predict(df, max(CV_SEASONS), DEV_SEASON, cfg)
    train, test = df[df["season"] <= max(CV_SEASONS)], df.loc[preds.index]
    results = results_table(train, test, preds, closing=("p_avg", None, "close_total"))
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
    reliable = results_table(train, test[ok], preds[ok], closing)
    everything = results_table(train, test, preds, ("p_avg", None, None))

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
    args = parser.parse_args()
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    warnings.filterwarnings("ignore", category=UserWarning, module="lightgbm")
    run_final(args.force) if args.final else run_dev()
