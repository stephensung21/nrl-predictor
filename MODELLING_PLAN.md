# NRL Predictor: Modelling Plan

This plan covers the traditional machine-learning stage: a **logistic and ridge regression** main model and a **LightGBM** challenger. It builds on [PLAN.md](PLAN.md) and uses three data sources:

- `data/processed/*.csv`, scraped from nrl.com by `src/scrape.py`: matches, team stats and player stats for 2021–2026.
- `data/nrl_betting odds.xlsx`, the aussportsbetting.com dataset: results and odds for 2009–2026.

---

## 1. Targets

| Target | Model (main / challenger) | Notes |
|---|---|---|
| **Margin** (home score − away score) | Ridge / LightGBM regressor | The main target. It compares directly with the line market. |
| **Home win** (1 or 0) | Logistic / LightGBM classifier | Gives the win probability used for log loss, calibration and comparing with the market. |
| **Total points** | Ridge / LightGBM regressor | Used only to rebuild each team's score. |

**Team scores** come from the margin and total predictions:
`home = (total + margin) / 2`, `away = (total − margin) / 2`.
Predicting the two scores separately is avoided because it gives no probability, ignores how the two scores move together, and adds two models' errors together.

**Draws are dropped** (6 games from 2021 to 2026). Elo still counts them as half a win, because Elo is a rating, not a training target.

## 2. Data split

| Stage | Seasons | Purpose |
|---|---|---|
| Feature warm-up | Start of 2021 | Rolling features start in 2021. A game is used only once **both teams have played at least 5 games** in the scraped data, so roughly rounds 1–5 of 2021 are skipped. **2020 is not used** because the COVID season is too unusual. |
| Training and cross-validation | 2021–2024 | Walk-forward: train on 2021→test 2022, 2021–22→2023, 2021–23→2024. |
| Dev | 2025 | Choose between models, fit calibration, check benchmarks. |
| **Final test** | **2026** | Untouched until final evaluation. `python src/train.py --final` refits on 2021–2025 and evaluates 2026 **once**. |

Random K-fold is never used.

## 3. Features (all calculated before kickoff)

Every feature uses only games played before the match. Features are expressed as **home minus away** differences, except for the match-context flags.

| Group | Features |
|---|---|
| **Elo** | Pre-match Elo difference and Elo win probability. Calculated from **all results since 2009** in the odds sheet. Settings (K, home advantage, margin-of-victory multiplier, off-season pull back to 1500) are tuned on 2013–2020 only. |
| **Team form** | Exponentially weighted averages of points for and against, margin, completion rate, run metres, post-contact metres, line breaks, tackle breaks, errors, penalties conceded, missed tackles and possession. At each new season the averages are pulled one-third of the way back to the league average. |
| **Context** | Rest-day difference, away team travelling interstate or overseas, home team playing at its own ground, neutral venue (Magic Round, Las Vegas and similar), finals flag. |
| **Player ratings** | See section 4. |
| **Odds** (Model A only) | **Opening** head-to-head probability with the margin removed (as a logit), opening line, opening total. |

**Preprocessing**
- **Team names:** odds-sheet names, including the pre-2014 spellings, are mapped to nrl.com short names. Odds rows are joined to matches on date (±1 day) plus home and away team.
- **Missing stats:** blank team stats (sin bins, 40/20s and the like, which the site leaves out when they're zero) are filled with 0.
- **Odds:** the bookmaker margin is always removed before converting odds to probabilities. Min and Max columns are never used.
- **Scaling:** for logistic and ridge regression, a `StandardScaler` and median imputation run **inside** the sklearn pipeline, so they only learn from the training fold. LightGBM takes the raw features.
- **Not encoded:** no one-hot team, venue or player IDs, and no embeddings. Elo, venue flags and player ratings carry that information instead.

## 4. Player ratings (aggregated to team level)

Player names are **not** used as features. With about 700 players and about 800 training games, name columns would mostly learn noise. Player quality enters the model through ratings:

1. **Player rating before each game:** an exponentially weighted average of the player's **fantasy points** in earlier games. It is pulled towards the average for the player's position group, with the pull fading as the player plays more games, so new players don't get extreme ratings.
2. **Lineup:** the players who actually got minutes in that game. This is the final team list, which is known about an hour before kickoff. Predictions therefore assume they are made just before kickoff, which is why closing odds are the fair benchmark.
3. **Team aggregates:** the sum of ratings for the **spine** (fullback, five-eighth, halfback, hooker), **forwards**, **outside backs** and **bench**.
4. **Compared with the team's usual strength:** today's spine rating minus the team's recent average spine rating, the number of spine changes since the last game, a halfback-changed flag, and the number of inexperienced players (fewer than 3 previous games).

**Whether the player features help is tested directly:** cross-validation compares feature sets with and without them.

## 5. Two model variants

- **Model B, no odds** (default): an independent view of the match. It is compared with the market to find value.
- **Model A, with opening odds:** the opening price is the starting point and the model learns where the market is wrong.

## 6. Training pipeline

1. `src/ingest.py`: clean the odds sheet and join it to the scraped matches.
2. `src/elo.py`: Elo engine. Settings are tuned on 2013–2020, and pre-match ratings are produced for every game since 2009.
3. `src/features.py`: builds the feature table, written to `data/processed/features.csv`.
4. `src/train.py`:
   - **Feature-set comparison** with walk-forward cross-validation and logistic regression: base → +player → +odds.
   - **Tuning:**
     - Logistic and ridge: grid search over `C` and `alpha`.
     - LightGBM: Optuna, 60 trials per target, over `max_depth` 2–4, `num_leaves`, `min_child_samples`, `learning_rate`, `lambda_l2`, `feature_fraction` and `bagging_fraction`. Each fold stops early on its test season. The final number of trees is the average of the best iteration across folds.
   - **Calibration:** Platt scaling, fitted on out-of-fold cross-validation predictions.
   - **Dev evaluation (2025):** logistic, LightGBM and their ensemble, against these benchmarks:
     - always pick the home team
     - Elo only
     - market opening odds
     - market closing odds; for 2025 the Odds Portal average stands in, because closing odds are missing from May 2024 to 2025
   - **Feature importance:**
     - logistic: standardised coefficients
     - LightGBM: SHAP values, calculated with LightGBM's built-in `pred_contrib`
   - **Final test (`--final`, 2026 only):** refit on 2021–2025 and score against **closing** odds, excluding the 16 games flagged as unreliable.
5. `tests/test_leakage.py`: rebuilds the features with every later game removed and the target games' own results scrambled, then checks that nothing changes.

**Metrics:**
- **Win probability:** log loss and Brier score (main), accuracy (secondary)
- **Margin and total:** mean absolute error

## 7. Betting-odds rules (avoiding leakage)

| Field | Use |
|---|---|
| Open | ✅ Feature (Model A) |
| Close / Odds Portal average | Benchmark only |
| Min / Max | ❌ Never, not even for ROI |
| Open → close line movement | ❌ Never a feature |
| Notes ("Data supply issue", unreliable close) | Filters only |

## 8. Running it

```
python src/scrape.py          # refresh nrl.com data (cached)
python src/features.py        # odds join + Elo + features
python src/train.py           # cross-validation, tuning, dev 2025 report -> reports/
python src/train.py --final   # ONE-TIME final test on 2026
python -m pytest tests        # leakage test
```
