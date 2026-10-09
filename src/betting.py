"""
Betting simulation on the 2023-2025 backtest predictions.

Uses the out-of-sample backtest predictions (each season predicted from earlier seasons only)
and bets a flat 1 unit whenever the model's expected edge, probability x odds - 1, exceeds a
threshold, at the OPENING prices for:
- head to head: the win probability;
- line: P(home covers the opening line) = Phi((predicted margin + line) / sigma);
- total: P(over the opening total) = Phi((predicted total - total) / sigma);
where sigma is the spread of the linear model's out-of-fold errors on earlier seasons only.

Reports profit and ROI (with a bootstrap 95% interval), and closing line value (CLV): whether
the price or line moved towards the bet by kickoff, a much less noisy sign of real edge than
profit. Totals are simulated with and without the wet-conditions flag, which is only known near
kickoff while opening prices come out early in the week.

Caveats: draws were excluded from the backtest (a head-to-head bet loses on a draw); the
models use the named 17, which may come out after the opening price; and the backtest informed
many modelling decisions, so results are optimistic.

Usage: python src/betting.py   ->  reports/betting.md
"""

import warnings

import numpy as np
import pandas as pd
from scipy.stats import norm

import experiments
from ingest import join_odds_to_matches, load_odds
from train import BACKTEST_SEASONS, LINEAR_FEATURES, REPORTS, md_table

THRESHOLDS = [0.0, 0.02, 0.05, 0.10]
N_BOOT = 10000
PRICE_COLS = ["home_odds_open", "away_odds_open", "home_odds_close", "away_odds_close",
              "home_line_odds_open", "away_line_odds_open", "home_line_odds_close", "away_line_odds_close",
              "over_odds_open", "under_odds_open", "over_odds_close", "under_odds_close",
              "open_line", "close_line", "open_total", "close_total", "p_open", "p_close", "close_ok"]


