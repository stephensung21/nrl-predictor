"""
Experiments on the 2023-2025 backtest, comparing ideas against the current linear models.

Each experiment reruns the backtest procedure for the linear models exactly as train.py does
(for each season: tune on earlier seasons with walk-forward CV, fit, Platt-calibrate, predict),
so a variant takes seconds rather than the full LightGBM backtest. LightGBM's predictions are
taken from reports/backtest_predictions.csv for the ensemble experiments. Any setting an idea
needs is chosen inside each backtest year from earlier seasons only.

Every result is compared with the baseline on the same games, with a paired bootstrap interval.
2026 is never used.

The baseline is the setup these experiments were run against (BASELINE_FEATURES, no margin
blend). The team margin rating and the margin blend were adopted into the pipeline afterwards,
so LightGBM's predictions in reports/backtest_predictions.csv now come from the newer setup.

Usage:
    python src/experiments.py                 ->  reports/experiments.md
    python src/experiments.py --only robust   ->  reports/experiments_robust.md (robust margin/total
                                                  training against the current pipeline)
    python src/experiments.py --only lightgbm ->  reports/experiments_lightgbm.md (LightGBM accuracy
                                                  and stability, and the main ensembles)
    python src/experiments.py --only gam      ->  reports/experiments_gam.md (GAM and Explainable
                                                  Boosting Machine, alone and in the ensemble)
    python src/experiments.py --only reserve  ->  reports/experiments_reserve.md (reserve-grade
                                                  newcomer ratings in the full pipeline backtest)
    python src/experiments.py --only team_total -> reports/experiments_team_total.md (team total
                                                  rating for the totals models)
    python src/experiments.py --only weekly   ->  reports/experiments_weekly.md (refitting the models
                                                  before every round instead of once a season)
    python src/experiments.py --only context2 ->  reports/experiments_context2.md (kickoff slot, travel
                                                  distance, Origin representatives, ladder/motivation)
    python src/experiments.py --only blend    ->  reports/experiments_blend.md (no odds in the models;
                                                  the market as a separate expert in a learned blend)
    python src/experiments.py --only shin     ->  reports/experiments_shin.md (Shin margin removal)
    python src/experiments.py --only disagreement -> reports/experiments_disagreement.md (where the
                                                  model and the opening market disagree, and who was right)
    python src/experiments.py --only pre_kickoff -> reports/experiments_pre_kickoff.md (the main models fed
                                                  pre-kickoff team lists instead of the final named 17)
"""

import argparse
import warnings

import lightgbm as lgb
import optuna

import numpy as np
import pandas as pd
from scipy import sparse
from scipy.optimize import minimize
from scipy.stats import norm, t as student_t
from sklearn.impute import SimpleImputer
from sklearn.linear_model import HuberRegressor, LogisticRegression, QuantileRegressor, Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import SplineTransformer, StandardScaler

import config
import models
from elo import run_elo, tune as tune_elo
from features import SEASON_SHRINK, SIX_AGAIN_START, logit, team_ratings
from ingest import PROCESSED, join_odds_to_matches, load_odds
from config import (ALPHA_GRID, BACKTEST_SEASONS, C_GRID, FIRST_SEASON, LGB_COMPACT_EXTRA, LGB_SEEDS,
                    LINEAR_FEATURES, REPORTS, TARGETS, VARIANT_LABEL, VARIANTS)
from models import cv_lgb, lgb_base, linear, linear_predict, platt, tune_lgb
from reports import md_table

ODDS = FEATURE_GROUPS_ODDS = config.FEATURE_GROUPS["odds"]  # the with-odds models' extra inputs
BASELINE_FEATURES = {
    "home_win": ["elo_logit", "diff_rapm_total", "diff_rapm_defence", "diff_rapm_vs_usual"],
    "margin": ["elo_logit", "diff_rapm_total", "diff_rapm_defence", "diff_rapm_vs_usual"],
    "total": ["rapm_points", "origin_period", "wet_conditions"],
}
N_BOOT = 5000
RESULTS = []  # rows for the report


# ---------------------------------------------------------------- harness

def fit_linear(kind, reg, X, y, w=None):
    model = linear(kind, reg)
    step = model.steps[-1][0]
    return model.fit(X, y, **({f"{step}__sample_weight": w} if w is not None else {}))


def walk(df, feats, target, reg, seasons, weights=None):
    """Walk-forward out-of-fold predictions (optionally with sample weights per training fold)."""
    kind = TARGETS[target]
    oof = pd.Series(np.nan, index=df.index)
    for s in seasons:
        tr, te = df[df["season"] < s], df[df["season"] == s]
        m = fit_linear(kind, reg, tr[feats], tr[target], None if weights is None else weights(tr, s))
        oof[te.index] = linear_predict(m, te[feats], kind)
    return oof


def oof_score(df, oof, target):
    d = oof.notna()
    return models.score(df.loc[d, target], oof[d], TARGETS[target])


def run_linear(df_for, feats, weights=None):
    """Backtest the linear models. df_for(season) gives the data for that backtest year (so features
    can depend on settings chosen from earlier seasons); feats maps target -> features.
    Returns test-season predictions for every target, plus out-of-fold margin predictions and
    residual information for the probabilistic models."""
    preds, extra = [], {}
    for season in BACKTEST_SEASONS:
        df = df_for(season)
        tr, te = df[df["season"] < season], df[df["season"] == season]
        cv = list(range(FIRST_SEASON + 1, season))
        p = pd.DataFrame(index=te["match_id"])
        for target, kind in TARGETS.items():
            f = feats[target]
            grid = C_GRID if kind == "clf" else ALPHA_GRID
            reg = min((oof_score(tr, walk(tr, f, target, g, cv, weights), target), g) for g in grid)[1]
            m = fit_linear(kind, reg, tr[f], tr[target], None if weights is None else weights(tr, season))
            pred = linear_predict(m, te[f], kind)
            oof = walk(tr, f, target, reg, cv, weights)
            if kind == "clf":
                d = oof.notna()
                pred = platt(oof[d], tr.loc[d, target])(pred)
            p[target] = pred
            if kind == "reg":
                d = oof.notna()
                extra[(season, target)] = (tr.loc[d], oof[d])
        preds.append(p)
    return pd.concat(preds), extra


def paired(y_or_df, new, base, kind):
    """Mean per-game difference (new - base; negative = new better) and a bootstrap 95% interval."""
    y, new, base = np.asarray(y_or_df), np.asarray(new, float), np.asarray(base, float)
    if kind == "clf":
        new, base = np.clip(new, 1e-6, 1 - 1e-6), np.clip(base, 1e-6, 1 - 1e-6)
        loss_n = -(y * np.log(new) + (1 - y) * np.log(1 - new))
        loss_b = -(y * np.log(base) + (1 - y) * np.log(1 - base))
    else:
        loss_n, loss_b = np.abs(y - new), np.abs(y - base)
    d = loss_n - loss_b
    boot = d[np.random.default_rng(0).integers(0, len(d), (N_BOOT, len(d)))].mean(axis=1)
    return loss_n.mean(), loss_b.mean(), d.mean(), np.percentile(boot, 2.5), np.percentile(boot, 97.5)


def record(experiment, variant, target, test, new, base, note=""):
    kind = TARGETS[target]
    new_s, base_s, diff, lo, hi = paired(test[target], new, base, kind)
    verdict = "better" if hi < 0 else "worse" if lo > 0 else "no clear difference"
    RESULTS.append({"experiment": experiment, "model": VARIANT_LABEL[variant], "target": target,
                    "metric": "log loss" if kind == "clf" else "MAE", "baseline": base_s, "new": new_s,
                    "diff": diff, "ci_low": lo, "ci_high": hi, "verdict": verdict, "note": note})
    print(f"{experiment:38s} {variant:9s} {target:8s} base {base_s:.4f} new {new_s:.4f} "
          f"diff {diff:+.4f} [{lo:+.4f}, {hi:+.4f}] {verdict}")


# ---------------------------------------------------------------- data

def require(df, columns):
    """Experiments on the tested-but-unused features need them built first."""
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise SystemExit(f"features.csv has no {missing[:3]}...: run `python src/features.py --experimental` first.")


def load():
    df = models.load_data()
    return df[df["season"] <= max(BACKTEST_SEASONS)].reset_index(drop=True)


def feats_for(variant, sets=BASELINE_FEATURES):
    return {t: list(f) + (models.linear_odds(t) if variant == "with_odds" else []) for t, f in sets.items()}


# ---------------------------------------------------------------- 1. re-tests

def margin_to_prob(base_df, base_preds, extra_margin):
    """Win probability from the predicted margin: P = Phi(margin / sigma), sigma from out-of-fold residuals."""
    out = []
    for season in BACKTEST_SEASONS:
        tr, oof = extra_margin[(season, "margin")]
        sigma = np.std(tr["margin"] - oof)
        m = base_preds.loc[base_df.loc[base_df["season"] == season, "match_id"], "margin"]
        out.append(pd.Series(norm.cdf(m / sigma), index=m.index))
    return pd.concat(out)


def offset_logistic(df, season, feats, lambdas=(0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1.0)):
    """Win model anchored on the market: logit p = open_logit + b0 + x'b, L2 on b (standardised x).
    The penalty is chosen by walk-forward CV on earlier seasons."""
    def fit(tr, lam):
        mu, sd = tr[feats].mean(), tr[feats].std().replace(0, 1)
        X = ((tr[feats] - mu) / sd).fillna(0).to_numpy()
        off, y = tr["open_logit"].to_numpy(), tr["home_win"].to_numpy()

        def f(w):
            z = off + w[0] + X @ w[1:]
            p = 1 / (1 + np.exp(-z))
            loss = np.mean(np.logaddexp(0, z) - y * z) + lam * np.sum(w[1:] ** 2)
            grad = np.r_[np.mean(p - y), X.T @ (p - y) / len(y) + 2 * lam * w[1:]]
            return loss, grad

        w = minimize(f, np.zeros(X.shape[1] + 1), jac=True, method="L-BFGS-B").x
        return lambda te: 1 / (1 + np.exp(-(te["open_logit"].to_numpy() + w[0]
                                            + ((te[feats] - mu) / sd).fillna(0).to_numpy() @ w[1:])))

    tr = df[df["season"] < season]
    cv = list(range(FIRST_SEASON + 1, season))

    def cv_loss(lam):
        losses = []
        for s in cv:
            a, b = tr[tr["season"] < s], tr[tr["season"] == s]
            p = np.clip(fit(a, lam)(b), 1e-6, 1 - 1e-6)
            losses.append(-(b["home_win"] * np.log(p) + (1 - b["home_win"]) * np.log(1 - p)))
        return pd.concat(losses).mean()

    lam = min(lambdas, key=cv_loss)
    te = df[df["season"] == season]
    return pd.Series(fit(tr, lam)(te), index=te["match_id"].to_numpy())


