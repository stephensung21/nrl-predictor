"""
The models: data and folds, linear models, LightGBM, calibration, the development procedure
(feature sets and tuning), fitting and predicting, and the shared backtest.

All settings come from config.py and are read when a function runs.
"""

import lightgbm as lgb
import numpy as np
import optuna
import pandas as pd
from scipy.stats import norm
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import log_loss, mean_absolute_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

import config
from features import MIN_HISTORY, logit


# ---------------------------------------------------------------- data and folds

def load_data():
    """Usable games from FIRST_SEASON: both teams have MIN_HISTORY earlier games, and no draws.

    Earlier seasons in features.csv (2020 from the six-again restart) still shape the features
    as history; they only become training rows with --train-from 2020.
    """
    f = pd.read_csv(config.PROCESSED / "features.csv")
    keep = (f["min_hist"] >= MIN_HISTORY) & ~f["is_draw"] & (f["season"] >= config.FIRST_SEASON)
    return f[keep].reset_index(drop=True)


def walk_forward(df, test_seasons):
    """Train on every season from FIRST_SEASON up to the one before, test on the season."""
    for s in test_seasons:
        yield df.index[df["season"].between(config.FIRST_SEASON, s - 1)], df.index[df["season"] == s]


def score(y, p, kind):
    return log_loss(y, p, labels=[0, 1]) if kind == "clf" else mean_absolute_error(y, p)


# ---------------------------------------------------------------- linear models

def linear(kind, reg):
    """Median imputation and scaling inside the pipeline, so they learn from the training fold only."""
    est = LogisticRegression(C=reg, max_iter=5000) if kind == "clf" else Ridge(alpha=reg)
    return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), est)


def linear_predict(model, X, kind):
    return model.predict_proba(X)[:, 1] if kind == "clf" else model.predict(X)


def cv_linear(df, feats, target, reg, seasons=None):
    """Pooled out-of-fold score and predictions."""
    kind = config.TARGETS[target]
    oof = pd.Series(np.nan, index=df.index)
    for tr, te in walk_forward(df, config.CV_SEASONS if seasons is None else seasons):
        m = linear(kind, reg).fit(df.loc[tr, feats], df.loc[tr, target])
        oof[te] = linear_predict(m, df.loc[te, feats], kind)
    done = oof.notna()
    return score(df.loc[done, target], oof[done], kind), oof


def tune_linear(df, feats, target, seasons=None):
    grid = config.C_GRID if config.TARGETS[target] == "clf" else config.ALPHA_GRID
    return float(min((cv_linear(df, feats, target, g, seasons)[0], g) for g in grid)[1])


def season_scores(df, oof, target):
    """Out-of-fold score in each walk-forward test season."""
    kind, done = config.TARGETS[target], oof.notna()
    return df[done].groupby("season").apply(lambda g: score(g[target], oof[g.index], kind))


def base_rate_oof(df, target, seasons=None):
    """Out-of-fold predictions of the training mean: the score of a model with no features."""
    oof = pd.Series(np.nan, index=df.index)
    for tr, te in walk_forward(df, config.CV_SEASONS if seasons is None else seasons):
        oof[te] = df.loc[tr, target].mean()
    return oof


def forward_select(df, pool, target="home_win", seasons=None):
    """Greedy forward selection for the linear model on walk-forward CV (--select).

    A feature is only eligible if adding it (with C / alpha re-tuned) improves the score in
    every CV season, not just the pooled score; of those, the best pooled one is added if it
    gains at least MIN_GAIN for the target's kind. Returns the chosen features and a trace.
    """
    seasons = config.CV_SEASONS if seasons is None else seasons
    oof = base_rate_oof(df, target, seasons)
    done = oof.notna()
    best = score(df.loc[done, target], oof[done], config.TARGETS[target])
    best_seasons = season_scores(df, oof, target)
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
        if not cands or min(cands, key=lambda c: c[0])[0] > best - config.MIN_GAIN[config.TARGETS[target]]:
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
            "bagging_freq": 1, "num_threads": 1, "deterministic": True, "seed": config.SEED, "verbosity": -1}


