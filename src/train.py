"""
Train and evaluate the match models (command line).

Walk-forward cross-validation on 2021-2024 (train on earlier seasons, test on the next),
tuning, Platt calibration, and an evaluation on the 2025 dev season against benchmarks.
The 2026 season is only touched by --final, which refits on 2021-2025 using the settings
chosen in the dev run and scores 2026 once against closing odds.

--backtest repeats the whole development procedure (feature sets, tuning, calibration) for
each of 2023-2025 using only earlier seasons, then predicts that season: about 630
out-of-sample games instead of 212.

Settings live in config.py, the models in models.py, metrics in evaluate.py and report
helpers in reports.py.

Usage:
    python src/train.py              # -> reports/dev_2025.md, reports/params.json, ...
    python src/train.py --backtest   # -> reports/backtest.md
    python src/train.py --final      # ONE-TIME -> reports/final_2026.md
"""

import argparse
import json
import warnings

import optuna
import pandas as pd
from sklearn.metrics import accuracy_score, brier_score_loss

import config
from evaluate import baseline_preds, bootstrap_diff, importance, results_table
from models import backtest, cv_linear, develop, fit_predict, load_data, tune_linear
from reports import md_table, save_predictions


def main_models_line():
    return (f"**Main models:** the {config.MAIN_MODEL} (average of linear and LightGBM) for both variants, "
            "with odds and no odds.")


# ---------------------------------------------------------------- dev run

def run_dev():
    df = load_data()
    cv_df = df[df["season"] <= max(config.CV_SEASONS)]
    report = [f"# Dev evaluation ({config.DEV_SEASON})", "", main_models_line(), ""]

    # 1. Feature-set comparison with logistic / ridge.
    print("comparing feature sets...")
    comparison = {}
    for name, feats in config.feature_sets().items():
        c = tune_linear(cv_df, feats, "home_win")
        ll, oof = cv_linear(cv_df, feats, "home_win", c)
        done = oof.notna()
        alpha = tune_linear(cv_df, feats, "margin")
        comparison[name] = {"C": c, "log_loss": ll,
                            "brier": brier_score_loss(cv_df.loc[done, "home_win"], oof[done]),
                            "accuracy": accuracy_score(cv_df.loc[done, "home_win"], oof[done] > 0.5),
                            "margin_mae": cv_linear(cv_df, feats, "margin", alpha)[0]}
    comparison = pd.DataFrame(comparison).T.rename_axis("feature set")
    report += ["## Feature sets (walk-forward CV 2022–2024, logistic / ridge)", "", md_table(comparison), ""]

    # 2-3. Linear feature sets (fixed, or forward selection with --select), then tuning.
    cfg, trace, cv_table = develop(cv_df, config.CV_SEASONS)
    if not config.FEATURE_SELECTION:
        report += ["## Linear model features (fixed)", "",
                   "Fixed sets from the features chosen consistently in the backtest's forward selection, plus the "
                   "later additions in config.LINEAR_FEATURES. The win and margin models use the `home_win` and "
                   "`margin` sets, the total model the `total` set; the with-odds models add the opening odds. "
                   "LightGBM uses the compact set.", "", md_table(trace), ""]
    else:
        g = config.MIN_GAIN
        report += ["## Forward feature selection (linear models)", "",
                   f"Greedy selection from the {len(config.feature_sets()['+player'])} base + player features on "
                   f"walk-forward CV, adding a feature only if it improves the score in every CV season and the "
                   f"pooled score by at least {g['clf']} (log loss, `home_win`) or {g['reg']} points (MAE, "
                   "`total`). The win and margin models use the `home_win` selection, the total model the `total` "
                   "one; the with-odds models add the opening odds.", "", md_table(trace), ""]
    report += ["## Tuned models, walk-forward CV 2022–2024", "",
               "Log loss for `home_win`, MAE for `margin` and `total`. LightGBM uses its fixed number of trees "
               "here, so these scores are not inflated by early stopping.", "", md_table(cv_table), ""]

    # 4. Dev season.
    last = max(config.CV_SEASONS)
    print(f"fitting on {config.FIRST_SEASON}-{last}, evaluating {config.DEV_SEASON}...")
    preds, fitted = fit_predict(df, last, config.DEV_SEASON, cfg)
    train, test = df[df["season"] <= last], df.loc[preds.index]
    results = results_table(test, preds, baseline_preds(train, test), closing=("p_avg", None, "close_total"))
    report += [f"## {config.DEV_SEASON} results", "",
               "Win probabilities are Platt-calibrated. Margin and total for the market are the line (sign "
               "flipped) and the total. Closing lines are missing for 2025, so the closing benchmark is the Odds "
               "Portal average price plus the closing total.", "", md_table(results), ""]

    imp = importance(fitted, test)
    report += ["## Feature importance (`home_win`, with odds; linear coefficients for the linear model's features only)",
               "", md_table(imp[(imp["variant"] == "with_odds") & (imp["target"] == "home_win")]
                            .drop(columns=["variant", "target"])
                            .sort_values("lightgbm_mean_abs_shap", ascending=False).set_index("feature")), ""]

    config.REPORTS.mkdir(exist_ok=True)
    config.PARAMS_OUT.write_text(json.dumps(cfg, indent=2))
    comparison.to_csv(config.REPORTS / "cv_feature_sets.csv")
    trace.to_csv(config.REPORTS / "cv_forward_selection.csv")
    imp.to_csv(config.REPORTS / f"importance_{config.DEV_SEASON}.csv", index=False)
    save_predictions(test, preds, config.REPORTS / f"predictions_{config.DEV_SEASON}.csv")
    (config.REPORTS / f"dev_{config.DEV_SEASON}.md").write_text("\n".join(report), encoding="utf-8")
    print(md_table(results))
    print(f"wrote reports/dev_{config.DEV_SEASON}.md")