def elo_variants(df, odds):
    """Elo retuned inside each backtest year: on 2013..year-1, and on the six-again era 2020..year-1."""
    m = join_odds_to_matches(df[["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    odds_id = m.set_index("match_id")["odds_id"]
    cache = {}

    def make(first):
        def df_for(season):
            key = (first, season)
            if key not in cache:
                _, params = tune_elo(odds, range(first, season))
                prob = run_elo(odds, **params)["elo_prob"]
                d = df.copy()
                d["elo_logit"] = logit(prob.reindex(odds_id.loc[d["match_id"]].to_numpy()).to_numpy())
                cache[key] = d
                print(f"  Elo tuned {first}-{season - 1}: {params}")
            return cache[key]
        return df_for
    return make(2013), make(2020)


# ---------------------------------------------------------------- 2. probabilistic margin and total

def probabilistic(df, preds, extra, variant):
    """Distribution of margin and total around the linear model's prediction (Normal or Student t,
    constant or mismatch/wet-dependent spread, chosen per backtest year on out-of-fold residuals).
    Scored on whether the home side covered the opening line and whether the total went over the
    opening total; the market is a coin flip on both by construction."""
    rows = []
    for target, line_col, sign in (("margin", "open_line", -1), ("total", "open_total", 1)):
        for season in BACKTEST_SEASONS:
            tr, oof = extra[(season, target)]
            res = tr[target] - oof
            spread_x = lambda d: np.column_stack([np.abs(d["elo_logit"]), d["wet_conditions"]])
            # Expected |residual| from mismatch and wet conditions (heteroscedastic spread).
            coef = np.linalg.lstsq(np.c_[np.ones(len(tr)), spread_x(tr)], np.abs(res), rcond=None)[0]
            # Student t degrees of freedom by out-of-fold likelihood.
            def loglik(v):  # residuals scaled to unit SD; t rescaled so its SD is 1 too
                z = (res / res.std()).to_numpy()
                if v == np.inf:
                    return norm.logpdf(z).sum()
                k = np.sqrt(v / (v - 2))
                return (student_t.logpdf(z * k, v) + np.log(k)).sum()
            best_df = max([3, 5, 10, 30, np.inf], key=loglik)
            te = df[df["season"] == season]
            mean = preds.loc[te["match_id"], target].to_numpy()
            const_scale = res.std()
            hetero_scale = np.maximum(np.c_[np.ones(len(te)), spread_x(te)] @ coef, 1.0) * np.sqrt(np.pi / 2)
            # Event: home covers (margin > -line) or total goes over (total > line); pushes excluded.
            threshold = sign * te[line_col].to_numpy()
            outcome = te[target].to_numpy() - threshold
            keep = (outcome != 0) & ~np.isnan(threshold)
            for name, scale, dist in (("normal, constant spread", const_scale, np.inf),
                                      ("normal, varying spread", hetero_scale, np.inf),
                                      ("t, constant spread", const_scale, best_df)):
                z = (mean - threshold) / scale
                p = norm.cdf(z) if dist == np.inf else student_t.cdf(z * np.sqrt(dist / (dist - 2)) if dist > 2 else z, dist)
                rows.append(pd.DataFrame({"season": season, "target": target, "spec": name,
                                          "p": np.asarray(p)[keep], "y": (outcome[keep] > 0).astype(int)}))
    out = pd.concat(rows)
    summary = []
    for (target, spec), g in out.groupby(["target", "spec"]):
        p = np.clip(g["p"].to_numpy(), 1e-6, 1 - 1e-6)
        y = g["y"].to_numpy()
        ll = -(y * np.log(p) + (1 - y) * np.log(1 - p))
        d = ll - np.log(2)  # versus the market's 50%
        boot = d[np.random.default_rng(0).integers(0, len(d), (N_BOOT, len(d)))].mean(axis=1)
        conf = np.abs(p - 0.5) > 0.05
        hits = ((p > 0.5) == y)
        summary.append({"model": VARIANT_LABEL[variant], "market": "line" if target == "margin" else "total",
                        "spread": spec, "games": len(g), "log_loss": ll.mean(), "vs_50pct": d.mean(),
                        "ci_low": np.percentile(boot, 2.5), "ci_high": np.percentile(boot, 97.5),
                        "hit_rate": hits.mean(), "bets_p>55%": int(conf.sum()),
                        "hit_rate_p>55%": hits[conf].mean() if conf.any() else np.nan})
    return pd.DataFrame(summary)


# ---------------------------------------------------------------- 3. team margin rating + home advantage

# ---------------------------------------------------------------- 4. opponent-adjusted form

ADJ_STATS = ["points_for", "all_run_metres", "line_breaks", "completion_rate", "errors", "penalties_conceded"]
ADJ_ALPHA = 2 / (6 + 1)


def opponent_adjusted_form():
    """For each stat, a team's output relative to what its opponent usually allows (and what it
    allows relative to what the opponent usually produces), then an EWMA of those adjusted values.
    Pre-match values only; at each new season the averages are pulled back towards zero
    (league average) by SEASON_SHRINK."""
    matches = pd.read_csv(PROCESSED / "matches.csv")
    matches["start_time_utc"] = pd.to_datetime(matches["start_time_utc"], utc=True)
    matches = matches[matches["start_time_utc"] >= SIX_AGAIN_START].sort_values("start_time_utc")
    ts = pd.read_csv(PROCESSED / "team_match_stats.csv")
    ts = ts[ts["match_id"].isin(matches["match_id"])]
    ts[ADJ_STATS] = ts[ADJ_STATS].fillna(0)
    stat = ts.set_index(["match_id", "team"])[ADJ_STATS]

    produce, allow = {}, {}       # EWMA of raw output / output conceded (for opponent adjustment)
    adj_for, adj_against = {}, {}  # EWMA of opponent-adjusted output / conceded
    league = pd.Series(0.0, index=ADJ_STATS)
    n_league, season_of, rows = 0, {}, []
    for g in matches.itertuples():
        teams = (g.home_team, g.away_team)
        zero = pd.Series(0.0, index=ADJ_STATS)
        for t in teams:  # new season: pull adjusted form back towards average
            if season_of.get(t) not in (None, g.season):
                adj_for[t] = adj_for.get(t, zero) * (1 - SEASON_SHRINK)
                adj_against[t] = adj_against.get(t, zero) * (1 - SEASON_SHRINK)
            season_of[t] = g.season
        rows.append({"match_id": g.match_id,
                     **{f"home_adjf_{s}": adj_for.get(g.home_team, zero)[s] for s in ADJ_STATS},
                     **{f"home_adja_{s}": adj_against.get(g.home_team, zero)[s] for s in ADJ_STATS},
                     **{f"away_adjf_{s}": adj_for.get(g.away_team, zero)[s] for s in ADJ_STATS},
                     **{f"away_adja_{s}": adj_against.get(g.away_team, zero)[s] for s in ADJ_STATS}})
        if (g.match_id, g.home_team) not in stat.index or (g.match_id, g.away_team) not in stat.index:
            continue
        x = {t: stat.loc[(g.match_id, t)] for t in teams}
        for t, o in (teams, teams[::-1]):
            # Output relative to what the opponent usually allows (league average before any history).
            f_adj = x[t] - allow.get(o, league)
            a_adj = x[o] - produce.get(o, league)
            adj_for[t] = ADJ_ALPHA * f_adj + (1 - ADJ_ALPHA) * adj_for.get(t, zero)
            adj_against[t] = ADJ_ALPHA * a_adj + (1 - ADJ_ALPHA) * adj_against.get(t, zero)
        for t, o in (teams, teams[::-1]):
            produce[t] = ADJ_ALPHA * x[t] + (1 - ADJ_ALPHA) * produce.get(t, league)
            allow[t] = ADJ_ALPHA * x[o] + (1 - ADJ_ALPHA) * allow.get(t, league)
        n_league += 2
        league = league + ((x[teams[0]] + x[teams[1]]) / 2 - league) * (2 / n_league)
    f = pd.DataFrame(rows).set_index("match_id")
    out = pd.DataFrame(index=f.index)
    for s in ADJ_STATS:
        out[f"diff_adjf_{s}"] = f[f"home_adjf_{s}"] - f[f"away_adjf_{s}"]
        out[f"diff_adja_{s}"] = f[f"home_adja_{s}"] - f[f"away_adja_{s}"]
    out["diff_adj_net_points"] = out["diff_adjf_points_for"] - out["diff_adja_points_for"]
    out["sum_adj_points"] = (f["home_adjf_points_for"] + f["away_adjf_points_for"]
                             + f["home_adja_points_for"] + f["away_adja_points_for"])
    return out


# ---------------------------------------------------------------- 5. ensembles

def ensembles(test, members):
    """Online ensembles: weights for each season learned on earlier backtest seasons' predictions
    (equal weights in 2023). members: dict name -> win probabilities indexed by match_id."""
    y = test.set_index("match_id")["home_win"]
    P = pd.DataFrame(members).loc[y.index]
    L = logit(P.clip(1e-6, 1 - 1e-6))
    seasons = test.set_index("match_id")["season"]
    out = {"logit average": 1 / (1 + np.exp(-L.mean(axis=1)))}
    stack = pd.Series(np.nan, index=y.index)
    for s in BACKTEST_SEASONS:
        cur, prev = seasons == s, seasons < s
        if prev.sum() == 0:
            stack[cur] = 1 / (1 + np.exp(-L[cur].mean(axis=1)))
            continue
        m = LogisticRegression(C=1.0).fit(L[prev], y[prev])
        stack[cur] = m.predict_proba(L[cur])[:, 1]
    out["stacked (learned on earlier seasons)"] = stack
    return out


# ---------------------------------------------------------------- 7. robust margin / total training

MARGIN_TRAIN_CAP = 40  # same cap as the RAPM ratings
TOTAL_TRAIN_CAP = 25   # points either side of the training seasons' average total

ROBUST_VARIANTS = {
    # name: (estimator for a penalty value, penalty grid, cap the training target?)
    "ridge (current)": (lambda a: Ridge(alpha=a), ALPHA_GRID, False),
    "ridge, capped targets": (lambda a: Ridge(alpha=a), ALPHA_GRID, True),
    "Huber": (lambda a: HuberRegressor(alpha=a, epsilon=1.35, max_iter=2000), [0.01, 0.1, 1, 10, 100, 1000], False),
    "median (quantile) regression": (lambda a: QuantileRegressor(quantile=0.5, alpha=a, solver="highs"),
                                     [0.0, 0.001, 0.01, 0.1, 1.0], False),
}


def run_regression(df, feats, target, make, grid, cap):
    """Backtest one margin/total model as train.py does (penalty tuned by walk-forward CV MAE on earlier
    seasons), training on a capped target if `cap`. Returns test predictions and, per season, the
    out-of-fold residual SD (for the margin blend's sigma)."""
    def train_target(tr):
        y = tr[target]
        if not cap:
            return y
        if target == "margin":
            return y.clip(-MARGIN_TRAIN_CAP, MARGIN_TRAIN_CAP)
        return y.clip(y.mean() - TOTAL_TRAIN_CAP, y.mean() + TOTAL_TRAIN_CAP)

    def fit(tr, a):
        model = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), make(a))
        return model.fit(tr[feats], train_target(tr))

    def oof(tr, a, cv):
        out = pd.Series(np.nan, index=tr.index)
        for s in cv:
            a_tr, a_te = tr[tr["season"] < s], tr[tr["season"] == s]
            out[a_te.index] = fit(a_tr, a).predict(a_te[feats])
        return out

    preds, sigma = [], {}
    for season in BACKTEST_SEASONS:
        tr, te = df[df["season"] < season], df[df["season"] == season]
        cv = list(range(FIRST_SEASON + 1, season))
        best = min(grid, key=lambda a: np.nanmean(np.abs(tr[target] - oof(tr, a, cv))))
        preds.append(pd.Series(fit(tr, best).predict(te[feats]), index=te["match_id"].to_numpy()))
        o = oof(tr, best, cv)
        sigma[season] = np.std((tr[target] - o).dropna())
    return pd.concat(preds), sigma


def robust_targets():
    """Margin and total models trained with capped targets, Huber loss or median regression, compared
    with the current ridge on margin MAE, total MAE and the margin-blended win probability."""
    warnings.filterwarnings("ignore")
    df = load()
    test = df[df["season"].isin(BACKTEST_SEASONS)].set_index("match_id")
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    for v in VARIANTS:
        feats = feats_for(v, LINEAR_FEATURES)
        logistic = run_linear(lambda s: df, feats)[0]["home_win"]  # before the margin blend
        out = {}
        for name, (make, grid, cap) in ROBUST_VARIANTS.items():
            m, sig_m = run_regression(df, feats["margin"], "margin", make, grid, cap)
            t, _ = run_regression(df, feats["total"], "total", make, grid, cap)
            sd = test.loc[m.index, "season"].map(sig_m)
            out[name] = {"margin": m, "total": t, "home_win": (logistic.loc[m.index] + norm.cdf(m / sd)) / 2}
        base = out["ridge (current)"]
        for t in TARGETS:  # the current variant must reproduce the pipeline's backtest
            assert np.allclose(base[t], bt.loc[base[t].index, f"{v}|linear|{t}"]), (v, t)
        for name, preds in out.items():
            if name == "ridge (current)":
                continue
            for t in ("margin", "total", "home_win"):
                record(f"7 {name}", v, t, test.loc[preds[t].index], preds[t], base[t])
    res = pd.DataFrame(RESULTS)
    report = ["# Robust margin and total training (2023–2025 backtest)", "",
              "Margin and total models trained with capped targets (margin ±40, total ±25 around the training "
              "average), Huber loss, or median (quantile) regression, against the current ridge on raw targets. "
              "Penalties are tuned per backtest year on earlier seasons by CV MAE. `home_win` is the "
              "margin-blended win probability, which changes through the margin prediction. `diff` is new minus "
              "current (negative = better), with a paired bootstrap 95% interval.", "",
              md_table(res.set_index("experiment")), ""]
    (REPORTS / "experiments_robust.md").write_text("\n".join(report), encoding="utf-8")
    print("wrote reports/experiments_robust.md")


# ---------------------------------------------------------------- 8. LightGBM accuracy and stability

# Fixed settings and compact set: the pipeline's (config.LGB_FIXED, models.lgb_features), which were
# chosen in advance, not tuned on the backtest. Only the number of trees is chosen, by walk-forward
# early stopping on earlier seasons.
N_SEEDS = LGB_SEEDS
COMPACT_EXTRA = LGB_COMPACT_EXTRA
PIPELINE_LGB_VARIANT = "fixed settings, compact features, 5 seeds"  # adopted into train.py


def lgb_features(variant, compact):
    return models.lgb_features(compact) + (ODDS if variant == "with_odds" else [])


def lgb_backtest(df, variant, target, compact=False, tuned=True, seeds=(0,), sampler_seed=0):
    """LightGBM backtest for one target, as train.py does it (tuned on earlier seasons, fitted, and for
    the win model Platt-calibrated on out-of-fold predictions), optionally with fixed settings, the
    compact feature set, and predictions averaged over several random seeds."""
    feats, kind = lgb_features(variant, compact), TARGETS[target]
    out = []
    for season in BACKTEST_SEASONS:
        tr, te = df[df["season"] < season], df[df["season"] == season]
        cv = list(range(FIRST_SEASON + 1, season))
        if tuned:
            params, rounds = tune_lgb(tr, feats, target, cv, sampler_seed=sampler_seed)
        else:
            params = {**lgb_base(kind), **LGB_FIXED}
            rounds = cv_lgb(tr, feats, target, params, cv)[2]
        preds, oofs = [], []
        for sd in seeds:
            p = {**params, "seed": sd}
            preds.append(lgb.train(p, lgb.Dataset(tr[feats], tr[target]), num_boost_round=rounds).predict(te[feats]))
            if kind == "clf":
                oofs.append(cv_lgb(tr, feats, target, p, cv, n_rounds=rounds)[1])
        pred = np.mean(preds, axis=0)
        if kind == "clf":
            oof = pd.concat(oofs, axis=1).mean(axis=1)
            done = oof.notna()
            pred = platt(oof[done], tr.loc[done, target])(pred)
        out.append(pd.Series(pred, index=te["match_id"].to_numpy()))
    return pd.concat(out)


LGB_VARIANTS = {
    # name: (compact features, Optuna-tuned, seeds, Optuna sampler seed)
    "previous (Optuna, full features, 1 seed)": (False, True, (0,), 0),
    "Optuna, full features, 5 seeds": (False, True, tuple(range(N_SEEDS)), 0),
    "fixed settings, full features, 5 seeds": (False, False, tuple(range(N_SEEDS)), 0),
    "fixed settings, compact features, 5 seeds": (True, False, tuple(range(N_SEEDS)), 0),
    "Optuna, compact features, 5 seeds": (True, True, tuple(range(N_SEEDS)), 0),
}
# Stability: the same variant rerun with different randomness (Optuna sampler seed, or other bagging seeds).
LGB_REPEATS = {
    "previous (Optuna, full features, 1 seed)": (False, True, (0,), 1),
    "fixed settings, full features, 5 seeds": (False, False, tuple(range(N_SEEDS, 2 * N_SEEDS)), 0),
    "fixed settings, compact features, 5 seeds": (True, False, tuple(range(N_SEEDS, 2 * N_SEEDS)), 0),
}


def lightgbm_experiments():
    """Compare LightGBM variants on accuracy (LightGBM alone, and the main ensemble = average with the
    linear model) and stability (how much the pooled result moves when only the randomness changes).
    Run before adoption, the baseline was the previous Optuna setup; after adoption it is the pipeline's
    fixed-settings LightGBM (reports/experiments_lightgbm.md records the run that led to adoption)."""
    warnings.filterwarnings("ignore")
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    df = load()
    test = df[df["season"].isin(BACKTEST_SEASONS)].set_index("match_id")
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    rows, stability = [], []

    def score(target, p):
        y = test.loc[p.index, target].to_numpy()
        p = np.asarray(p, float)
        if TARGETS[target] == "clf":
            p = np.clip(p, 1e-6, 1 - 1e-6)
            return float(np.mean(-(y * np.log(p) + (1 - y) * np.log(1 - p))))
        return float(np.mean(np.abs(y - p)))

    for v in VARIANTS:
        results = {}
        for name, (compact, tuned, seeds, ss) in LGB_VARIANTS.items():
            print(f"{VARIANT_LABEL[v]}: {name}...")
            results[name] = {t: lgb_backtest(df, v, t, compact, tuned, seeds, ss) for t in TARGETS}
            if name == PIPELINE_LGB_VARIANT:  # must reproduce the pipeline's backtest exactly
                for t in TARGETS:
                    assert np.allclose(results[name][t], bt.loc[results[name][t].index, f"{v}|lightgbm|{t}"]), (v, t)
        base_ens = {t: bt[f"{v}|ensemble|{t}"] for t in TARGETS}
        for name, preds in results.items():
            for t in TARGETS:
                lin = bt.loc[preds[t].index, f"{v}|linear|{t}"]
                ens = (lin + preds[t]) / 2
                record(f"8 {name}: ensemble", v, t, test.loc[ens.index], ens, base_ens[t].loc[ens.index])
                rows.append({"model": VARIANT_LABEL[v], "LightGBM variant": name, "target": t,
                             "LightGBM": score(t, preds[t]), "linear": score(t, lin), "ensemble": score(t, ens)})
        for name, (compact, tuned, seeds, ss) in LGB_REPEATS.items():
            print(f"{VARIANT_LABEL[v]}: {name} (repeat with different randomness)...")
            again = lgb_backtest(df, v, "home_win", compact, tuned, seeds, ss)
            first = results[name]["home_win"]
            stability.append({"model": VARIANT_LABEL[v], "LightGBM variant": name,
                              "win log loss, run 1": score("home_win", first),
                              "win log loss, run 2": score("home_win", again),
                              "change": score("home_win", again) - score("home_win", first),
                              "mean abs prob change": float(np.mean(np.abs(again - first.loc[again.index])))})

    table, stab = pd.DataFrame(rows), pd.DataFrame(stability)
    res = pd.DataFrame(RESULTS)
    report = ["# LightGBM accuracy and stability (2023–2025 backtest)", "",
              "Each LightGBM variant is backtested as `train.py` does it (tuned on earlier seasons only, win "
              "model Platt-calibrated) and averaged with the linear model to form the main ensemble. The fixed "
              "settings were chosen in advance (depth 2, learning rate 0.02, at least 40 games per leaf, L2 10, "
              "70% of features and 80% of games per tree); only the number of trees is chosen by CV. The compact "
              "set is every linear-model feature plus " + ", ".join(COMPACT_EXTRA) + ".", "",
              "## Scores (log loss for `home_win`, MAE for margin and total)", "",
              md_table(table.set_index("model")), "",
              "## Ensemble against the current ensemble (paired bootstrap; negative = better)", "",
              md_table(res.set_index("experiment")), "",
              "## Stability: the same variant rerun with different randomness (win model)", "",
              "Run 2 changes only the randomness: the Optuna sampler seed for the current setup, or a "
              "different set of 5 bagging seeds for the fixed settings.", "",
              md_table(stab.set_index("model")), ""]
    (REPORTS / "experiments_lightgbm.md").write_text("\n".join(report), encoding="utf-8")
    print(md_table(table.set_index("model")))
    print(md_table(stab.set_index("model")))
    print("wrote reports/experiments_lightgbm.md")


# ---------------------------------------------------------------- 9. GAM and Explainable Boosting Machine

GAM_KNOTS = 5
EBM_SETTINGS = {"outer_bags": 8, "random_state": 0}  # fixed in advance, not tuned on the backtest


def make_gam(kind, reg):
    """Additive model: a cubic spline basis per feature, then the same penalised logistic / ridge."""
    est = LogisticRegression(C=reg, max_iter=5000) if kind == "clf" else Ridge(alpha=reg)
    return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(),
                         SplineTransformer(n_knots=GAM_KNOTS, degree=3, extrapolation="linear"),
                         StandardScaler(), est)