def cv_lgb(df, feats, target, params, seasons=None, n_rounds=None):
    """With n_rounds=None each fold stops early on its test season (tuning only, optimistic);
    otherwise every fold trains a fixed number of trees (honest out-of-fold predictions)."""
    kind = config.TARGETS[target]
    oof, best_iters = pd.Series(np.nan, index=df.index), []
    for tr, te in walk_forward(df, config.CV_SEASONS if seasons is None else seasons):
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


def tune_lgb(df, feats, target, seasons=None, sampler_seed=None):
    """Optuna tuning (--tune-lgb only); the default is LGB_FIXED."""
    kind = config.TARGETS[target]

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

    sampler = optuna.samplers.TPESampler(seed=config.SEED if sampler_seed is None else sampler_seed)
    study = optuna.create_study(direction="minimize", sampler=sampler)
    study.optimize(objective, n_trials=config.N_TRIALS)
    return {**lgb_base(kind), **study.best_params}, study.best_trial.user_attrs["rounds"]


def lgb_features(compact):
    """LightGBM's features (before odds): the full base + player set, or the compact set of every
    linear-model feature plus LGB_COMPACT_EXTRA."""
    if not compact:
        return list(config.feature_sets()["+player"])
    linear_feats = sorted({f for fs in config.LINEAR_FEATURES.values() for f in fs})
    return list(dict.fromkeys(linear_feats + config.LGB_COMPACT_EXTRA))


# ---------------------------------------------------------------- calibration

def platt(p_oof, y):
    """Fit Platt scaling on out-of-fold probabilities; returns the calibration function."""
    lr = LogisticRegression(C=1e6).fit(logit(np.asarray(p_oof)).reshape(-1, 1), y)
    return lambda p: lr.predict_proba(logit(np.asarray(p)).reshape(-1, 1))[:, 1]


def margin_win_prob(margin_pred, oof_residuals):
    """P(home wins) from a predicted margin: Phi(margin / sigma), sigma = SD of out-of-fold errors."""
    return norm.cdf(np.asarray(margin_pred) / np.std(oof_residuals))


# ---------------------------------------------------------------- development procedure

def linear_odds(target):
    """The opening-odds inputs a with-odds linear model gets (no BlueBet inputs for totals)."""
    odds = config.FEATURE_GROUPS["odds"]
    return [f for f in odds if f not in config.BOOKMAKER_INPUTS] if target == "total" else list(odds)


def develop(cv_df, cv_seasons):
    """Feature sets and tuning on walk-forward CV over cv_seasons. Returns cfg, trace, CV table.

    The linear models use LINEAR_FEATURES, or with FEATURE_SELECTION two selected sets: one
    chosen on win log loss (win and margin models) and one on total-points MAE (total model).
    """
    full, odds = config.feature_sets()["+player"], config.FEATURE_GROUPS["odds"]
    if config.FEATURE_SELECTION:
        selected, traces = {}, []
        for target in ("home_win", "total"):
            print(f"forward selection (linear, {target}), CV {cv_seasons}...")
            selected[target], trace = forward_select(cv_df, full, target, seasons=cv_seasons)
            traces.append(trace)
        trace = pd.concat(traces)
        linear_b = {"home_win": selected["home_win"], "margin": selected["home_win"], "total": selected["total"]}
    else:
        linear_b = {t: list(f) for t, f in config.LINEAR_FEATURES.items()}
        trace = pd.DataFrame([{"target": t, "step": i + 1, "feature": f}
                              for t in ("home_win", "total") for i, f in enumerate(linear_b[t])]).set_index("step")
    gbm = lgb_features(config.LGB_COMPACT)
    cfg = {"feature_sets": {"with_odds": {"linear": {t: f + linear_odds(t) for t, f in linear_b.items()},
                                          "lightgbm": gbm + odds},
                            "no_odds": {"linear": linear_b, "lightgbm": gbm}},
           "models": {}}
    cv_rows = {}
    for variant, fs in cfg["feature_sets"].items():
        cfg["models"][variant] = {}
        for target, kind in config.TARGETS.items():
            print(f"tuning model {variant} / {target}...")
            reg = tune_linear(cv_df, fs["linear"][target], target, cv_seasons)
            if config.LGB_TUNING:
                lgb_params, rounds = tune_lgb(cv_df, fs["lightgbm"], target, cv_seasons)
            else:  # fixed settings: only the number of trees is chosen, by walk-forward early stopping
                lgb_params = {**lgb_base(kind), **config.LGB_FIXED}
                rounds = cv_lgb(cv_df, fs["lightgbm"], target, lgb_params, cv_seasons)[2]
            cfg["models"][variant][target] = {"linear": reg, "lgb": lgb_params, "lgb_rounds": rounds,
                                              "lgb_seeds": 1 if config.LGB_TUNING else config.LGB_SEEDS}
            cv_rows[(variant, target, "linear")] = cv_linear(cv_df, fs["linear"][target], target, reg, cv_seasons)[0]
            cv_rows[(variant, target, "lightgbm")] = cv_lgb(cv_df, fs["lightgbm"], target, lgb_params,
                                                            cv_seasons, n_rounds=rounds)[0]
    cv_table = pd.Series(cv_rows).unstack([1])
    cv_table.index = pd.Index([f"{config.VARIANT_LABEL[v]}: {m}" for v, m in cv_table.index], name="model")
    return cfg, trace, cv_table


