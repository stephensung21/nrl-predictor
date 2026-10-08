# NRL Predictor: Project Plan

A data science model that predicts NRL match outcomes using traditional machine learning. It is built on scraped match data from the last 4–5 seasons, with Elo ratings as one input, betting odds as the benchmark (and optionally an input), and an optional LLM layer.

---

## Overview

- **Elo is one input to the model, not the model itself.** It is still one of the strongest single predictors, but it feeds a machine-learning model alongside the match stats.
- **The scraped match data is the main source of inputs**, turned into rolling form features (see [Features](#2-features-the-most-important-part)).
- **Betting odds have two jobs.** They are the benchmark to beat, and optionally an input to the model.
- **The LLM is a helper, not the core predictor.** It turns team news into structured inputs and writes match previews.

### Plan around the small dataset

Four or five seasons is about **1,000 games** (roughly 200 per season, including finals). That is small for machine learning, so:

- Use **simple, strongly regularised models**, meaning models penalised for complexity so they don't overfit. Logistic regression often beats complex models at this size.
- Keep to a **small set of strong features** rather than hundreds.
- **Get free results-only data back to around 2009** (for example aussportsbetting.com). It warms up the Elo ratings and gives closing odds, even though the detailed stats only cover 4–5 years.

---

## 1. Data layer

1. **Clean and normalise:** consistent team names (relocations and renames), venues, and timestamps.
2. **Tables:**
   - `matches`: date, round, home, away, venue, score, finals flag
   - `team_match_stats`: one row per team per match, from the scraper
   - `odds`: opening and closing head-to-head, line and total
   - `team_lists` (optional): ins and outs, and which positions changed
3. **Validation checks:** no duplicate games, scores match the stats totals, no missing rounds.

## 2. Features (the most important part)

**The golden rule: every feature must use only information available before kickoff.** A match's own stats can't be used to predict that match. Build features as rolling values from earlier games, shifted so the current match is excluded.

| Group | Examples |
|---|---|
| **Ratings** | Elo (with home advantage and margin-of-victory weighting); optionally a separate attack/defence rating |
| **Form** | Last 3 and last 5 games: points for and against, margin, win rate; exponentially weighted averages |
| **Scraped stats** (rolling) | Completion rate, run metres, line breaks, errors, penalties conceded, tackle efficiency, possession, set restarts |
| **Context** | Days of rest difference, travel distance or interstate trip, home ground vs shared venue, short turnaround, Origin period, finals flag |
| **Matchup** | Express everything as **home minus away differences**. This halves the feature count and suits small data. |
| **Team news** (optional, via LLM) | Key players out (halfback, five-eighth, hooker, fullback), number of changes from the previous week |
| **Market** (optional) | Bookmaker implied probability with the bookmaker margin removed, and line movement |

Early-season games have little rolling history. Handle this by carrying last season's values forward, pulled partway back towards the average.

### Elo model details

- Every team starts at 1500.
- Expected result: `E = 1 / (1 + 10^((R_away − R_home − HFA) / 400))`
- Update after each game: `R_new = R + K × MOV_mult × (actual − E)`
- Settings to tune:
  - **K** (how fast ratings move): around 20–40.
  - **Home-field advantage (HFA):** around 30–60 Elo points; reduce it for neutral venues such as Magic Round.
  - **Margin-of-victory multiplier:** for example `ln(|margin| + 1) × 2.2 / (Δelo × 0.001 + 2.2)`, which stops strong teams' ratings inflating.
  - **Off-season regression:** pull each rating about 25–33% back towards 1500 between seasons.

## 3. Prediction targets

- **Win probability** (classification): the main target.
- **Margin** (regression): useful for line betting and for checking whether the model is sensible.
- **Total points** (optional): useful for over/under bets.

## 4. Models, in increasing complexity

1. **Baselines to beat:**
   - Home team always wins.
   - Elo only.
   - **Bookmaker closing odds.** This is the real test.
2. **Logistic regression** for win probability, and **ridge regression** for margin.
3. **Gradient boosting** (LightGBM or XGBoost) with shallow trees and early stopping.
4. **Ensemble:** average or stack the models above.
5. **Probability calibration** (Platt scaling or isotonic regression) so that "70%" really means about 70%.

Use **SHAP** to see which features drive the predictions and to sanity-check the model.

## 5. Validation without accidental cheating

- **Walk-forward validation only:** train on seasons up to N and test on N+1, or retrain each round. Never shuffle with random K-fold cross-validation, because that lets future games leak into training.
- **Metrics:**
  - log loss and Brier score (the main ones)
  - accuracy
  - average margin error
  - a calibration plot
- **Realistic expectation:** good public NRL models tip roughly 63–68% of winners, close to the market. Beating the market's log loss at all is a real achievement.

## 6. Two ways to use betting odds

- **Model A, odds as an input:** gives the best pure prediction, but it mostly learns the odds.
- **Model B, no odds:** an independent view, compared against the market to find **value bets**. A value bet is one where the model's probability exceeds the market's implied probability by some margin.
- For betting simulation:
  - Use bet sizing of **¼ Kelly** or smaller.
  - Track **closing line value (CLV)**: whether bets consistently got better odds than the final market price. It is the most reliable sign of a real edge, more so than short-run profit.
  - Include bookmaker margin and realistic bet limits.

Treat this as an analysis exercise, and set strict limits if real money is ever involved.

## 7. LLM layer (optional)

**Good uses**

- **Turning text into features:** feed team-list announcements and injury news to an LLM and get structured output back, for example `{"halfback_out": true, "changes": 3, "debutants": 1}`.
- **Written match previews** that explain the model's prediction and its top SHAP drivers.
- **An LLM forecast as an extra input:** log the LLM's pre-match probability and evaluate it like any other model. Add it to the ensemble only if it improves log loss.

**The trap:** an LLM's training data already contains the historical results, so **LLM predictions can't be fairly backtested on past seasons**. Only evaluate them on games played after the model's knowledge cutoff, logged before kickoff.

## 8. Stack and repository layout

Python, pandas, scikit-learn, LightGBM, SHAP, Optuna (for tuning) and a Streamlit dashboard. Optionally MLflow to track experiments.

```
nrl-predictor/
  data/raw, data/processed
  src/ingest.py        # load and clean scraped data and odds
  src/elo.py           # Elo engine, outputs pre-match ratings
  src/features.py      # rolling, leakage-safe features
  src/train.py         # walk-forward training and evaluation
  src/predict.py       # this week's predictions
  src/betting.py       # value bets, Kelly sizing, closing line value
  src/llm.py           # optional: team-news extraction and previews
  app/dashboard.py
  .github/workflows/weekly.yml   # scrape, predict, publish each round
```

## 9. Milestones

1. **Ingest and clean** the scraped data, plus odds and long-history results.
2. **Elo engine** with tuned settings, as the first baseline.
3. **Feature pipeline** with leakage tests (assert that no feature uses the current or a future match).
4. **Logistic regression and LightGBM**, evaluated walk-forward against the bookmaker baseline.
5. **Calibration, ensemble and SHAP.**
6. **Betting simulation** with closing line value tracking.
7. **Weekly automation and dashboard.**
8. **LLM additions:** team-news features and previews, evaluated on live games only.