def make_ebm(kind, interactions):
    from interpret.glassbox import ExplainableBoostingClassifier, ExplainableBoostingRegressor
    cls = ExplainableBoostingClassifier if kind == "clf" else ExplainableBoostingRegressor
    return cls(interactions=interactions, **EBM_SETTINGS)


def model_backtest(df, target, feats, make, grid=None):
    """Backtest any model as train.py does: penalty (if any) tuned by walk-forward CV on earlier
    seasons, fitted, and for the win model Platt-calibrated on out-of-fold predictions."""
    kind = TARGETS[target]

    def predict(model, X):
        return model.predict_proba(X)[:, 1] if kind == "clf" else model.predict(X)

    def oof(tr, reg, cv):
        out = pd.Series(np.nan, index=tr.index)
        for s in cv:
            a, b = tr[tr["season"] < s], tr[tr["season"] == s]
            out[b.index] = predict(make(kind, reg).fit(a[feats], a[target]), b[feats])
        return out

    preds = []
    for season in BACKTEST_SEASONS:
        tr, te = df[df["season"] < season], df[df["season"] == season]
        cv = list(range(FIRST_SEASON + 1, season))
        reg = None if grid is None else min(grid, key=lambda g: oof_score(tr, oof(tr, g, cv), target))
        pred = predict(make(kind, reg).fit(tr[feats], tr[target]), te[feats])
        if kind == "clf":
            o = oof(tr, reg, cv)
            done = o.notna()
            pred = platt(o[done], tr.loc[done, target])(pred)
        preds.append(pd.Series(pred, index=te["match_id"].to_numpy()))
    return pd.concat(preds)


def gam_experiments():
    """GAM and EBM, alone and in the ensemble (replacing LightGBM, or as a third member), against the
    current models."""
    warnings.filterwarnings("ignore")
    df = load()
    test = df[df["season"].isin(BACKTEST_SEASONS)].set_index("match_id")
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    candidates = {
        # name: (feature choice, model maker, penalty grid or None)
        "GAM, linear features": ("linear", make_gam, "grid"),
        "GAM, compact features": ("compact", make_gam, "grid"),
        "EBM additive (no interactions), compact features": ("compact", lambda k, r: make_ebm(k, 0), None),
        "EBM with 5 interactions, compact features": ("compact", lambda k, r: make_ebm(k, 5), None),
    }
    rows = []

    def score(target, p):
        y, p = test.loc[p.index, target].to_numpy(), np.asarray(p, float)
        if TARGETS[target] == "clf":
            p = np.clip(p, 1e-6, 1 - 1e-6)
            return float(np.mean(-(y * np.log(p) + (1 - y) * np.log(1 - p))))
        return float(np.mean(np.abs(y - p)))

    for v in VARIANTS:
        for name, (which, make, grid) in candidates.items():
            print(f"{VARIANT_LABEL[v]}: {name}...")
            for t in TARGETS:
                feats = (LINEAR_FEATURES[t] if which == "linear" else models.lgb_features(True)) \
                    + (ODDS if v == "with_odds" else [])
                g = None if grid is None else (C_GRID if TARGETS[t] == "clf" else ALPHA_GRID)
                new = model_backtest(df, t, feats, make, g)
                lin, gbm = bt.loc[new.index, f"{v}|linear|{t}"], bt.loc[new.index, f"{v}|lightgbm|{t}"]
                current = bt.loc[new.index, f"{v}|ensemble|{t}"]
                replace, third = (lin + new) / 2, (lin + gbm + new) / 3
                record(f"9 {name}: alone", v, t, test.loc[new.index], new, current)
                record(f"9 {name}: linear + it (replaces LightGBM)", v, t, test.loc[new.index], replace, current)
                record(f"9 {name}: linear + LightGBM + it", v, t, test.loc[new.index], third, current)
                rows.append({"model": VARIANT_LABEL[v], "candidate": name, "target": t, "alone": score(t, new),
                             "linear + it": score(t, replace), "linear + LightGBM + it": score(t, third),
                             "current ensemble": score(t, current), "linear": score(t, lin), "LightGBM": score(t, gbm)})
    table, res = pd.DataFrame(rows), pd.DataFrame(RESULTS)
    report = ["# GAM and Explainable Boosting Machine (2023–2025 backtest)", "",
              "Each candidate is backtested as `train.py` does it (tuned on earlier seasons only; win model "
              "Platt-calibrated) and compared with the current main model (the ensemble of linear and LightGBM), "
              "alone, replacing LightGBM in the ensemble, and as a third ensemble member. GAM: a cubic spline basis "
              f"per feature ({GAM_KNOTS} knots) followed by penalised logistic / ridge, penalty tuned by CV. EBM: "
              "InterpretML's Explainable Boosting Machine with settings fixed in advance (8 outer bags; no "
              "interactions, or up to 5). Compact features = LightGBM's 16 (+ opening odds for the with-odds "
              "model).", "",
              "## Scores (log loss for `home_win`, MAE for margin and total)", "",
              md_table(table.set_index("model")), "",
              "## Against the current ensemble (paired bootstrap; negative = better)", "",
              md_table(res.set_index("experiment")), ""]
    (REPORTS / "experiments_gam.md").write_text("\n".join(report), encoding="utf-8")
    print(md_table(table.set_index("model")))
    print("wrote reports/experiments_gam.md")


