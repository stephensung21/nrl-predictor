"""
Betting simulation on the 2023-2025 backtest predictions.

Uses the main models' out-of-sample backtest predictions (the ensemble for both variants; each
season predicted from earlier seasons only) and bets a flat 1 unit whenever the model's expected edge, probability x odds - 1, exceeds a
threshold, at the OPENING prices for:
- head to head: the win probability;
- line: P(home covers the opening line) = Phi((predicted margin + line) / sigma);
- total: P(over the opening total) = Phi((predicted total - total) / sigma);
where sigma is the spread of the linear model's out-of-fold errors on earlier seasons only (used
for the ensemble too, whose errors are very similar; LightGBM has no out-of-fold errors here).

Reports profit and ROI (with a bootstrap 95% interval), and closing line value (CLV): whether
the price or line moved towards the bet by kickoff, a much less noisy sign of real edge than
profit. Totals are simulated with and without the wet-conditions flag, which is only known near
kickoff while opening prices come out early in the week; that version is linear only, because
LightGBM would need retraining without the flag.

Caveats: draws were excluded from the backtest (a head-to-head bet loses on a draw); the
models use the named 17, which may come out after the opening price; and the backtest informed
many modelling decisions, so results are optimistic.

Usage:
    python src/betting.py                 ->  reports/betting.md (2023-2025 backtest)
    python src/betting.py --season 2026   ->  reports/betting_2026.md (the final test season, same rules,
                                              predictions checked against reports/predictions_2026.csv)
"""

import argparse
import warnings

import numpy as np
import pandas as pd
from scipy.stats import norm

import config
import models
from config import BACKTEST_SEASONS, LINEAR_FEATURES, MAIN_MODEL, REPORTS, VARIANT_LABEL, VARIANTS
from ingest import join_odds_to_matches, load_odds
from reports import md_table

THRESHOLDS = [0.0, 0.02, 0.05, 0.10]
N_BOOT = 10000
PRICE_COLS = ["home_odds_open", "away_odds_open", "home_odds_close", "away_odds_close",
              "home_line_odds_open", "away_line_odds_open", "home_line_odds_close", "away_line_odds_close",
              "over_odds_open", "under_odds_open", "over_odds_close", "under_odds_close",
              "open_line", "close_line", "open_total", "close_total", "p_open", "p_close", "close_ok"]


def load(seasons, check_file):
    """Backtest predictions for `seasons` joined to prices, plus sigma per season for margin and total."""
    warnings.filterwarnings("ignore")
    df = models.load_data()
    df = df[df["season"] <= max(seasons)]
    bt = pd.read_csv(check_file).set_index("match_id")
    odds = load_odds()
    test = df[df["season"].isin(seasons)]
    ids = join_odds_to_matches(test[["match_id", "start_time_utc", "home_team", "away_team"]], odds)
    prices = odds.set_index("odds_id")[[c for c in PRICE_COLS if c not in test.columns]]
    games = test.set_index("match_id").join(ids.set_index("match_id")["odds_id"]).join(prices, on="odds_id")

    # The main model's predictions for every market, from the shared backtest (rerun here, and checked
    # against the saved predictions). Sigma is the spread of the linear models' out-of-fold
    # errors on earlier seasons. Totals without the wet flag, for bets placed early in the week, are
    # linear only.
    no_wet = {**LINEAR_FEATURES, "total": [f for f in LINEAR_FEATURES["total"] if f != "wet_conditions"]}
    preds, sigma = {}, {}
    for name_fmt, settings in (("{v} " + MAIN_MODEL, {}), ("{v} linear (no rain flag)", {"LINEAR_FEATURES": no_wet})):
        with config.override(**settings):
            p, details = models.backtest(df, seasons)
            spreads = {s: models.margin_total_sigma(df, cfg, s) for s, (cfg, _) in details.items()}
        p.index = df.loc[p.index, "match_id"].to_numpy()
        if not settings:  # must reproduce the pipeline's backtest exactly
            assert np.allclose(p.to_numpy(), bt.loc[p.index, p.columns].to_numpy())
        for v in VARIANTS:
            name = name_fmt.format(v=v)
            model = MAIN_MODEL if not settings else "linear"
            for t in ("margin", "total"):
                preds[(name, t)] = p.loc[games.index, f"{v}|{model}|{t}"]
                sigma[(name, t)] = {s: sp[(v, t)] for s, sp in spreads.items()}
            if not settings:
                preds[(name, "home_win")] = p.loc[games.index, f"{v}|{MAIN_MODEL}|home_win"]
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
    # Impossible prices: a two-way market whose implied probabilities sum to under 100% is a data error
    # (the 2026 sheet has some), not a real price. Such opening prices are not bet; such closing prices
    # are ignored. (No 2021-2025 prices are affected.)
    for col in ("odds", "close_odds"):
        implied = (1 / bets[col]).groupby([bets.index, bets["market"]]).transform("sum", min_count=2)
        bets[col] = bets[col].where(~(implied < 1))
    bets = bets[bets["odds"].notna() & bets["prob"].notna()]
    bets["edge"] = bets["prob"] * bets["odds"] - 1
    bets["profit"] = np.where(bets["result"] == 1, bets["odds"] - 1, np.where(bets["result"] == 0, -1.0, 0.0))
    bets["profit_close"] = np.where(bets["result"] == 1, bets["close_odds"] - 1,
                                    np.where(bets["result"] == 0, -1.0, 0.0))
    bets["model"] = model
    return bets