# ---------------------------------------------------------------- fitting and predicting

def fit_predict(df, last_train, test_season, cfg):
    """Fit every model on seasons up to last_train and predict test_season.

    Win probabilities are Platt-calibrated on walk-forward out-of-fold predictions for
    FIRST_SEASON+1..last_train, made with the same fixed settings; with MARGIN_BLEND the linear win
    probability is then averaged with the linear margin model's. Ensembles average the linear
    and LightGBM predictions (calibrated probabilities for the win model); LightGBM itself is the
    average of LGB_SEEDS models with different random seeds.
    """
    train = df[df["season"] <= last_train]
    test = df[df["season"] == test_season]
    return fit_predict_frames(train, test, cfg, list(range(config.FIRST_SEASON + 1, last_train + 1)))


def fit_predict_frames(train, test, cfg, calib_seasons):
    """fit_predict on explicit training and test rows. Calibration uses walk-forward out-of-fold
    predictions over calib_seasons (complete seasons only), so training rows from the test season's
    earlier rounds (weekly refitting) are used for fitting but not for calibration."""
    preds, fitted = pd.DataFrame(index=test.index), {}

    for variant, fs in cfg["feature_sets"].items():
        gbm_feats = fs["lightgbm"]
        for target, kind in config.TARGETS.items():
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
        if config.MARGIN_BLEND:
            mc, m_feats = cfg["models"][variant]["margin"], fs["linear"]["margin"]
            _, oof = cv_linear(train, m_feats, "margin", mc["linear"], calib_seasons)
            done = oof.notna()
            p_margin = margin_win_prob(preds[f"{variant}|linear|margin"], train.loc[done, "margin"] - oof[done])
            p_lin = (preds[f"{variant}|linear|home_win"] + p_margin) / 2
            preds[f"{variant}|linear|home_win"] = p_lin
            preds[f"{variant}|ensemble|home_win"] = (p_lin + preds[f"{variant}|lightgbm|home_win"]) / 2
    return preds, fitted


def backtest(df, seasons=None):
    """The backtest: for each season, develop (feature sets, tuning) on earlier seasons only, then fit
    and predict it. Returns every model's predictions (indexed like df) and {season: (cfg, trace)}.
    Shared by train.py --backtest, experiments.py and betting.py."""
    preds, details = [], {}
    for season in config.BACKTEST_SEASONS if seasons is None else seasons:
        print(f"\n=== {season}: develop on {config.FIRST_SEASON}-{season - 1}, predict {season} ===")
        cfg, trace, _ = develop(df[df["season"] < season], list(range(config.FIRST_SEASON + 1, season)))
        preds.append(fit_predict(df, season - 1, season, cfg)[0])
        details[season] = (cfg, trace)
    return pd.concat(preds), details


def margin_total_sigma(df, cfg, season):
    """For the betting simulation: SD of the linear margin and total models' out-of-fold errors on the
    seasons before `season`, per variant (the spread of P(cover line) / P(over total))."""
    train = df[df["season"] < season]
    calib = list(range(config.FIRST_SEASON + 1, season))
    out = {}
    for variant, fs in cfg["feature_sets"].items():
        for target in ("margin", "total"):
            _, oof = cv_linear(train, fs["linear"][target], target, cfg["models"][variant][target]["linear"], calib)
            done = oof.notna()
            out[(variant, target)] = float(np.std(train.loc[done, target] - oof[done]))
    return out