# ---------------------------------------------------------------- 10. full-pipeline variants

def pipeline_backtest(df, **settings):
    """The pipeline's backtest (models.backtest) with some config settings temporarily changed.
    Returns every model's predictions, indexed by match_id."""
    with config.override(**settings):
        out, _ = models.backtest(df)
    out.index = df.loc[out.index, "match_id"].to_numpy()
    return out


def compare_pipelines(name, test, new, base, models=("linear", "ensemble")):
    for v in VARIANTS:
        for m in models:
            for t in TARGETS:
                col = f"{v}|{m}|{t}"
                record(f"{name}: {m}", v, t, test.loc[new.index], new[col], base.loc[new.index, col])


# ---------------------------------------------------------------- 11. reserve-grade newcomers

RESERVE_FEATURE = "diff_reserve_newcomers"
RESERVE_RAPM_FEATURE = "diff_reserve_rapm_newcomers"


def reserve_experiments():
    """Reserve-grade (NSW Cup / QLD Cup) ratings of NRL newcomers, added to LightGBM's compact set only,
    or to the linear models as well, in the full pipeline backtest."""
    warnings.filterwarnings("ignore")
    import builtins
    df = load()
    require(df, [RESERVE_FEATURE, RESERVE_RAPM_FEATURE])
    test = df[df["season"].isin(BACKTEST_SEASONS)].set_index("match_id")
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    quiet, builtins.print = builtins.print, (lambda *a, **k: None)  # develop() prints progress
    try:
        base = pipeline_backtest(df)
        with_win = {**LINEAR_FEATURES, "home_win": LINEAR_FEATURES["home_win"] + [RESERVE_FEATURE],
                    "margin": LINEAR_FEATURES["margin"] + [RESERVE_FEATURE]}
        # LightGBM's compact set includes every linear feature, so adding the feature to the linear
        # models adds it to LightGBM too.
        with_rapm = {**LINEAR_FEATURES, "home_win": LINEAR_FEATURES["home_win"] + [RESERVE_RAPM_FEATURE],
                     "margin": LINEAR_FEATURES["margin"] + [RESERVE_RAPM_FEATURE]}
        variants = {
            "11 reserve newcomers in LightGBM only": pipeline_backtest(
                df, LGB_COMPACT_EXTRA=LGB_COMPACT_EXTRA + [RESERVE_FEATURE]),
            "11 reserve newcomers in linear and LightGBM": pipeline_backtest(df, LINEAR_FEATURES=with_win),
            "11b reserve plus-minus newcomers in LightGBM only": pipeline_backtest(
                df, LGB_COMPACT_EXTRA=LGB_COMPACT_EXTRA + [RESERVE_RAPM_FEATURE]),
            "11b reserve plus-minus newcomers in linear and LightGBM": pipeline_backtest(df, LINEAR_FEATURES=with_rapm),
        }
    finally:
        builtins.print = quiet
    # The harness must reproduce the pipeline's backtest exactly.
    assert np.allclose(base.to_numpy(), bt.loc[base.index, base.columns].to_numpy())
    print("  harness reproduces reports/backtest_predictions.csv")
    for name, preds in variants.items():
        compare_pipelines(name, test, preds, base)
    res = pd.DataFrame(RESULTS)
    report = ["# Reserve-grade newcomers (2023–2025 backtest)", "",
              "`diff_reserve_newcomers` (home minus away): for named players with fewer than 10 NRL games, the "
              "sum of their reserve-grade (NSW Cup / QLD Cup) rating — fantasy points per 80 minutes relative to "
              "their position group, shrunk for few games — using reserve games before the NRL kickoff only. "
              "Added to LightGBM's compact set only, or to the linear win and margin models as well (LightGBM's "
              "compact set includes every linear feature), and run through the full pipeline backtest. `diff_reserve_rapm_newcomers` (11b) is the same idea using a "
              "reserve-grade plus-minus rating (ridge on reserve margins, as the NRL RAPM, one-year half-life) "
              "instead of fantasy points. `diff` is new minus current (negative = better), with a paired "
              "bootstrap 95% interval.", "",
              md_table(res.set_index("experiment")), ""]
    (REPORTS / "experiments_reserve.md").write_text("\n".join(report), encoding="utf-8")
    print("wrote reports/experiments_reserve.md")


# ---------------------------------------------------------------- 12. team total rating

def team_total_experiments():
    """Team total rating (team_total) in the linear totals model (and so LightGBM's compact set), or in
    LightGBM only, in the full pipeline backtest."""
    warnings.filterwarnings("ignore")
    import builtins
    df = load()
    require(df, ["team_total"])
    test = df[df["season"].isin(BACKTEST_SEASONS)].set_index("match_id")
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    quiet, builtins.print = builtins.print, (lambda *a, **k: None)
    try:
        base = pipeline_backtest(df)
        variants = {
            "12 team total in linear totals (and LightGBM)": pipeline_backtest(
                df, LINEAR_FEATURES={**LINEAR_FEATURES, "total": LINEAR_FEATURES["total"] + ["team_total"]}),
            "12 team total in LightGBM only": pipeline_backtest(
                df, LGB_COMPACT_EXTRA=LGB_COMPACT_EXTRA + ["team_total"]),
        }
    finally:
        builtins.print = quiet
    assert np.allclose(base.to_numpy(), bt.loc[base.index, base.columns].to_numpy())
    print("  harness reproduces reports/backtest_predictions.csv")
    for name, preds in variants.items():
        compare_pipelines(name, test, preds, base)
    t = test.loc[base.index]
    corr = np.corrcoef(t["team_total"], t["total"])[0, 1]
    res = pd.DataFrame(RESULTS)
    report = ["# Team total rating (2023–2025 backtest)", "",
              "`team_total`: a ridge regression of each match's total since 2009 on a total tendency per team "
              "(attack plus defence), refitted weekly on earlier games with the team margin rating's settings "
              "(two-year half-life). Added to the linear totals model (which also puts it in LightGBM's compact "
              "set) or to LightGBM only, and run through the full pipeline backtest. `diff` is new minus current "
              f"(negative = better), with a paired bootstrap 95% interval. Correlation of `team_total` with the "
              f"actual total over the backtest games: {corr:.3f}.", "",
              md_table(res.set_index("experiment")), ""]
    (REPORTS / "experiments_team_total.md").write_text("\n".join(report), encoding="utf-8")
    print(f"  corr(team_total, total) = {corr:.3f}")
    print("wrote reports/experiments_team_total.md")


# ---------------------------------------------------------------- 13. weekly refitting

def weekly_backtest(df):
    """Backtest with the models refitted before every round: settings (feature sets, penalties, trees)
    are developed once per season on earlier seasons, as now, but the model weights are refitted each
    round on every game before it, including the season's earlier rounds. Calibration still uses
    complete earlier seasons."""
    preds = []
    for season in BACKTEST_SEASONS:
        cfg, _, _ = models.develop(df[df["season"] < season], list(range(FIRST_SEASON + 1, season)))
        calib = list(range(FIRST_SEASON + 1, season))
        this = df[df["season"] == season]
        for rnd in sorted(this["round"].unique()):
            tr = df[(df["season"] < season) | ((df["season"] == season) & (df["round"] < rnd))]
            te = this[this["round"] == rnd]
            preds.append(models.fit_predict_frames(tr, te, cfg, calib)[0])
    out = pd.concat(preds)
    out.index = df.loc[out.index, "match_id"].to_numpy()
    return out


def weekly_experiments():
    """Weekly refitting against the current once-a-season fit, overall and by part of the season."""
    warnings.filterwarnings("ignore")
    import builtins
    df = load()
    test = df[df["season"].isin(BACKTEST_SEASONS)].set_index("match_id")
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    quiet, builtins.print = builtins.print, (lambda *a, **k: None)
    try:
        base = pipeline_backtest(df)
        weekly = weekly_backtest(df)
    finally:
        builtins.print = quiet
    assert np.allclose(base.to_numpy(), bt.loc[base.index, base.columns].to_numpy())
    print("  harness reproduces reports/backtest_predictions.csv")
    compare_pipelines("13 weekly refitting", test, weekly, base)
    # By part of the season: weekly refitting should matter most late in the season.
    rnd = test.loc[base.index, "round"]
    for part, mask in (("rounds 1-9", rnd <= 9), ("rounds 10-18", rnd.between(10, 18)), ("round 19+", rnd >= 19)):
        ids = base.index[mask.to_numpy()]
        for v in VARIANTS:
            col = f"{v}|ensemble|home_win"
            record(f"13 weekly refitting, {part}: ensemble", v, "home_win", test.loc[ids], weekly.loc[ids, col],
                   base.loc[ids, col])
    res = pd.DataFrame(RESULTS)
    report = ["# Weekly refitting (2023–2025 backtest)", "",
              "The current backtest fits each season's models once, before the season. Weekly refitting keeps "
              "each season's settings (developed on earlier seasons) but refits the model weights before every "
              "round on every game before it, including that season's earlier rounds; calibration still uses "
              "complete earlier seasons. `diff` is weekly minus current (negative = better), with a paired "
              "bootstrap 95% interval; the last rows split the win model by part of the season.", "",
              md_table(res.set_index("experiment")), ""]
    (REPORTS / "experiments_weekly.md").write_text("\n".join(report), encoding="utf-8")
    print("wrote reports/experiments_weekly.md")


# ---------------------------------------------------------------- 14. more context features

CONTEXT2_GROUPS = {
    # name: (features, targets whose linear models get them)
    "kickoff slot": (["night_game", "kickoff_thursday", "kickoff_friday", "kickoff_sunday"], ("home_win", "margin", "total")),
    "travel distance and time zones": (["diff_travel_km", "diff_tz_change"], ("home_win", "margin", "total")),
    "Origin representatives": (["diff_origin_reps"], ("home_win", "margin")),
}


def context2_experiments(groups=CONTEXT2_GROUPS, label="14", out="experiments_context2.md", title="More context features"):
    """Each feature group added to the linear models (and so LightGBM's compact set), or to LightGBM
    only, in the full pipeline backtest."""
    warnings.filterwarnings("ignore")
    import builtins
    df = load()
    require(df, [f for feats, _ in groups.values() for f in feats])
    test = df[df["season"].isin(BACKTEST_SEASONS)].set_index("match_id")
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    quiet, builtins.print = builtins.print, (lambda *a, **k: None)
    try:
        base = pipeline_backtest(df)
        variants = {}
        for name, (feats, targets) in groups.items():
            sets = {t: LINEAR_FEATURES[t] + (feats if t in targets else []) for t in LINEAR_FEATURES}
            variants[f"{label} {name} in linear (and LightGBM)"] = pipeline_backtest(df, LINEAR_FEATURES=sets)
            variants[f"{label} {name} in LightGBM only"] = pipeline_backtest(df, LGB_COMPACT_EXTRA=LGB_COMPACT_EXTRA + feats)
    finally:
        builtins.print = quiet
    assert np.allclose(base.to_numpy(), bt.loc[base.index, base.columns].to_numpy())
    print("  harness reproduces reports/backtest_predictions.csv")
    for name, preds in variants.items():
        compare_pipelines(name, test, preds, base, models=("ensemble",))
    res = pd.DataFrame(RESULTS)
    lines = [f"- **{n}:** " + ", ".join(f"`{f}`" for f in fs) + f" (linear: {', '.join(ts)})"
             for n, (fs, ts) in groups.items()]
    report = [f"# {title} (2023–2025 backtest)", "",
              "Each group is added to the linear models for the listed targets (which also puts it in "
              "LightGBM's compact set), or to LightGBM only, and run through the full pipeline backtest. "
              "Results are for the main ensembles. `diff` is new minus current (negative = better), with a "
              "paired bootstrap 95% interval.", "", *lines, "",
              md_table(res.set_index("experiment")), ""]
    (REPORTS / out).write_text("\n".join(report), encoding="utf-8")
    print(f"wrote reports/{out}")


