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
"""

import argparse
import warnings

import numpy as np
import pandas as pd
from scipy import sparse
from scipy.optimize import minimize
from scipy.stats import norm, t as student_t
from sklearn.impute import SimpleImputer
from sklearn.linear_model import HuberRegressor, LogisticRegression, QuantileRegressor, Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

import train
from elo import run_elo, tune as tune_elo
from features import SEASON_SHRINK, SIX_AGAIN_START, logit, team_ratings
from ingest import PROCESSED, join_odds_to_matches, load_odds
from train import (ALPHA_GRID, BACKTEST_SEASONS, C_GRID, FIRST_SEASON, LINEAR_FEATURES, REPORTS,
                   TARGETS, linear, linear_predict, md_table, platt)

ODDS = ["open_logit", "open_line", "open_total"]
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
    return train.score(df.loc[d, target], oof[d], TARGETS[target])


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
    RESULTS.append({"experiment": experiment, "model": variant, "target": target,
                    "metric": "log loss" if kind == "clf" else "MAE", "baseline": base_s, "new": new_s,
                    "diff": diff, "ci_low": lo, "ci_high": hi, "verdict": verdict, "note": note})
    print(f"{experiment:38s} {variant:3s} {target:8s} base {base_s:.4f} new {new_s:.4f} "
          f"diff {diff:+.4f} [{lo:+.4f}, {hi:+.4f}] {verdict}")


# ---------------------------------------------------------------- data

def load():
    df = train.load_data()
    return df[df["season"] <= max(BACKTEST_SEASONS)].reset_index(drop=True)


def feats_for(variant, sets=BASELINE_FEATURES):
    return {t: list(f) + (ODDS if variant == "A" else []) for t, f in sets.items()}


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
        summary.append({"model": variant, "market": "line" if target == "margin" else "total",
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
    for v in ("A", "B"):
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


# ---------------------------------------------------------------- main

def main():
    warnings.filterwarnings("ignore")
    df = load()
    test = df[df["season"].isin(BACKTEST_SEASONS)]
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    odds = load_odds()

    print("baseline linear backtest...")
    base, base_extra = {}, {}
    for v in ("A", "B"):
        base[v], base_extra[v] = run_linear(lambda s: df, feats_for(v))
        for t in ("margin", "total"):  # unchanged since; the harness must reproduce train.py exactly
            assert np.allclose(base[v][t].to_numpy(), bt.loc[base[v].index, f"{v}|linear|{t}"].to_numpy()), (v, t)
    print("  margin and total match reports/backtest_predictions.csv")

    def compare(name, variant, preds, targets=TARGETS):
        for t in targets:
            record(name, variant, t, test.set_index("match_id").loc[preds.index], preds[t], base[variant][t])

    # 1. Re-tests of ideas rejected on 2025 alone.
    for v in ("A", "B"):
        p_margin = margin_to_prob(test, base[v], base_extra[v])
        compare("1a win prob from margin", v, pd.DataFrame({"home_win": p_margin}), ["home_win"])
        blend = (p_margin + base[v]["home_win"]) / 2
        compare("1a blend: logistic + margin", v, pd.DataFrame({"home_win": blend}), ["home_win"])
    offset = pd.concat([offset_logistic(df, s, BASELINE_FEATURES["home_win"]) for s in BACKTEST_SEASONS])
    compare("1b market offset + B features", "A", pd.DataFrame({"home_win": offset}), ["home_win"])
    for hl in (1, 2):
        w = lambda tr, s, hl=hl: 0.5 ** ((s - 1 - tr["season"].to_numpy()) / hl)
        for v in ("A", "B"):
            compare(f"1c recency weights (half-life {hl} season)", v, run_linear(lambda s: df, feats_for(v), w)[0])
    elo_all, elo_six = elo_variants(df, odds)
    for name, fn in (("1d Elo retuned 2013..year-1", elo_all), ("1d Elo retuned 2020..year-1", elo_six)):
        for v in ("A", "B"):
            compare(name, v, run_linear(fn, feats_for(v))[0], ["home_win", "margin"])

    # 2. Probabilistic margin and total vs the opening line and total.
    prob = pd.concat([probabilistic(df, base[v], base_extra[v], v) for v in ("A", "B")])
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
        for v in ("A", "B"):
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
        for v in ("A", "B"):
            compare(name, v, run_linear(lambda s: dfa, feats_for(v, sets))[0])

    # 5. Ensembles of the backtest predictions (linear + LightGBM, A and B).
    t_idx = test.set_index("match_id")
    for v in ("A", "B"):
        members = {"linear": base[v]["home_win"], "lightgbm": bt[f"{v}|lightgbm|home_win"]}
        for name, p in ensembles(test, members).items():
            record(f"5 ensemble: {name}", v, "home_win", t_idx, p.loc[t_idx.index],
                   bt.loc[t_idx.index, f"{v}|ensemble|home_win"], note="baseline = current 50/50 ensemble")
    members = {f"{v}|{m}": (base[v]["home_win"] if m == "linear" else bt[f"{v}|lightgbm|home_win"])
               for v in ("A", "B") for m in ("linear", "lightgbm")}
    for name, p in ensembles(test, members).items():
        record(f"5 ensemble of all four: {name}", "A", "home_win", t_idx, p.loc[t_idx.index],
               bt.loc[t_idx.index, "A|ensemble|home_win"], note="baseline = current A ensemble")

    # 6. The two near misses together (chosen after seeing 1a and 3, so treat with caution): team
    # margin rating in the logistic model, blended with the margin model's win probability.
    # Adopted into the pipeline as LINEAR_FEATURES + MARGIN_BLEND.
    dft = team_dfs[(730, 30)]  # the setting chosen in every backtest year for this feature set
    for v in ("A", "B"):
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
    parser.add_argument("--only", choices=["robust"], help="run just one experiment group")
    args = parser.parse_args()
    robust_targets() if args.only == "robust" else main()