def load():
    """Backtest predictions joined to prices, plus sigma per season for margin and total."""
    warnings.filterwarnings("ignore")
    df = experiments.load()
    bt = pd.read_csv(REPORTS / "backtest_predictions.csv").set_index("match_id")
    odds = load_odds()
    test = df[df["season"].isin(BACKTEST_SEASONS)]
    ids = join_odds_to_matches(test[["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    prices = odds.set_index("odds_id")[[c for c in PRICE_COLS if c not in test.columns]]
    games = test.set_index("match_id").join(ids.set_index("match_id")["odds_id"]).join(prices, on="odds_id")

    # Margin and total predictions with out-of-fold errors per season (the same linear models as the
    # backtest), and a total model without the wet flag for bets placed early in the week.
    preds, sigma = {}, {}
    no_wet = {**LINEAR_FEATURES, "total": [f for f in LINEAR_FEATURES["total"] if f != "wet_conditions"]}
    for v in ("A", "B"):
        for name, sets in (("", LINEAR_FEATURES), (" (no rain flag)", no_wet)):
            p, extra = experiments.run_linear(lambda s: df, experiments.feats_for(v, sets))
            if not name:  # must match the backtest exactly
                for t in ("margin", "total"):
                    assert np.allclose(p[t], bt.loc[p.index, f"{v}|linear|{t}"]), (v, t)
            for t in ("margin", "total"):
                preds[(v + name, t)] = p[t]
                sigma[(v + name, t)] = {s: np.std(tr[t] - oof) for (s, tt), (tr, oof) in extra.items() if tt == t}
        preds[(v, "home_win")] = bt.loc[games.index, f"{v}|linear|home_win"]
    return games, preds, sigma


def candidate_bets(games, preds, sigma, model):
    """Every side of every market with the model's probability, price, result and closing value."""
    g, rows = games, []
    s_season = g["season"]
    if (model, "home_win") in preds:
        p = preds[(model, "home_win")].loc[g.index]
        for side, prob, odds, close, won, clv in (
                ("home", p, g["home_odds_open"], g["home_odds_close"], g["home_win"], g["p_close"] - g["p_open"]),
                ("away", 1 - p, g["away_odds_open"], g["away_odds_close"], 1 - g["home_win"], g["p_open"] - g["p_close"])):
            ok = g["close_ok"].astype(bool)
            rows.append(pd.DataFrame({"market": "head to head", "side": side, "prob": prob, "odds": odds,
                                      "close_odds": close.where(ok), "result": won.astype(float),
                                      "clv": clv.where(ok), "season": s_season}))
    for target, market in (("margin", "line"), ("total", "total")):
        key = (model, target)
        if key not in preds:
            continue
        mu = preds[key].loc[g.index]
        sd = s_season.map(sigma[key])
        if target == "margin":
            line, close_line = g["open_line"], g["close_line"]
            diff = g["margin"] + line                    # > 0: home covered
            p_home = norm.cdf((mu + line) / sd)
            sides = (("home", p_home, g["home_line_odds_open"], g["home_line_odds_close"], np.sign(diff),
                      line - close_line),
                     ("away", 1 - p_home, g["away_line_odds_open"], g["away_line_odds_close"], -np.sign(diff),
                      close_line - line))
        else:
            line, close_line = g["open_total"], g["close_total"]
            diff = g["total"] - line                     # > 0: over
            p_over = norm.cdf((mu - line) / sd)
            sides = (("over", p_over, g["over_odds_open"], g["over_odds_close"], np.sign(diff), close_line - line),
                     ("under", 1 - p_over, g["under_odds_open"], g["under_odds_close"], -np.sign(diff), line - close_line))
        for side, prob, odds, close, sign, clv in sides:
            # sign: 1 win, -1 loss, 0 push (stake back)
            rows.append(pd.DataFrame({"market": market, "side": side, "prob": prob, "odds": odds,
                                      "close_odds": close, "result": (sign + 1) / 2, "clv": clv,
                                      "season": s_season}))
    bets = pd.concat(rows)
    bets = bets[bets["odds"].notna() & bets["prob"].notna()]
    bets["edge"] = bets["prob"] * bets["odds"] - 1
    bets["profit"] = np.where(bets["result"] == 1, bets["odds"] - 1, np.where(bets["result"] == 0, -1.0, 0.0))
    bets["profit_close"] = np.where(bets["result"] == 1, bets["close_odds"] - 1,
                                    np.where(bets["result"] == 0, -1.0, 0.0))
    bets["model"] = model
    return bets


def summarise(bets):
    rows = []
    for (model, market), b in bets.groupby(["model", "market"], sort=False):
        for thr in THRESHOLDS:
            x = b[b["edge"] > thr]
            if x.empty:
                continue
            profit = x["profit"].to_numpy()
            boot = profit[np.random.default_rng(0).integers(0, len(profit), (N_BOOT, len(profit)))].mean(axis=1)
            clv = x["clv"].dropna()
            close = x[x["close_odds"].notna()]
            rows.append({
                "model": model, "market": market, "min edge": f"{thr:.0%}", "bets": len(x),
                "won": (x["result"] == 1).mean(), "profit (units)": profit.sum(), "ROI": profit.mean(),
                "ROI ci_low": np.percentile(boot, 2.5), "ROI ci_high": np.percentile(boot, 97.5),
                "P(ROI > 0)": (boot > 0).mean(),
                "CLV bets": len(clv), "CLV mean": clv.mean() if len(clv) else np.nan,
                "CLV positive": (clv > 0).mean() if len(clv) else np.nan,
                "CLV negative": (clv < 0).mean() if len(clv) else np.nan,
                "ROI at closing price": close["profit_close"].mean() if len(close) else np.nan,
                **{f"ROI {s}": x.loc[x["season"] == s, "profit"].mean() for s in BACKTEST_SEASONS},
            })
    return pd.DataFrame(rows)


def main():
    games, preds, sigma = load()
    models = ["A", "B", "A (no rain flag)", "B (no rain flag)"]
    bets = pd.concat([candidate_bets(games, preds, sigma, m) for m in models])
    # The no-rain models only differ on totals.
    bets = bets[~(bets["model"].str.contains("no rain") & (bets["market"] != "total"))]
    summary = summarise(bets)
    pd.set_option("display.width", 250)
    print(summary.round(3).to_string(index=False))

    clv_note = ("CLV is the move to the closing price or line in the bet's favour: head to head in "
                "implied probability (2023 and part of 2024, where closing prices are reliable), line and "
                "total in points (line: 2023 and part of 2024; total: all seasons).")
    report = ["# Betting simulation, 2023–2025 backtest", "",
              "Flat 1-unit bets at the **opening** prices whenever probability × odds − 1 exceeds the minimum "
              "edge, using out-of-sample backtest predictions (each season predicted from earlier seasons "
              "only). Model A is the main model (uses opening odds as inputs); Model B uses no odds. "
              "`(no rain flag)` totals don't use the wet-conditions flag, which is only known near kickoff.", "",
              clv_note, "",
              "Caveats: draws were excluded from the backtest; the line-up features use the named 17, which "
              "may come out after the opening price; and the backtest has informed many modelling decisions, "
              "so these results are optimistic. Thresholds are all shown, not chosen.", "",
              md_table(summary.set_index("model").round(4)), ""]
    (REPORTS / "betting.md").write_text("\n".join(report), encoding="utf-8")
    bets.to_csv(REPORTS / "betting_candidates.csv", index=False)
    print("wrote reports/betting.md")


if __name__ == "__main__":
    main()