STAR_GROUPS = {
    "stats-based stars": (["diff_stars_named", "diff_stars_out"], ("home_win", "margin")),
    "impact-based (RAPM) stars": (["diff_rapm_stars_named", "diff_rapm_stars_out"], ("home_win", "margin")),
}

KEY_ABSENCE_GROUPS = {
    "V1 key absences by position": (["diff_missq_fullback", "diff_missq_halfback", "diff_missq_five_eighth",
                                     "diff_missq_hooker"], ("home_win", "margin")),
    "V2 combined star-absence score": (["diff_key_absence"], ("home_win", "margin")),
    "V3 key stars out (top 20%)": (["diff_key_star_out"], ("home_win", "margin")),
    "V4 impact-based (with/without) stars out": (["diff_impact_out"], ("home_win", "margin")),
}

ORIGIN_STAR_GROUPS = {
    "S1 Origin stars out (spine / other)": (["diff_origin_stars_out_spine", "diff_origin_stars_out_other"],
                                            ("home_win", "margin")),
    "S2 Origin or elite-form stars out (spine / other)": (["diff_s2_stars_out_spine", "diff_s2_stars_out_other"],
                                                          ("home_win", "margin")),
}

LADDER_GROUPS = {
    "ladder position and contention": (["diff_ladder_pos", "diff_out_of_contention"], ("home_win", "margin", "total")),
}


# ---------------------------------------------------------------- 19. recalibration and bookmaker change

def recalibrate(preds, test, col, slope_only):
    """Recalibrate a model's final win probabilities for each season from 2024 using the earlier
    backtest seasons' (out-of-sample) predictions: logit(p') = a + b * logit(p), with a = 0 if
    slope_only. 2023 has no earlier backtest season and is left unchanged."""
    out = preds[col].copy()
    seasons = test.loc[preds.index, "season"]
    for season in BACKTEST_SEASONS[1:]:
        fit_rows, apply_rows = (seasons < season).to_numpy(), (seasons == season).to_numpy()
        z = logit(preds.loc[fit_rows, col].to_numpy()).reshape(-1, 1)
        m = LogisticRegression(C=1e6, fit_intercept=not slope_only).fit(z, test.loc[preds.index[fit_rows], "home_win"])
        out[apply_rows] = m.predict_proba(logit(preds.loc[apply_rows, col].to_numpy()).reshape(-1, 1))[:, 1]
    return out


def calibration_experiments():
    """Item 23 (recalibrating the final probabilities) and item 35 (the bookmaker change)."""
    warnings.filterwarnings("ignore")
    import builtins
    df = load()
    test = df[df["season"].isin(BACKTEST_SEASONS)].set_index("match_id")
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    quiet, builtins.print = builtins.print, (lambda *a, **k: None)
    try:
        base = pipeline_backtest(df)
        # BlueBet inputs are now part of the odds group; this compares with the group without them.
        without = {**config.FEATURE_GROUPS, "odds": [f for f in config.FEATURE_GROUPS["odds"]
                                                   if f not in ("bluebet", "open_logit_bluebet")]}
        bookmaker, base = base, pipeline_backtest(df, FEATURE_GROUPS=without)
    finally:
        builtins.print = quiet
    assert np.allclose(bookmaker.to_numpy(), bt.loc[bookmaker.index, bookmaker.columns].to_numpy())
    print("  harness reproduces reports/backtest_predictions.csv")
    later = test.loc[base.index, "season"].ge(BACKTEST_SEASONS[1]).to_numpy()
    for v in VARIANTS:
        for m in ("linear", "ensemble"):
            col = f"{v}|{m}|home_win"
            for slope_only, name in ((True, "slope only"), (False, "slope and intercept")):
                new = recalibrate(base, test, col, slope_only)
                record(f"19 recalibration ({name}): {m}, 2024-25", v, "home_win", test.loc[base.index[later]],
                       new[later], base.loc[later, col])
                record(f"19 recalibration ({name}): {m}, 2023-25", v, "home_win", test.loc[base.index], new, base[col])
    compare_pipelines("19 BlueBet inputs (with-odds models)", test, bookmaker, base)
    is_2025 = test.loc[base.index, "season"].eq(2025).to_numpy()
    for m in ("linear", "ensemble"):
        col = f"with_odds|{m}|home_win"
        record(f"19 BlueBet inputs: {m}, 2025 only", "with_odds", "home_win", test.loc[base.index[is_2025]],
               bookmaker.loc[is_2025, col], base.loc[is_2025, col])
    res = pd.DataFrame(RESULTS)
    report = ["# Recalibration and the bookmaker change (2023–2025 backtest)", "",
              "**Item 23:** the main models' final win probabilities are recalibrated for each season from 2024 "
              "using earlier backtest seasons' out-of-sample predictions (logit(p') = a + b·logit(p); slope only "
              "sets a = 0). 2023 has no earlier backtest season and is unchanged, so the 2024–25 rows are the "
              "fair comparison.", "",
              "**Item 35:** opening prices come from bet365 until April 2024 and BlueBet after. The with-odds "
              "models get a BlueBet indicator and opening log-odds × BlueBet as extra inputs, run through the full "
              "pipeline backtest; 2025 (all BlueBet, with part of 2024 in training) is where it can show.", "",
              "`diff` is new minus current (negative = better), with a paired bootstrap 95% interval.", "",
              md_table(res.set_index("experiment")), ""]
    (REPORTS / "experiments_calibration.md").write_text("\n".join(report), encoding="utf-8")
    print("wrote reports/experiments_calibration.md")


# ---------------------------------------------------------------- 20. weekly refit with weekly calibration

WEEKLY_CALIB_MIN_GAMES = 50


def weekly_recalibrate(preds, test, col, slope_only):
    """Recalibrate a model's final win probabilities before every round, on all of its earlier
    out-of-sample predictions (earlier backtest seasons and this season's earlier rounds):
    logit(p') = a + b * logit(p), a = 0 if slope_only. Needs WEEKLY_CALIB_MIN_GAMES earlier games."""
    t = test.loc[preds.index]
    out = preds[col].copy()
    z_all, y_all = logit(preds[col].to_numpy()), t["home_win"].to_numpy()
    kickoff = t["start_time_utc"]
    for (_, _), block in t.groupby(["season", "round"], sort=False):
        start = block["start_time_utc"].min()
        before = (kickoff < start).to_numpy()
        if before.sum() < WEEKLY_CALIB_MIN_GAMES:
            continue
        m = LogisticRegression(C=1e6, fit_intercept=not slope_only).fit(z_all[before].reshape(-1, 1), y_all[before])
        rows = preds.index.get_indexer(block.index)
        out.iloc[rows] = m.predict_proba(z_all[rows].reshape(-1, 1))[:, 1]
    return out


def weekly2_experiments():
    """Weekly refitting of the model weights and/or the calibration, against the current setup."""
    warnings.filterwarnings("ignore")
    import builtins
    df = load()
    test = df[df["season"].isin(BACKTEST_SEASONS)].set_index("match_id")
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    quiet, builtins.print = builtins.print, (lambda *a, **k: None)
    try:
        season_fit = pipeline_backtest(df)
        weekly_fit = weekly_backtest(df)
    finally:
        builtins.print = quiet
    assert np.allclose(season_fit.to_numpy(), bt.loc[season_fit.index, season_fit.columns].to_numpy())
    print("  harness reproduces reports/backtest_predictions.csv")
    weekly_fit = weekly_fit.loc[season_fit.index]
    t = test.loc[season_fit.index]
    late = t["round"].ge(19).to_numpy()
    rows = []
    for v in VARIANTS:
        for m in ("ensemble", "linear"):
            col = f"{v}|{m}|home_win"
            setups = {"B weekly model refit": weekly_fit[col]}
            for slope_only, how in ((True, "slope only"), (False, "slope and intercept")):
                setups[f"C weekly refit + weekly calibration ({how})"] = weekly_recalibrate(weekly_fit, test, col, slope_only)
                setups[f"D weekly calibration only ({how})"] = weekly_recalibrate(season_fit, test, col, slope_only)
            for name, p in setups.items():
                record(f"20 {name}: {m}", v, "home_win", t, p, season_fit[col])
                record(f"20 {name}: {m}, round 19+", v, "home_win", t[late], p[late], season_fit.loc[late, col])
    res = pd.DataFrame(RESULTS)
    report = ["# Weekly refitting with weekly calibration (2023–2025 backtest)", "",
              "A (the baseline) fits the models and calibration once per season. B refits the model weights "
              "before every round (each season's settings fixed). C also recalibrates the final win probability "
              "before every round on all earlier out-of-sample predictions (earlier backtest seasons and this "
              f"season's earlier rounds; at least {WEEKLY_CALIB_MIN_GAMES} games). D recalibrates weekly without "
              "refitting the weights. `diff` is the set-up minus A (negative = better), with a paired bootstrap "
              "95% interval; round 19+ rows cover the late season.", "",
              md_table(res.set_index("experiment")), ""]
    (REPORTS / "experiments_weekly_calibration.md").write_text("\n".join(report), encoding="utf-8")
    print("wrote reports/experiments_weekly_calibration.md")


# ---------------------------------------------------------------- 39. learned blend, market as a separate expert

BLEND_SETS = {
    # name: (win experts, margin experts, total experts)
    "no-odds models only": (["lin_win", "lin_margin", "gbm_win", "elo"], ["lin", "gbm"], ["lin", "gbm"]),
    "no-odds models + market": (["lin_win", "lin_margin", "gbm_win", "elo", "market"], ["lin", "gbm", "market"],
                                ["lin", "gbm", "market"]),
    "no-odds linear + LightGBM + market": (["lin_win", "gbm_win", "market"], ["lin", "gbm", "market"],
                                           ["lin", "gbm", "market"]),
}


def blend_experts(df, cfg, season):
    """Walk-forward out-of-sample predictions of every no-odds expert for FIRST_SEASON+1..season, with
    the season's backtest settings (cfg, developed on earlier seasons only): each season is predicted
    by models trained on the seasons before it. Win experts are on the log-odds scale."""
    d = df[df["season"] <= season]
    seasons = list(range(FIRST_SEASON + 1, season + 1))
    fs, mc = cfg["feature_sets"]["no_odds"], cfg["models"]["no_odds"]
    out = pd.DataFrame(index=d.index)
    for target in TARGETS:
        m = mc[target]
        out[f"lin_{target}"] = models.cv_linear(d, fs["linear"][target], target, m["linear"], seasons)[1]
        out[f"gbm_{target}"] = pd.concat(
            [cv_lgb(d, fs["lightgbm"], target, {**m["lgb"], "seed": s}, seasons, n_rounds=m["lgb_rounds"])[1]
             for s in range(m.get("lgb_seeds", 1))], axis=1).mean(axis=1)
    out = out[out.notna().all(axis=1)]
    d = d.loc[out.index]
    win = pd.DataFrame({"lin_win": logit(out["lin_home_win"].to_numpy()), "gbm_win": logit(out["gbm_home_win"].to_numpy()),
                        "elo": d["elo_logit"].to_numpy(), "market": d["open_logit"].to_numpy()}, index=out.index)
    # The linear margin model as a win expert: P = Phi(margin / sigma), sigma from earlier seasons' errors.
    earlier = (d["season"] < season).to_numpy()
    sigma = np.std((d["margin"] - out["lin_margin"])[earlier])
    win["lin_margin"] = logit(np.clip(norm.cdf(out["lin_margin"] / sigma), 1e-6, 1 - 1e-6))
    margin = pd.DataFrame({"lin": out["lin_margin"], "gbm": out["gbm_margin"], "market": -d["open_line"]})
    total = pd.DataFrame({"lin": out["lin_total"], "gbm": out["gbm_total"], "market": d["open_total"]})
    return d, win, margin, total


def fit_win_blend(X, y):
    """Logistic blend of log-odds experts with non-negative weights and a free intercept:
    p = sigmoid(a + sum w_i x_i), w_i >= 0. Equivalent to weights that sum to 1 followed by Platt
    calibration (slope = sum of w). Returns (a, w)."""
    X, y = np.asarray(X, float), np.asarray(y, float)

    def loss(theta):
        z = theta[0] + X @ theta[1:]
        return np.mean(np.logaddexp(0, z) - y * z)

    k = X.shape[1]
    res = minimize(loss, np.r_[0.0, np.full(k, 1.0 / k)], method="L-BFGS-B",
                   bounds=[(None, None)] + [(0, None)] * k)
    return res.x[0], res.x[1:]


