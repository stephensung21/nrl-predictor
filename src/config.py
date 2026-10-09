"""
Model settings, in one place.

Functions in models.py, evaluate.py and train.py read these at call time (config.NAME), so the
command-line flags in train.py and the experiment harness (override()) change them here only.
"""

from contextlib import contextmanager

import numpy as np

from features import FEATURE_GROUPS
from ingest import PROCESSED, ROOT  # noqa: F401  (re-exported for the other modules)

REPORTS = ROOT / "reports"
PARAMS_OUT = REPORTS / "params.json"
FINAL_LOCK = REPORTS / "final.lock"

# Seasons
FIRST_SEASON = 2021                 # first season of training rows (2020 is history only)
CV_SEASONS = [2022, 2023, 2024]     # walk-forward CV seasons for the dev run
DEV_SEASON, TEST_SEASON = 2025, 2026
BACKTEST_SEASONS = [2023, 2024, 2025]
N_BOOTSTRAP = 10000

# Targets and tuning
TARGETS = {"home_win": "clf", "margin": "reg", "total": "reg"}
C_GRID = np.logspace(-3, 1, 9)        # logistic regression
ALPHA_GRID = np.logspace(-1, 4, 11)   # ridge
N_TRIALS = 60                         # Optuna trials per LightGBM model (--tune-lgb only)
SEED = 0
MIN_GAIN = {"clf": 0.001, "reg": 0.01}  # forward selection: minimum pooled CV gain (log loss / MAE points)

# The linear win probability is the average of the logistic model and the margin model's
# P(margin > 0) = Phi(predicted margin / sigma), sigma from out-of-fold margin errors: margins carry
# more information than win/loss (both parts improved the 2023-2025 backtest; see experiments.py).
MARGIN_BLEND = True

# Fixed linear feature sets: the features chosen consistently across the 2023-2025 backtest's
# forward selection, plus the team margin rating (win), star absences (win, margin) and the
# wet-conditions flag (totals). Selecting per season from 1-3 CV seasons overfit, so it is off by
# default (--select turns it back on). The with-odds models add the opening odds to each set.
FEATURE_SELECTION = False
# Star absences (S2): the team's usual players who are missing and were in an Origin 17 in the last
# 12 months or are in the top 10% of their position for form, split into spine and other positions.
STAR_ABSENCES = ["diff_s2_stars_out_spine", "diff_s2_stars_out_other"]
LINEAR_FEATURES = {
    "home_win": ["elo_logit", "diff_rapm_total", "diff_rapm_defence", "diff_rapm_vs_usual", "team_margin"] + STAR_ABSENCES,
    "margin": ["elo_logit", "diff_rapm_total", "diff_rapm_defence", "diff_rapm_vs_usual"] + STAR_ABSENCES,
    "total": ["rapm_points", "origin_period", "wet_conditions"],
}
# The BlueBet inputs (in FEATURE_GROUPS["odds"]) fix the with-odds win and margin models' calibration
# after the bookmaker change but made the totals model worse, so the linear totals model doesn't get them.
BOOKMAKER_INPUTS = ["bluebet", "open_logit_bluebet"]

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


def feature_sets():
    """Feature sets for the dev run's comparison and for --select / --tune-lgb (from FEATURE_GROUPS)."""
    base = FEATURE_GROUPS["elo"] + FEATURE_GROUPS["form"] + FEATURE_GROUPS["context"]
    return {"base": base,
            "+player": base + FEATURE_GROUPS["player"],
            "+odds": base + FEATURE_GROUPS["player"] + FEATURE_GROUPS["odds"]}


@contextmanager
def override(**settings):
    """Temporarily change settings, e.g. `with config.override(LGB_SEEDS=1): ...` (experiments)."""
    module = globals()
    old = {k: module[k] for k in settings}
    module.update(settings)
    try:
        yield
    finally:
        module.update(old)