# ---------------------------------------------------------------- backtest

def run_backtest():
    """Repeat the development procedure for each backtest season using only earlier seasons."""
    df = load_data()
    df = df[df["season"] <= max(config.BACKTEST_SEASONS)]  # never touches the 2026 test season
    preds, details = backtest(df)
    test = df.loc[preds.index]
    baseline = pd.concat([baseline_preds(df[df["season"] < s], test[test["season"] == s])
                          for s in config.BACKTEST_SEASONS])
    per_season = {s: results_table(test[test["season"] == s], preds[test["season"] == s],
                                   baseline[test["season"] == s], ("p_avg", None, None))
                  for s in config.BACKTEST_SEASONS}
    pooled = results_table(test, preds, baseline, ("p_avg", None, "close_total"))

    # Paired bootstrap against the market (Odds Portal average), opening odds and Elo, pooled.
    boots = {}
    for v in config.VARIANTS:
        for model in ("linear", "ensemble"):
            for bench, name in (("p_avg", "market average"), ("p_open", "market opening"), ("elo_prob", "Elo")):
                boots[f"{config.VARIANT_LABEL[v]}: {model} vs {name}"] = bootstrap_diff(
                    test["home_win"], preds[f"{v}|{model}|home_win"], test[bench])
    boots = pd.DataFrame(boots).T.rename_axis("comparison")

    # Real closing odds where they exist and are reliable (mostly 2023).
    ok = test["close_ok"].astype(bool)
    closing = results_table(test[ok], preds[ok], baseline[ok], ("p_close", "close_line", "close_total"))
    closing_boot = pd.DataFrame({f"{config.VARIANT_LABEL[v]}: linear vs market closing": bootstrap_diff(
        test.loc[ok, "home_win"], preds.loc[ok, f"{v}|linear|home_win"], test.loc[ok, "p_close"])
        for v in config.VARIANTS}).T.rename_axis("comparison")

    seasons_txt = f"{config.BACKTEST_SEASONS[0]}–{config.BACKTEST_SEASONS[-1]}"
    method = "forward selection, " if config.FEATURE_SELECTION else "fixed linear feature sets, "
    report = [f"# Backtest {seasons_txt}", "", main_models_line(), "",
              f"Training seasons start in {config.FIRST_SEASON}. For each season, the whole development procedure "
              f"({method}tuning of the linear models and LightGBM, Platt calibration) is rerun on earlier seasons "
              "only, then the season is predicted. Win-probability metrics are log loss (lower is better); the "
              "market benchmark is the Odds Portal average price, since closing odds are missing for most of 2024 "
              "and all of 2025.", "",
              "Caveat: the RAPM settings (penalty 300, 90-day half-life) were chosen on 2022–2024 CV, so the 2023 "
              "and 2024 results are slightly optimistic for the RAPM features. The grid was flat, so the effect "
              "should be small.", "",
              f"## Pooled over {seasons_txt} ({len(test)} games)", "", md_table(pooled), "",
              "## Paired bootstrap, pooled (log-loss difference; negative = model better)", "", md_table(boots), ""]
    for season, table in per_season.items():
        report += [f"## {season} ({int(table['games'].iloc[0])} games)", "", md_table(table), ""]
    report += [f"## Real closing odds, where reliable ({ok.sum()} games, mostly 2023)", "", md_table(closing), "",
               md_table(closing_boot), ""]
    if config.FEATURE_SELECTION:
        pool = config.feature_sets()["+player"]
        chosen = {s: trace.loc[trace["target"] == "home_win", "feature"].tolist() for s, (_, trace) in details.items()}
        stability = pd.DataFrame({s: [f in c for f in pool] for s, c in chosen.items()}, index=pool)
        stability = stability[stability.any(axis=1)].astype(int).rename_axis("feature")
        report += ["## Feature selection stability, `home_win` (1 = selected for that season)", "",
                   md_table(stability), ""]

    config.REPORTS.mkdir(exist_ok=True)
    (config.REPORTS / "backtest.md").write_text("\n".join(report), encoding="utf-8")
    save_predictions(test, preds, config.REPORTS / "backtest_predictions.csv")
    print(md_table(pooled))
    print(md_table(boots))
    print("wrote reports/backtest.md")