def fit_point_blend(X, y):
    """Margin or total blend: intercept + weights that are non-negative and sum to 1, least squares."""
    X, y = np.asarray(X, float), np.asarray(y, float)
    k = X.shape[1]

    def loss(theta):
        return np.mean((y - theta[0] - X @ theta[1:]) ** 2)

    res = minimize(loss, np.r_[0.0, np.full(k, 1.0 / k)], method="SLSQP",
                   bounds=[(None, None)] + [(0, 1)] * k,
                   constraints=[{"type": "eq", "fun": lambda t: t[1:].sum() - 1}])
    return res.x[0], res.x[1:]


def blend_experiments():
    """Item 39: no odds in the models; the opening market is a separate expert in a learned blend."""
    warnings.filterwarnings("ignore")
    import builtins
    df = load()
    test = df[df["season"].isin(BACKTEST_SEASONS)].set_index("match_id")
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    quiet, builtins.print = builtins.print, (lambda *a, **k: None)
    try:
        current, details = models.backtest(df)
    finally:
        builtins.print = quiet
    current.index = df.loc[current.index, "match_id"].to_numpy()
    assert np.allclose(current.to_numpy(), bt.loc[current.index, current.columns].to_numpy())
    print("  harness reproduces reports/backtest_predictions.csv")

    blends, weights = {}, []
    for season in BACKTEST_SEASONS:
        print(f"  {season}: walk-forward experts on {FIRST_SEASON + 1}-{season}...")
        d, win, margin, total = blend_experts(df, details[season][0], season)
        fit, pred = (d["season"] < season).to_numpy(), (d["season"] == season).to_numpy()
        ids = d.loc[pred, "match_id"].to_numpy()
        for name, (w_cols, m_cols, t_cols) in BLEND_SETS.items():
            a, w = fit_win_blend(win.loc[fit, w_cols], d.loc[fit, "home_win"])
            p = 1 / (1 + np.exp(-(a + win.loc[pred, w_cols].to_numpy() @ w)))
            weights.append({"blend": name, "target": "home_win", "season": season, "calibration slope": w.sum(),
                            **{c: wi / w.sum() for c, wi in zip(w_cols, w)}})
            cols = {"home_win": p}
            for target, X, ecols in (("margin", margin, m_cols), ("total", total, t_cols)):
                a, w = fit_point_blend(X.loc[fit, ecols], d.loc[fit, target])
                cols[target] = a + X.loc[pred, ecols].to_numpy() @ w
                weights.append({"blend": name, "target": target, "season": season,
                                **{c: wi for c, wi in zip(ecols, w)}})
            blends.setdefault(name, []).append(pd.DataFrame(cols, index=ids))
    blends = {k: pd.concat(v).loc[current.index] for k, v in blends.items()}
    t = test.loc[current.index]

    # Every blend against both current main models, on the same 631 games.
    for name, b in blends.items():
        for v in VARIANTS:
            for target in TARGETS:
                record(f"39 blend: {name} vs {VARIANT_LABEL[v].lower()} ensemble", v, target, t, b[target],
                       current[f"{v}|{config.MAIN_MODEL}|{target}"])
    # Simplest version: the current (calibrated) no-odds ensemble and the opening market, averaged on the
    # log-odds scale with one weight chosen on the earlier backtest seasons (so 2024-25 only).
    z_no, z_mk = logit(current[f"no_odds|{config.MAIN_MODEL}|home_win"].to_numpy()), t["open_logit"].to_numpy()
    seasons, grid = t["season"].to_numpy(), np.linspace(0, 1, 21)
    simple, simple_w = pd.Series(np.nan, index=t.index), {}
    for season in BACKTEST_SEASONS[1:]:
        fit = seasons < season
        loss = lambda w: models.score(t["home_win"][fit], 1 / (1 + np.exp(-((1 - w) * z_no + w * z_mk)[fit])), "clf")
        w = simple_w[season] = min(grid, key=loss)
        rows_s = seasons == season
        simple[rows_s] = 1 / (1 + np.exp(-((1 - w) * z_no + w * z_mk)[rows_s]))
    later = seasons >= BACKTEST_SEASONS[1]
    for v in VARIANTS:
        record(f"39 one-weight blend: no-odds ensemble + market vs {VARIANT_LABEL[v].lower()} ensemble, 2024-25",
               v, "home_win", t[later], simple[later], current.loc[later, f"{v}|{config.MAIN_MODEL}|home_win"],
               note="market weight " + ", ".join(f"{s}: {w:.2f}" for s, w in simple_w.items()))
    res = pd.DataFrame(RESULTS)

    # Summary: every model's pooled scores, with the market for reference.
    rows = {}
    for v in VARIANTS:
        rows[f"Current: {VARIANT_LABEL[v].lower()} ensemble"] = [current[f"{v}|{config.MAIN_MODEL}|{x}"] for x in TARGETS]
    for name, b in blends.items():
        rows[f"Blend: {name}"] = [b[x] for x in TARGETS]
    rows["Market opening"] = [t["p_open"], -t["open_line"], t["open_total"]]
    rows["Market average (closing)"] = [t["p_avg"], None, None]
    summary = pd.DataFrame({k: {"log_loss": models.score(t["home_win"], p, "clf"),
                                "accuracy": ((np.asarray(p) > 0.5) == t["home_win"]).mean(),
                                "margin_mae": np.nan if m is None else np.mean(np.abs(t["margin"] - m)),
                                "total_mae": np.nan if tt is None else np.mean(np.abs(t["total"] - tt))}
                            for k, (p, m, tt) in rows.items()}).T.rename_axis("model")
    w = pd.DataFrame(weights).set_index(["blend", "target", "season"])
    w.index = [f"{b} | {tg} | {s}" for b, tg, s in w.index]
    w.index.name = "blend | target | season"

    # Head-to-head betting at opening prices (as betting.py, 2% minimum edge) and closing line value.
    bet_rows = []
    odds = load_odds()
    ids = join_odds_to_matches(t.rename_axis("match_id").reset_index()[["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    prices = odds.set_index("odds_id")[["home_odds_open", "away_odds_open"]]
    g = t.join(ids.set_index("match_id")["odds_id"]).join(prices, on="odds_id")
    probs = {f"Current: {VARIANT_LABEL[v].lower()} ensemble": current[f"{v}|{config.MAIN_MODEL}|home_win"] for v in VARIANTS}
    probs.update({f"Blend: {k}": b["home_win"] for k, b in blends.items()})
    ok = g["close_ok"].astype(bool)
    for name, p in probs.items():
        p = p.loc[g.index]
        bets = pd.concat([
            pd.DataFrame({"edge": p * g["home_odds_open"] - 1, "odds": g["home_odds_open"], "won": g["home_win"],
                          "clv": (g["p_close"] - g["p_open"]).where(ok)}),
            pd.DataFrame({"edge": (1 - p) * g["away_odds_open"] - 1, "odds": g["away_odds_open"],
                          "won": 1 - g["home_win"], "clv": (g["p_open"] - g["p_close"]).where(ok)})])
        x = bets[bets["edge"] > 0.02]
        profit = np.where(x["won"] == 1, x["odds"] - 1, -1.0)
        boot = profit[np.random.default_rng(0).integers(0, len(profit), (N_BOOT, len(profit)))].mean(axis=1)
        bet_rows.append({"model": name, "bets": len(x), "ROI": profit.mean(), "ROI ci_low": np.percentile(boot, 2.5),
                         "ROI ci_high": np.percentile(boot, 97.5), "CLV bets": x["clv"].notna().sum(),
                         "CLV mean": x["clv"].mean(), "CLV positive": (x["clv"].dropna() > 0).mean()})
    bet_table = pd.DataFrame(bet_rows).set_index("model")

    print(md_table(summary))
    print(md_table(w.round(3)))
    print(md_table(bet_table))
    report = ["# Learned blend with the market as a separate expert (2023–2025 backtest)", "",
              "Item 39, after Levon Rush's Footy Tipper. **No odds go into any model.** The experts are the no-odds "
              "models (linear win, linear margin turned into a win probability, LightGBM win, and Elo) and, "
              "separately, the opening market (log-odds with the margin removed proportionally; the opening line "
              "and total for margin and total). For each backtest season, every expert's walk-forward "
              f"out-of-sample predictions for {FIRST_SEASON + 1} to the season before (each season predicted by "
              "models trained on earlier seasons, with that backtest season's settings) are used to fit the blend, "
              "which then predicts the season.", "",
              "- **Win:** p = sigmoid(a + Σ wᵢ·expertᵢ) with wᵢ ≥ 0, fitted by log loss. This is the same as "
              "weights that sum to 1 followed by Platt calibration; the table shows each expert's share of the "
              "weight and the calibration slope (the sum).",
              "- **Margin and total:** intercept + weights that are non-negative and sum to 1, fitted by least "
              "squares.",
              "- **One-weight blend:** the current no-odds ensemble's (calibrated) probability and the opening "
              "market, averaged on the log-odds scale, with the market's weight chosen on the earlier backtest "
              "seasons (so scored on 2024–25 only).", "",
              "## Pooled scores (631 games)", "", md_table(summary), "",
              "## Each blend against the current main models", "",
              "`diff` is the blend minus the current model (negative = blend better), with a paired bootstrap "
              "95% interval.", "", md_table(res.set_index("experiment")), "",
              "## Blend weights by season", "",
              "Win: each expert's share of the total weight, and the calibration slope. Margin and total: the "
              "weights themselves (they sum to 1).", "", md_table(w.round(3)), "",
              "## Head-to-head betting at opening prices (2% minimum edge)", "",
              "Flat 1-unit bets as in `betting.py`. CLV is the move in the closing price's implied probability in "
              "the bet's favour, where closing prices are reliable (mostly 2023).", "", md_table(bet_table), ""]
    (REPORTS / "experiments_blend.md").write_text("\n".join(report), encoding="utf-8")
    print("wrote reports/experiments_blend.md")


# ---------------------------------------------------------------- 42. Shin margin removal

def shin_experiments():
    """Item 42 (and 26): Shin's margin removal instead of the proportional method, as the market
    benchmark and as the with-odds models' opening-odds input."""
    warnings.filterwarnings("ignore")
    import builtins
    df = load()
    odds = load_odds()
    ids = join_odds_to_matches(df[["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    shin = ids.set_index("match_id")[["odds_id"]].join(
        odds.set_index("odds_id")[["p_open_shin", "p_close_shin", "p_avg_shin"]], on="odds_id")
    df = df.join(shin.drop(columns="odds_id"), on="match_id")

    # 1. As a benchmark: the market's own log loss with each method (no fitting involved), 2021-2025.
    bench = []
    for name, prop, sh, rows in (("opening", "p_open", "p_open_shin", df["p_open"].notna()),
                                 ("closing (reliable games)", "p_close", "p_close_shin", df["close_ok"].astype(bool)),
                                 ("Odds Portal average", "p_avg", "p_avg_shin", df["p_avg"].notna())):
        for seasons, label in ((range(FIRST_SEASON, 2026), f"{FIRST_SEASON}-2025"), (BACKTEST_SEASONS, "2023-2025")):
            d = df[rows & df["season"].isin(seasons) & df[sh].notna()]
            new_s, base_s, diff, lo, hi = paired(d["home_win"], d[sh], d[prop], "clf")
            bench.append({"market": name, "seasons": label, "games": len(d), "proportional": base_s, "Shin": new_s,
                          "diff": diff, "ci_low": lo, "ci_high": hi})
    bench = pd.DataFrame(bench).set_index("market")
    print(md_table(bench))

    # 2. As the with-odds models' input: the full pipeline backtest with Shin opening log-odds.
    test = df[df["season"].isin(BACKTEST_SEASONS)].set_index("match_id")
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    shin_df = df.assign(open_logit=logit(df["p_open_shin"].to_numpy()))
    shin_df["open_logit_bluebet"] = shin_df["open_logit"] * shin_df["bluebet"]
    quiet, builtins.print = builtins.print, (lambda *a, **k: None)
    try:
        base = pipeline_backtest(df)
        new = pipeline_backtest(shin_df)
    finally:
        builtins.print = quiet
    assert np.allclose(base.to_numpy(), bt.loc[base.index, base.columns].to_numpy())
    print("  harness reproduces reports/backtest_predictions.csv")
    for m in ("linear", "ensemble"):
        for t in TARGETS:
            col = f"with_odds|{m}|{t}"
            record(f"42 Shin opening odds as input: {m}", "with_odds", t, test.loc[new.index], new[col], base[col])
    res = pd.DataFrame(RESULTS)
    report = ["# Shin margin removal (item 42)", "",
              "Shin's method takes more of the bookmaker's margin off the longshot than the proportional method "
              "(it models favourite-longshot bias). Compared two ways.", "",
              "## As the market benchmark", "",
              "The market's log loss with each method; `diff` is Shin minus proportional (negative = Shin better), "
              "with a paired bootstrap 95% interval. No fitting involved.", "", md_table(bench), "",
              "## As the with-odds models' input (2023-2025 backtest)", "",
              "The opening log-odds (and the BlueBet interaction) computed with Shin's method, rerun through the "
              "full backtest. `diff` is new minus current (negative = better).", "",
              md_table(res.set_index("experiment")), ""]
    (REPORTS / "experiments_shin.md").write_text("\n".join(report), encoding="utf-8")
    print("wrote reports/experiments_shin.md")


# ---------------------------------------------------------------- 41. disagreement analysis

DISAGREE_DRIVERS = ["elo_logit", "team_margin", "diff_rapm_total", "diff_rapm_vs_usual", "diff_rapm_defence",
                    "diff_s2_stars_out_spine", "diff_s2_stars_out_other", "diff_rest_days", "diff_rookies"]


def disagreement_experiments():
    """Item 41: where the main with-odds model disagrees most with the opening market, who was right,
    and what drove the disagreement. Uses the saved out-of-sample predictions only (no refitting)."""
    warnings.filterwarnings("ignore")
    feats = pd.read_csv(PROCESSED / "features.csv").set_index("match_id")
    preds = {"2023-2025 backtest": pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")}
    final = REPORTS / "predictions_2026.csv"
    if final.exists():
        preds["2026 final test"] = pd.read_csv(final).set_index("match_id")
    model = f"with_odds|{config.MAIN_MODEL}|home_win"
    report = ["# Disagreement with the market (item 41)", "",
              f"The main with-odds model ({config.MAIN_MODEL}) against the opening market, on out-of-sample "
              "predictions. Disagreement = model log-odds minus opening log-odds (positive = the model rates the "
              "home team higher). `toward closing` is how often the closing price moved towards the model "
              "(reliable closing prices only). Log loss: lower is better.", ""]
    for name, p in preds.items():
        d = p[[model, "home_win", "p_open", "p_close", "p_avg", "season"]].join(
            feats[["close_ok", "home_team", "away_team", "round"] + DISAGREE_DRIVERS])
        d["disagree"] = logit(d[model].to_numpy()) - logit(d["p_open"].to_numpy())
        d["size"] = d["disagree"].abs()
        d["band"] = pd.qcut(d["size"], [0, 0.5, 0.8, 0.9, 1.0],
                            labels=["smallest 50%", "50-80%", "80-90%", "largest 10%"])
        ok = d["close_ok"].astype(bool)
        toward = np.sign(logit(d["p_close"].to_numpy()) - logit(d["p_open"].to_numpy())) == np.sign(d["disagree"])
        moved = d["p_close"] != d["p_open"]
        rows = {}
        for band, g in d.groupby("band", observed=True):
            gok = g[ok.loc[g.index]]
            rows[band] = {"games": len(g), "mean |disagreement| (prob. points)":
                              (g[model] - g["p_open"]).abs().mean() * 100,
                          "model": models.score(g["home_win"], g[model], "clf"),
                          "market opening": models.score(g["home_win"], g["p_open"], "clf"),
                          "market average": models.score(g["home_win"], g["p_avg"], "clf"),
                          "model better than opening": "yes" if models.score(g["home_win"], g[model], "clf")
                          < models.score(g["home_win"], g["p_open"], "clf") else "no",
                          "closing games": len(gok),
                          "toward closing": (toward & moved)[gok.index].sum() / max(moved[gok.index].sum(), 1)}
        bands = pd.DataFrame(rows).T.rename_axis("disagreement")

        # What drives the disagreement: a descriptive regression on standardised features.
        X = d[DISAGREE_DRIVERS].fillna(0)
        X = (X - X.mean()) / X.std().replace(0, 1)
        reg = Ridge(alpha=1.0).fit(X, d["disagree"])
        r2_all = reg.score(X, d["disagree"])
        drivers = pd.DataFrame({"standardised effect": reg.coef_}, index=DISAGREE_DRIVERS)
        drivers["R² without it"] = [Ridge(alpha=1.0).fit(X.drop(columns=c), d["disagree"]).score(
            X.drop(columns=c), d["disagree"]) for c in DISAGREE_DRIVERS]
        drivers["R² lost"] = r2_all - drivers["R² without it"]
        drivers = drivers.sort_values("R² lost", ascending=False).rename_axis("feature")

        top = d.sort_values("size", ascending=False).head(15)
        top_table = pd.DataFrame({
            "game": top["season"].astype(str) + " R" + top["round"].astype(str) + " " + top["home_team"]
                    + " v " + top["away_team"],
            "model": top[model], "opening": top["p_open"],
            "closing": top["p_close"].where(top["close_ok"].astype(bool)),
            "home won": top["home_win"],
            "stars out (home - away)": top["diff_s2_stars_out_spine"] + top["diff_s2_stars_out_other"],
            "line-up vs usual (RAPM)": top["diff_rapm_vs_usual"]}).set_index("game")
        print(name); print(md_table(bands)); print(md_table(drivers))
        report += [f"## {name} ({len(d)} games)", "", "### By size of disagreement", "", md_table(bands), "",
                   f"### What drives it (ridge on standardised features, R² = {r2_all:.2f})", "",
                   "`R² lost` is how much of the disagreement this feature explains on its own share.", "",
                   md_table(drivers), "", "### The 15 biggest disagreements", "", md_table(top_table), ""]
    (REPORTS / "experiments_disagreement.md").write_text("\n".join(report), encoding="utf-8")
    print("wrote reports/experiments_disagreement.md")


# ---------------------------------------------------------------- 40. pre-kickoff team lists

def opening_h2h(g, probs, min_edge=0.02):
    """Flat head-to-head bets at opening prices for each set of win probabilities (as betting.py):
    ROI with a bootstrap interval, and closing line value where closing prices are reliable."""
    odds = load_odds()
    ids = join_odds_to_matches(g.rename_axis("match_id").reset_index()[
        ["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    g = g.join(ids.set_index("match_id")["odds_id"]).join(
        odds.set_index("odds_id")[["home_odds_open", "away_odds_open"]], on="odds_id")
    ok = g["close_ok"].astype(bool)
    rows = []
    for name, p in probs.items():
        p = p.loc[g.index]
        bets = pd.concat([
            pd.DataFrame({"edge": p * g["home_odds_open"] - 1, "odds": g["home_odds_open"], "won": g["home_win"],
                          "clv": (g["p_close"] - g["p_open"]).where(ok)}),
            pd.DataFrame({"edge": (1 - p) * g["away_odds_open"] - 1, "odds": g["away_odds_open"],
                          "won": 1 - g["home_win"], "clv": (g["p_open"] - g["p_close"]).where(ok)})])
        x = bets[bets["edge"] > min_edge]
        profit = np.where(x["won"] == 1, x["odds"] - 1, -1.0)
        boot = profit[np.random.default_rng(0).integers(0, len(profit), (N_BOOT, len(profit)))].mean(axis=1)
        rows.append({"model": name, "bets": len(x), "ROI": profit.mean(), "ROI ci_low": np.percentile(boot, 2.5),
                     "ROI ci_high": np.percentile(boot, 97.5), "CLV bets": int(x["clv"].notna().sum()),
                     "CLV mean": x["clv"].mean(), "CLV positive": (x["clv"].dropna() > 0).mean()})
    return pd.DataFrame(rows).set_index("model")


def pre_kickoff_experiments():
    """Item 40: the main models (trained as now, on final named 17s) fed each game's pre-kickoff team
    list (teamlists.py; usually Tuesday's) instead of its final named 17, on the games that have one."""
    warnings.filterwarnings("ignore")
    import builtins
    import json
    from features import PRE_KICKOFF_FILE
    pre_file = PROCESSED / "features_pre_kickoff.csv"
    if not pre_file.exists():
        raise SystemExit("Run `python src/teamlists.py` then `python src/features.py --pre-kickoff` first.")
    full = models.load_data()
    pre_all = pd.read_csv(pre_file).set_index("match_id")
    lists = pd.read_csv(PRE_KICKOFF_FILE)
    df = full[full["season"] <= max(BACKTEST_SEASONS)]
    quiet, builtins.print = builtins.print, (lambda *a, **k: None)
    try:
        _, details = models.backtest(df)
    finally:
        builtins.print = quiet
    cfgs = {s: details[s][0] for s in BACKTEST_SEASONS}
    final_run = REPORTS / f"final_{config.TEST_SEASON}_run.json"
    if final_run.exists():
        cfgs[config.TEST_SEASON] = json.loads(final_run.read_text())["cfg"]
    saved = {s: pd.read_csv(REPORTS / ("backtest_predictions.csv" if s in BACKTEST_SEASONS
                                       else f"predictions_{s}.csv")).set_index("match_id") for s in cfgs}

    from features import feature_columns
    cols = [c for c in feature_columns() if c in pre_all.columns]
    preds = []
    for s, cfg in cfgs.items():
        train, test = full[full["season"] < s], full[full["season"] == s]
        pre = pre_all.reindex(test["match_id"].to_numpy())
        test_pre = test.copy()
        for c in cols:
            test_pre[c] = pre[c].to_numpy()
        calib = list(range(FIRST_SEASON + 1, s))
        p_final = models.fit_predict_frames(train, test, cfg, calib)[0]
        p_pre = models.fit_predict_frames(train, test_pre, cfg, calib)[0]
        ref = saved[s].loc[test["match_id"].to_numpy(), p_final.columns]
        assert np.allclose(p_final.to_numpy(), ref.to_numpy()), s  # the pipeline's own predictions
        out = pd.DataFrame({"season": s, "has_list": pre["pre_kickoff_list"].eq(1).to_numpy()},
                           index=test["match_id"].to_numpy())
        for v in VARIANTS:
            for t in TARGETS:
                out[f"{v}|final|{t}"] = p_final[f"{v}|{config.MAIN_MODEL}|{t}"].to_numpy()
                out[f"{v}|pre|{t}"] = p_pre[f"{v}|{config.MAIN_MODEL}|{t}"].to_numpy()
        preds.append(out)
        print(f"  {s}: {int(out['has_list'].sum())} of {len(out)} games have a pre-kickoff list")
    preds = pd.concat(preds)
    feats = full.set_index("match_id")

    # How different the pre-kickoff lists are from the final named 17s.
    named_final = pd.read_csv(PROCESSED / "player_match_stats.csv")
    named_final = named_final[~named_final["position"].isin(["Replacement", "Reserve"])]
    final_sets = named_final.groupby(["match_id", "team"])["player_id"].agg(set)
    pre_named = lists[~lists["position"].isin(["Replacement", "Reserve"]) & (lists["jersey_number"] <= 17)]
    pre_sets = pre_named.groupby(["match_id", "team"])["player_id"].agg(set)
    both = pre_sets.index.intersection(final_sets.index)
    season_of = lists.groupby("match_id")["season"].first()
    changed = pd.DataFrame({"season": season_of.reindex(both.get_level_values(0)).to_numpy(),
                            "changes": [len(pre_sets[k] - final_sets[k]) for k in both]})
    per_game = lists.groupby("match_id")[["season", "hours_before"]].first()
    change_table = pd.DataFrame({
        "teams": changed.groupby("season").size(),
        "teams with any change": changed.assign(any=changed["changes"] > 0).groupby("season")["any"].mean(),
        "mean players changed": changed.groupby("season")["changes"].mean(),
        "median hours before kickoff": per_game.groupby("season")["hours_before"].median(),
    }).rename_axis("season")

    sections = []
    for label, seasons in ((f"{BACKTEST_SEASONS[0]}-{BACKTEST_SEASONS[-1]} backtest", BACKTEST_SEASONS),
                           (f"{config.TEST_SEASON} final test", [config.TEST_SEASON])):
        p = preds[preds["season"].isin(seasons) & preds["has_list"]]
        if p.empty:
            continue
        t = feats.loc[p.index]
        scores = {}
        for v in VARIANTS:
            for when, name in (("final", "final named 17"), ("pre", "pre-kickoff list")):
                scores[f"{VARIANT_LABEL[v]} ensemble, {name}"] = {
                    "log_loss": models.score(t["home_win"], p[f"{v}|{when}|home_win"], "clf"),
                    "accuracy": ((p[f"{v}|{when}|home_win"] > 0.5) == t["home_win"]).mean(),
                    "margin_mae": np.mean(np.abs(t["margin"] - p[f"{v}|{when}|margin"])),
                    "total_mae": np.mean(np.abs(t["total"] - p[f"{v}|{when}|total"]))}
            record(f"40 pre-kickoff list vs final named 17, {label}", v, "home_win", t,
                   p[f"{v}|pre|home_win"], p[f"{v}|final|home_win"])
            record(f"40 pre-kickoff list vs market opening, {label}", v, "home_win", t,
                   p[f"{v}|pre|home_win"], t["p_open"])
        scores["Market opening"] = {"log_loss": models.score(t["home_win"], t["p_open"], "clf"),
                                    "accuracy": ((t["p_open"] > 0.5) == t["home_win"]).mean(),
                                    "margin_mae": np.mean(np.abs(t["margin"] + t["open_line"])),
                                    "total_mae": np.mean(np.abs(t["total"] - t["open_total"]))}
        scores["Market average (closing)"] = {"log_loss": models.score(t["home_win"], t["p_avg"], "clf"),
                                              "accuracy": ((t["p_avg"] > 0.5) == t["home_win"]).mean()}
        bets = opening_h2h(t, {f"{VARIANT_LABEL[v]} ensemble, {name}": p[f"{v}|{when}|home_win"]
                               for v in VARIANTS for when, name in (("final", "final named 17"),
                                                                    ("pre", "pre-kickoff list"))})
        scores = pd.DataFrame(scores).T.rename_axis("model")
        print(label); print(md_table(scores)); print(md_table(bets))
        sections += [f"## {label} ({len(p)} games with a pre-kickoff list)", "", md_table(scores), "",
                     "Head-to-head bets at opening prices (2% minimum edge):", "", md_table(bets), ""]
    res = pd.DataFrame(RESULTS)
    report = ["# Pre-kickoff team lists (item 40)", "",
              "Footy Tipper trains and predicts on the team list as it stood at least a day before kickoff. Our "
              "line-up features use the final named 17, which can include late changes the opening price never "
              "saw. `teamlists.py` recovers, from the Internet Archive's snapshots of nrl.com match pages, each "
              "game's earliest list published after the Tuesday announcement and at least 24 hours before kickoff "
              "(usually Tuesday evening's 22-man squad: jerseys 1–17 named). `features.py --pre-kickoff` "
              "describes each game by that list instead (team ratings, rookies, RAPM and star absences; history "
              "still uses the teams that actually played).", "",
              "Here the main models, trained exactly as in the backtest (and the 2026 final run), predict each "
              "game twice: from its final named 17 (the pipeline's own predictions, checked) and from its "
              "pre-kickoff list. Only games with a list for both teams are compared.", "",
              "## How different the lists are", "", md_table(change_table), "",
              *sections,
              "## Paired comparisons (log loss; negative = the pre-kickoff version better)", "",
              md_table(res.set_index("experiment")), ""]
    (REPORTS / "experiments_pre_kickoff.md").write_text("\n".join(report), encoding="utf-8")
    preds.to_csv(REPORTS / "pre_kickoff_predictions.csv")
    print("wrote reports/experiments_pre_kickoff.md")


# ---------------------------------------------------------------- main

def main():
    warnings.filterwarnings("ignore")
    df = load()
    test = df[df["season"].isin(BACKTEST_SEASONS)]
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    odds = load_odds()

    print("baseline linear backtest...")
    base, base_extra = {}, {}
    for v in VARIANTS:
        base[v], base_extra[v] = run_linear(lambda s: df, feats_for(v))
        for t in ("margin", "total"):  # unchanged since; the harness must reproduce train.py exactly
            assert np.allclose(base[v][t].to_numpy(), bt.loc[base[v].index, f"{v}|linear|{t}"].to_numpy()), (v, t)
    print("  margin and total match reports/backtest_predictions.csv")

    def compare(name, variant, preds, targets=TARGETS):
        for t in targets:
            record(name, variant, t, test.set_index("match_id").loc[preds.index], preds[t], base[variant][t])

    # 1. Re-tests of ideas rejected on 2025 alone.
    for v in VARIANTS:
        p_margin = margin_to_prob(test, base[v], base_extra[v])
        compare("1a win prob from margin", v, pd.DataFrame({"home_win": p_margin}), ["home_win"])
        blend = (p_margin + base[v]["home_win"]) / 2
        compare("1a blend: logistic + margin", v, pd.DataFrame({"home_win": blend}), ["home_win"])
    offset = pd.concat([offset_logistic(df, s, BASELINE_FEATURES["home_win"]) for s in BACKTEST_SEASONS])
    compare("1b market offset + no-odds features", "with_odds", pd.DataFrame({"home_win": offset}), ["home_win"])
    for hl in (1, 2):
        w = lambda tr, s, hl=hl: 0.5 ** ((s - 1 - tr["season"].to_numpy()) / hl)
        for v in VARIANTS:
            compare(f"1c recency weights (half-life {hl} season)", v, run_linear(lambda s: df, feats_for(v), w)[0])
    elo_all, elo_six = elo_variants(df, odds)
    for name, fn in (("1d Elo retuned 2013..year-1", elo_all), ("1d Elo retuned 2020..year-1", elo_six)):
        for v in VARIANTS:
            compare(name, v, run_linear(fn, feats_for(v))[0], ["home_win", "margin"])

    # 2. Probabilistic margin and total vs the opening line and total.
    prob = pd.concat([probabilistic(df, base[v], base_extra[v], v) for v in VARIANTS])
    print(md_table(prob.set_index("model")))

    # 3. Team margin rating and team-specific home advantage (settings chosen per backtest year).
    configs = {(hl, hp): team_ratings(odds, hl, hp) for hl in (180, 365, 730) for hp in (3, 10, 30)}
    m = join_odds_to_matches(df[["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    odds_id = m.set_index("match_id")["odds_id"]

    def with_team(cfg):
        tr = configs[cfg].set_index("odds_id").reindex(odds_id.loc[df["match_id"]].to_numpy())
        return df.assign(team_margin=tr["team_margin"].to_numpy(), team_hfa=tr["team_hfa"].to_numpy())

    team_dfs = {cfg: with_team(cfg) for cfg in configs}

    def pick(season, feats):
        def cv_loss(cfg):
            d = team_dfs[cfg]
            tr = d[d["season"] < season]
            cv = list(range(FIRST_SEASON + 1, season))
            return min(oof_score(tr, walk(tr, feats, "home_win", c, cv), "home_win") for c in C_GRID)
        best = min(configs, key=cv_loss)
        print(f"  {season}: team rating half-life {best[0]}d, home-advantage penalty {best[1]}")
        return team_dfs[best]

    win = BASELINE_FEATURES["home_win"]
    for name, sets in (("3 + team margin rating", {"home_win": win + ["team_margin"]}),
                       ("3 team margin rating instead of Elo", {"home_win": [f for f in win if f != "elo_logit"] + ["team_margin"]}),
                       ("3 + team rating + team home advantage", {"home_win": win + ["team_margin", "team_hfa"]})):
        sets = {**BASELINE_FEATURES, "home_win": sets["home_win"], "margin": sets["home_win"]}
        chosen = {s: pick(s, sets["home_win"]) for s in BACKTEST_SEASONS}
        for v in VARIANTS:
            compare(name, v, run_linear(lambda s: chosen[s], feats_for(v, sets))[0], ["home_win", "margin"])

    # 4. Opponent-adjusted form.
    adj = opponent_adjusted_form()
    dfa = df.join(adj, on="match_id")
    adj_all = [c for c in adj.columns if c.startswith("diff_adj")]
    for name, extra_win, extra_total in (
            ("4 + adjusted net points", ["diff_adj_net_points"], ["sum_adj_points"]),
            ("4 + all adjusted form", adj_all, ["sum_adj_points"])):
        sets = {"home_win": win + extra_win, "margin": win + extra_win,
                "total": BASELINE_FEATURES["total"] + extra_total}
        for v in VARIANTS:
            compare(name, v, run_linear(lambda s: dfa, feats_for(v, sets))[0])

    # 5. Ensembles of the backtest predictions (linear + LightGBM, A and B).
    t_idx = test.set_index("match_id")
    for v in VARIANTS:
        members = {"linear": base[v]["home_win"], "lightgbm": bt[f"{v}|lightgbm|home_win"]}
        for name, p in ensembles(test, members).items():
            record(f"5 ensemble: {name}", v, "home_win", t_idx, p.loc[t_idx.index],
                   bt.loc[t_idx.index, f"{v}|ensemble|home_win"], note="baseline = current 50/50 ensemble")
    members = {f"{v}|{m}": (base[v]["home_win"] if m == "linear" else bt[f"{v}|lightgbm|home_win"])
               for v in VARIANTS for m in ("linear", "lightgbm")}
    for name, p in ensembles(test, members).items():
        record(f"5 ensemble of all four: {name}", "with_odds", "home_win", t_idx, p.loc[t_idx.index],
               bt.loc[t_idx.index, "with_odds|ensemble|home_win"], note="baseline = current with-odds ensemble")

    # 6. The two near misses together (chosen after seeing 1a and 3, so treat with caution): team
    # margin rating in the logistic model, blended with the margin model's win probability.
    # Adopted into the pipeline as LINEAR_FEATURES + MARGIN_BLEND.
    dft = team_dfs[(730, 30)]  # the setting chosen in every backtest year for this feature set
    for v in VARIANTS:
        new = run_linear(lambda s: dft, feats_for(v, {**BASELINE_FEATURES, "home_win": win + ["team_margin"]}))[0]
        combo = (new["home_win"] + margin_to_prob(test, base[v], base_extra[v])) / 2
        compare("6 combined: team rating + margin blend", v, pd.DataFrame({"home_win": combo}), ["home_win"])

    res = pd.DataFrame(RESULTS)
    report = ["# Experiments on the 2023–2025 backtest", "",
              "Each idea is compared with the current model on the same 631 games. `diff` is new minus "
              "baseline (negative = better); the interval is a paired bootstrap 95% interval. Linear models "
              "unless stated; settings an idea needs are chosen inside each backtest year from earlier seasons.", "",
              md_table(res.set_index("experiment")), "",
              "## Probabilistic margin and total vs the opening line and total", "",
              "Log loss on whether the home side covered the opening line / the total went over the opening "
              "total (pushes excluded). The market is 50% on both by construction, so `vs_50pct` < 0 means "
              "the model priced these markets better than a coin flip. Break-even hit rate at $1.91 is 52.4%.", "",
              md_table(prob.set_index("model")), ""]
    (REPORTS / "experiments.md").write_text("\n".join(report), encoding="utf-8")
    print("wrote reports/experiments.md")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=["robust", "lightgbm", "gam", "reserve", "team_total", "weekly",
                                           "context2", "ladder", "stars", "key_absence", "origin_stars",
                                           "calibration", "weekly2", "blend", "shin",
                                           "disagreement", "pre_kickoff"],
                        help="run just one experiment group")
    args = parser.parse_args()
    {"robust": robust_targets, "lightgbm": lightgbm_experiments, "gam": gam_experiments,
     "reserve": reserve_experiments, "team_total": team_total_experiments,
     "weekly": weekly_experiments, "context2": context2_experiments,
     "ladder": lambda: context2_experiments(LADDER_GROUPS, "15", "experiments_ladder.md",
                                            "Ladder position and motivation"),
     "stars": lambda: context2_experiments(STAR_GROUPS, "16", "experiments_stars.md", "Star players"),
     "key_absence": lambda: context2_experiments(KEY_ABSENCE_GROUPS, "17", "experiments_key_absence.md",
                                                 "Key-position star absences"),
     "origin_stars": lambda: context2_experiments(ORIGIN_STAR_GROUPS, "18", "experiments_origin_stars.md",
                                                  "Origin-based star absences"),
     "calibration": calibration_experiments, "weekly2": weekly2_experiments,
     "blend": blend_experiments, "shin": shin_experiments,
     "disagreement": disagreement_experiments, "pre_kickoff": pre_kickoff_experiments}.get(args.only, main)()
