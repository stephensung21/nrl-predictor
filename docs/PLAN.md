# NRL Predictor: Project Plan

A data science model that predicts NRL match outcomes using traditional machine learning. It is built on scraped match data from the last 4–5 seasons, with Elo ratings as one input, betting odds as the benchmark (and optionally an input), and an optional LLM layer.

---

## Overview

- **Elo is one input to the model, not the model itself.** It is still one of the strongest single predictors, but it feeds a machine-learning model alongside the match stats.
- **The scraped match data is the main source of inputs**, turned into rolling form features (see [Features](#2-features-the-most-important-part)).
- **Betting odds have two jobs.** They are the benchmark to beat, and optionally an input to the model.
- **The LLM is a helper, not the core predictor.** It turns team news into structured inputs and writes match previews.
- **The prediction model stays deterministic.** Agents sit around it, where the work is messy or unstructured (see [Agentic extensions](#7-llm-and-agentic-extensions)).

### How the parts connect

```
Results ──► Elo system ──► pre-match Elo ratings ─┐
Scraped stats ──► rolling form features ──────────┼──► ML model ──► win prob / margin
Betting odds ──► implied probability (optional) ──┘          │
                                                             ▼
                                   compare to the market ──► value / closing line value
```

The Elo system is built from results only. Its pre-match ratings then become features in the machine-learning model.

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
- Convert the Elo difference into a predicted margin with a linear fit on past games.

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

### Leakage checklist: Elo and rolling features

- **Use the Elo rating from before the match**, not the updated one. The update uses the result being predicted.
- **Tune Elo's settings (K, home advantage, season regression) on training seasons only.** Tuning on all seasons and then testing on those same seasons is mild leakage.
- **Shift rolling stats** so the current match is excluded.
- Add automated tests that fail if any feature for a match uses data from that match or later.

### Leakage checklist: betting odds

Pre-match odds are public before kickoff, so **they are not leakage in themselves**. Leakage means using information that wouldn't have been available at prediction time. Odds become leakage, or bias the results, in these situations:

| Situation | Leakage? | Why, and what to do |
|---|---|---|
| Using **closing odds** for predictions that would really be made earlier (e.g. Tuesday) | **Yes, mild** | Closing odds already reflect late team changes, weather and big bets. Use odds from the actual prediction time, or always predict just before kickoff. |
| Using **in-play or post-match odds** by mistake (bad scrape timestamps) | **Yes, severe** | Check every odds timestamp is before kickoff. |
| Measuring betting ROI at the **best price seen** ("max odds" columns, e.g. in aussportsbetting data) | **Optimistic bias** | Nobody can know in advance which price will be the best one, so ROI looks better than reality. Simulate at opening or closing odds. |
| Odds as a feature, then claiming the model **beats the market** | **No, but misleading** | The model may mostly copy the odds. To find value bets, compare a model *without* odds with the market too (Model B below). (In this project the with-odds model turned out not to just copy the odds: it learns what the opening price misses, mainly team news, and had the better betting edge; see IMPROVEMENTS.md items 7, 39 and 41.) |
| Removing the bookmaker margin using the final odds of both teams | Fine | As long as both prices come from the same moment. |

## 6. Two ways to use betting odds

Build both models:

- **Model A, opening odds as an input:** gives the best pure prediction, but it mostly learns the odds.
- **Model B, no odds:** an independent view, compared against the market to find **value bets**. A value bet is one where the model's probability exceeds the market's implied probability by some margin.
- Evaluate both against **closing odds**, which are the hardest benchmark.
- For betting simulation:
  - Use bet sizing of **¼ Kelly** or smaller.
  - Track **closing line value (CLV)**: whether bets consistently got better odds than the final market price. It is the most reliable sign of a real edge, more so than short-run profit.
  - Include bookmaker margin and realistic bet limits.

Treat this as an analysis exercise, and set strict limits if real money is ever involved.

## 7. LLM and agentic extensions

**The rule:** keep the **prediction model itself deterministic**: traditional ML, reproducible and testable. Agents belong around it, where the work is messy, unstructured or involves searching for information.

**The LLM trap:** an LLM's training data already contains historical results, so **any LLM-produced prediction can't be fairly backtested on past seasons**. Only evaluate LLM forecasts on games played after the model's knowledge cutoff, logged before kickoff.

Ranked by value:

### 7.1 Team-news agent (best fit)

Team lists come out on Tuesday, and late changes follow up to kickoff. The information is spread across news sites, club announcements and social media, and none of it is structured.

- **Tools:** search, fetch a page, look up the club roster.
- **Output:** structured features checked against the squad list, e.g. `{"team": "...", "halfback_out": true, "changes": 3, "key_outs": [...]}`.
- **Why an agent:** the right sources vary, so it has to search, cross-check and resolve conflicting reports.
- This is the one place an LLM adds information the model lacks, and it's often where the market finds its edge. Keep it only if its features improve log loss.

### 7.2 Chat interface over the model (MCP server)

Expose tools such as `get_prediction`, `explain_prediction` (SHAP), `elo_history`, `head_to_head` and `value_bets` through an MCP server.

- Questions like "Why do you like the Storm this week?" make the agent call the tools and explain the answer.
- Low risk, because the numbers come from the model, not the LLM.

### 7.3 Experiment agent (use with care)

The agent proposes a feature, runs the walk-forward backtest through a tool, reads the log loss, logs the result and iterates.

- **Danger:** after hundreds of experiments it overfits the validation seasons. **Lock away the final season** as a holdout that only a human runs, once.

### 7.4 Scraper-maintenance and data-quality agent

When the scraped site changes layout or a validation check fails (scores don't match stats totals, a missing round), an agent investigates and proposes a fix for a human to approve.

### 7.5 Weekly pipeline: a workflow, not an agent

The steps are fixed: fetch fixtures → update Elo → build features → predict → compare odds → write previews → publish. Fixed steps stay as plain code, with LLM calls only where needed (previews, team-news extraction).

### 7.6 Multi-agent analyst panel (learning exercise)

Stats, news and market agents each give a view, and a lead agent combines them into a probability.

- Treat it as **one more model in the ensemble**, logged before each match and evaluated on future games only.
- Expect it to lose to the ML model on its own, while possibly adding a little to the ensemble. Measuring that is the point.

### 7.7 Monitoring agent

Weekly checks on calibration drift, accuracy against the market and closing line value trend, with a written summary and alerts when something degrades.

### Where not to use agents

- Producing the main probability.
- Anything that places bets automatically.
- Steps that should be deterministic code (Elo updates, feature calculation).

## 8. Stack and repository layout

Python, pandas, scikit-learn, LightGBM, SHAP, Optuna (for tuning) and a Streamlit dashboard. Optionally MLflow to track experiments.

The weekly automation and the website (predictions, model vs odds, Elo, tipping comp, news feed) are planned in [PLAN_WEB.md](PLAN_WEB.md). The website replaces the Streamlit dashboard for sharing with friends.

```
nrl-predictor/
  data/raw, data/processed
  src/ingest.py        # load and clean scraped data and odds
  src/elo.py           # Elo engine, outputs pre-match ratings
  src/features.py      # rolling, leakage-safe features
  src/train.py         # walk-forward training and evaluation
  src/predict.py       # this week's predictions
  src/betting.py       # value bets, Kelly sizing, closing line value
  src/llm.py           # match previews
  agents/team_news.py  # team-news agent (search, fetch, roster check)
  agents/monitor.py    # weekly calibration and CLV report
  mcp_server/server.py # tools: predictions, SHAP, Elo history, value bets
  tests/test_leakage.py
  app/dashboard.py
  .github/workflows/weekly.yml   # scrape, predict, publish each round
```

## 9. Milestones

**Core model (no agents yet)**

1. **Ingest and clean** the scraped data, plus odds and long-history results.
2. **Elo engine**, with settings tuned on training seasons only, as the first baseline.
3. **Feature pipeline** with leakage tests (assert that no feature uses the current or a future match, and that all odds are pre-kickoff).
4. **Model A and Model B** (logistic regression and LightGBM), evaluated walk-forward against the closing-odds baseline.
5. **Calibration, ensemble and SHAP.**
6. **Betting simulation** at opening or closing odds, with closing line value tracking.
7. **Weekly pipeline** as a workflow, plus the dashboard and LLM-written previews. *Status (October 2026):* milestones 1–6 are done and `predict.py` exists; the website that replaces the dashboard is built on sample data. The ordered next steps (pipeline, grading, odds, database, automation, connecting the website) are in [PLAN_WEB.md, Next steps](PLAN_WEB.md#next-steps).

**Agentic extensions**

8. **Team-news agent**, tested to see whether its features improve log loss on live games.
9. **MCP chat interface** over the model.
10. **Experiment agent, analyst panel and monitoring agent**, as learning projects.