def label(model):
    """Display name, e.g. 'with_odds (no rain flag)' -> 'With odds (no rain flag)'."""
    for v, name in VARIANT_LABEL.items():
        model = model.replace(v, name)
    return model


def summarise(bets, seasons):
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
                "model": label(model), "market": market, "min edge": f"{thr:.0%}", "bets": len(x),
                "won": (x["result"] == 1).mean(), "profit (units)": profit.sum(), "ROI": profit.mean(),
                "ROI ci_low": np.percentile(boot, 2.5), "ROI ci_high": np.percentile(boot, 97.5),
                "P(ROI > 0)": (boot > 0).mean(),
                "CLV bets": len(clv), "CLV mean": clv.mean() if len(clv) else np.nan,
                "CLV positive": (clv > 0).mean() if len(clv) else np.nan,
                "CLV negative": (clv < 0).mean() if len(clv) else np.nan,
                "ROI at closing price": close["profit_close"].mean() if len(close) else np.nan,
                **({f"ROI {s}": x.loc[x["season"] == s, "profit"].mean() for s in seasons} if len(seasons) > 1 else {}),
            })
    return pd.DataFrame(rows)


KELLY_FRACTIONS = [0.25, 0.5]   # fractional Kelly (full Kelly is far too volatile with estimated edges)
KELLY_CAP = 0.05                # never more than 5% of the bankroll on one bet
STAKING_EDGE = 0.02             # bets with at least a 2% expected edge
FLAT_STAKE = 0.01               # flat staking: 1% of the starting bankroll per bet
N_STAKING_BOOT = 2000


def simulate(x, fraction):
    """Bankroll path over bets in kickoff order (start = 1). fraction=None: flat stakes of FLAT_STAKE;
    otherwise stake = min(fraction x Kelly, KELLY_CAP) of the current bankroll, with Kelly = edge / (odds - 1).
    Returns (final bankroll, largest drawdown from a peak)."""
    bank, peak, drawdown = 1.0, 1.0, 0.0
    for edge, odds, profit in zip(x["edge"].to_numpy(), x["odds"].to_numpy(), x["profit"].to_numpy()):
        stake = FLAT_STAKE if fraction is None else bank * min(fraction * edge / (odds - 1), KELLY_CAP)
        bank += stake * profit
        peak = max(peak, bank)
        drawdown = max(drawdown, 1 - bank / peak)
    return bank, drawdown