# ---------------------------------------------------------------- final run

def run_final(force):
    if config.FINAL_LOCK.exists() and not force:
        raise SystemExit(f"The {config.TEST_SEASON} final test has already been run "
                         f"({config.FINAL_LOCK.read_text().strip()}). Pass --force only if you really mean to score it again.")
    if not config.PARAMS_OUT.exists():
        raise SystemExit("reports/params.json not found: run `python src/train.py` (the dev run) first.")
    cfg = json.loads(config.PARAMS_OUT.read_text())
    df = load_data()

    print(f"refitting on {config.FIRST_SEASON}-{config.DEV_SEASON}, evaluating {config.TEST_SEASON}...")
    preds, _ = fit_predict(df, config.DEV_SEASON, config.TEST_SEASON, cfg)
    train, test = df[df["season"] <= config.DEV_SEASON], df.loc[preds.index]
    ok = test["close_ok"].astype(bool)
    baseline = baseline_preds(train, test)
    reliable = results_table(test[ok], preds[ok], baseline[ok], ("p_close", "close_line", "close_total"))
    everything = results_table(test, preds, baseline, ("p_avg", None, None))

    report = [f"# Final test ({config.TEST_SEASON})", "", main_models_line(), "",
              f"Settings and feature sets come from the dev run; models refit on "
              f"{config.FIRST_SEASON}–{config.DEV_SEASON}.", "",
              f"## Games with reliable closing odds ({ok.sum()} of {len(test)})", "", md_table(reliable), "",
              f"## All {len(test)} games (closing benchmark = Odds Portal average)", "", md_table(everything), ""]
    (config.REPORTS / f"final_{config.TEST_SEASON}.md").write_text("\n".join(report), encoding="utf-8")
    save_predictions(test, preds, config.REPORTS / f"predictions_{config.TEST_SEASON}.csv")
    config.FINAL_LOCK.write_text(f"run {pd.Timestamp.now():%Y-%m-%d %H:%M}\n")
    print(md_table(reliable))
    print(f"wrote reports/final_{config.TEST_SEASON}.md")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--final", action="store_true", help=f"one-time evaluation on {config.TEST_SEASON}")
    parser.add_argument("--force", action="store_true", help="allow --final to run again")
    parser.add_argument("--backtest", action="store_true",
                        help=f"rerun development for each of {config.BACKTEST_SEASONS} and predict it")
    parser.add_argument("--select", action="store_true",
                        help="forward feature selection for the linear models instead of LINEAR_FEATURES")
    parser.add_argument("--tune-lgb", action="store_true",
                        help="tune LightGBM with Optuna on the full feature set (the earlier setup)")
    parser.add_argument("--train-from", type=int, default=config.FIRST_SEASON,
                        help=f"first season of training rows (default {config.FIRST_SEASON})")
    args = parser.parse_args()
    config.FEATURE_SELECTION, config.FIRST_SEASON = args.select, args.train_from
    if args.tune_lgb:
        config.LGB_TUNING, config.LGB_COMPACT = True, False
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    warnings.filterwarnings("ignore", category=UserWarning, module="lightgbm")
    if args.final:
        run_final(args.force)
    elif args.backtest:
        run_backtest()
    else:
        run_dev()


if __name__ == "__main__":
    main()