def staking(bets, kickoff):
    """Item 43: flat stakes against fractional Kelly. The bootstrap resamples the bets (with replacement,
    in random order) to show how likely each plan is to end below the starting bankroll."""
    rows, rng = [], np.random.default_rng(0)
    for (model, market), b in bets.groupby(["model", "market"], sort=False):
        x = b[b["edge"] > STAKING_EDGE].assign(t=kickoff.reindex(b[b["edge"] > STAKING_EDGE].index).to_numpy())
        x = x.sort_values("t", kind="stable")
        if x.empty:
            continue
        for fraction, plan in [(None, f"flat {FLAT_STAKE:.0%}")] + [(f, f"{f:g} Kelly") for f in KELLY_FRACTIONS]:
            final, dd = simulate(x, fraction)
            boot = [simulate(x.iloc[rng.integers(0, len(x), len(x))], fraction)[0] for _ in range(N_STAKING_BOOT)]
            rows.append({"model": label(model), "market": market, "staking": plan, "bets": len(x),
                         "final bankroll": final, "largest drawdown": dd,
                         "median final (bootstrap)": np.median(boot), "P(final < start)": np.mean(np.array(boot) < 1)})
    return pd.DataFrame(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", type=int, help="simulate one season (e.g. the final test season) instead "
                                                    "of the backtest seasons")
    args = parser.parse_args()
    if args.season:
        seasons, check_file, out = [args.season], REPORTS / f"predictions_{args.season}.csv", f"betting_{args.season}"
        title = f"# Betting simulation, {args.season} (final test season)"
        scope = (f"out-of-sample predictions for {args.season} (developed on {config.FIRST_SEASON}–{args.season - 1}, "
                 "exactly as in the final test)")
        caveat = ("Caveats: the rules (markets, thresholds, opening prices) are the backtest's, fixed before this "
                  "season was simulated; draws were excluded; the line-up features use the named 17, which may come "
                  "out after the opening price. Odds data: the 2026 sheet has impossible prices (implied "
                  "probabilities summing to under 100%) for 15 opening lines and 9 opening / 67 closing totals; "
                  "those are dropped. The other 2026 totals prices are also doubtful: about a 1–2% margin "
                  "instead of the usual 5%, with under prices up to 2.26, so the totals ROI is overstated.")
    else:
        seasons, check_file, out = BACKTEST_SEASONS, REPORTS / "backtest_predictions.csv", "betting"
        title = "# Betting simulation, 2023–2025 backtest"
        scope = "out-of-sample backtest predictions (each season predicted from earlier seasons only)"
        caveat = ("Caveats: draws were excluded from the backtest; the line-up features use the named 17, which "
                  "may come out after the opening price; and the backtest has informed many modelling decisions, "
                  "so these results are optimistic.")
    games, preds, sigma = load(seasons, check_file)
    models = [*(f"{v} {MAIN_MODEL}" for v in VARIANTS), *(f"{v} linear (no rain flag)" for v in VARIANTS)]
    bets = pd.concat([candidate_bets(games, preds, sigma, m) for m in models])
    # The no-rain models only differ on totals.
    bets = bets[~(bets["model"].str.contains("no rain") & (bets["market"] != "total"))]
    summary = summarise(bets, seasons)
    stakes = staking(bets[bets["market"] == "head to head"], games["start_time_utc"])
    pd.set_option("display.width", 250)
    print(summary.round(3).to_string(index=False))
    print(stakes.round(3).to_string(index=False))

    clv_note = ("CLV is the move to the closing price or line in the bet's favour: head to head in "
                "implied probability (only where closing prices are reliable), line and total in points.")
    report = [title, "",
              "Flat 1-unit bets at the **opening** prices whenever probability × odds − 1 exceeds the minimum "
              f"edge, using {scope}, using the main models: the ensemble (average of linear and LightGBM) for both variants. The "
              "with-odds models use the opening odds as inputs; the no-odds models use no odds. "
              "`linear (no rain flag)` totals don't use the wet-conditions flag, which is only known near kickoff "
              "(linear only: LightGBM would need retraining without it).", "",
              clv_note, "", caveat + " Thresholds are all shown, not chosen.", "",
              md_table(summary.set_index("model").round(4)), "",
              "## Bet sizing, head to head (item 43)", "",
              f"Bets with at least a {STAKING_EDGE:.0%} edge, in kickoff order, starting from a bankroll of 1. "
              f"Flat: {FLAT_STAKE:.0%} of the starting bankroll per bet. Fractional Kelly: that fraction of the "
              f"Kelly stake (edge / (odds - 1)) of the current bankroll, capped at {KELLY_CAP:.0%}. The bootstrap "
              f"resamples the bets {N_STAKING_BOOT} times in random order.", "",
              md_table(stakes.set_index("model").round(3)), ""]
    (REPORTS / f"{out}.md").write_text("\n".join(report), encoding="utf-8")
    bets.to_csv(REPORTS / f"{out}_candidates.csv", index=False)
    print(f"wrote reports/{out}.md")


if __name__ == "__main__":
    main()
