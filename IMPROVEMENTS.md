# NRL Predictor: Improvement Plan

The goal is to beat the bookmakers' closing odds.

## Where things stand

The main yardstick is now the **2023–2025 backtest** (`python src/train.py --backtest`). For each season, the whole development procedure is rerun on earlier seasons only, then that season is predicted: 631 out-of-sample games in total. A single dev season (212 games) proved too noisy to judge by. 2025 alone once suggested the no-odds model beat the market, and the backtest showed that was luck.

**Main models: the ensemble for both variants** (`MAIN_MODEL` in `config.py`): with-odds ensemble and no-odds ensemble, each the 50/50 average of the linear model and LightGBM. On the pooled backtest the with-odds ensemble is within 0.001 of with-odds linear (0.6220 vs 0.6209). The ensemble was chosen as the more robust option, and since LightGBM was rebuilt (item 4) it no longer drags the ensemble down. All model types are still fitted and reported.

Pooled backtest results for the current setup:

| | Win log loss | Margin MAE | Total MAE |
|---|---|---|---|
| **With-odds ensemble** (main model) | 0.622 | **13.49** | 10.78 |
| With-odds linear | **0.621** | 13.53 | **10.72** |
| **No-odds ensemble** (main model) | 0.627 | 13.52 | 10.83 |
| No-odds linear | 0.626 | 13.56 | 10.81 |
| With-odds LightGBM | 0.629 | 13.56 | 10.91 |
| Market closing (Odds Portal average) | 0.620 | – | 10.72 |
| Market opening | 0.633 | 13.66 | 10.84 |
| Elo only | 0.638 | – | – |

- **Win probability:** the with-odds ensemble is 0.002 behind the market average (95% interval −0.012 to +0.015) and with-odds linear 0.0005 behind, essentially level, down from +0.024 at the start of the backtest work. (The per-season and real-closing-odds figures below are from before the star absences and BlueBet inputs were added.) By season it was behind in 2023 (0.595 vs 0.576) and slightly ahead in 2024 (0.631 vs 0.636) and 2025 (0.647 vs 0.648). Against real closing odds (271 reliable games, mostly 2023) it's still clearly behind (0.604 vs 0.588). It beats the opening market and Elo.
- **Margin:** the models beat the opening line on average error, but not on line-cover probability (item 14).
- **Totals:** with-odds linear is level with the closing total and beats the opening total.
- **Betting:** no bettable edge shown yet. Against opening prices, head-to-head bets made +9–13% ROI (with-odds ensemble +12.6%, interval +3.0% to +22%), but almost all of it comes from team news the opening price doesn't yet reflect, and every market loses at closing prices (item 7).
- **Caveat:** the backtest has informed many decisions (fixed feature sets, the rain flag, the adopted combination), so these numbers are somewhat optimistic. The 2026 final test below is the honest verdict.

### Final test: 2026 (run once, 9 October 2026, commit `c43c38e`)

The backtest procedure was run once on the unseen 2026 season (`reports/final_2026.md`): developed on 2021–2025, all 213 games predicted, no refitting during the season. Real closing odds are available and reliable for 197 games.

| 197 games with reliable closing odds | Win log loss | Accuracy | Margin MAE | Total MAE |
|---|---|---|---|---|
| **With-odds ensemble** (main model) | 0.648 | **67.5%** | 15.27 | **10.90** |
| With-odds linear | 0.654 | 65.5% | **15.19** | 10.93 |
| With-odds LightGBM | **0.646** | 65.0% | 15.44 | 10.92 |
| **No-odds ensemble** (main model) | 0.651 | 62.9% | 15.50 | 11.07 |
| Market closing | 0.647 | 61.9% | 15.20 | 11.06 |
| Market opening | 0.658 | 62.4% | 15.26 | 11.13 |
| Elo only | 0.658 | 62.4% | – | – |
| Always home team | 0.694 | 53.3% | 16.01 | 11.23 |

- **2026 was a harder season to predict:** the closing market scored 0.647, against 0.620 over the backtest. Every model is worse in absolute terms, so compare models with the market rather than with the backtest numbers.
- **Relative to the market, the result held up as the backtest said:** the with-odds ensemble is level with the closing price (+0.001, 95% interval −0.021 to +0.021) and the market average (−0.001). It beats the opening price by 0.012 (backtest: 0.011; 90% chance it is better) and Elo by 0.008. The no-odds ensemble is 0.005 behind closing and 0.008 ahead of opening. None of these differences is statistically clear on 213 games.
- **Totals:** both ensembles beat the closing total (10.90 vs 11.06 MAE). **Margin:** level with the closing line (15.27 vs 15.20).
- **Calibration** is reasonable where most games are (0.5–0.65: predicted 57%, actual 59%; above 0.65: 73% vs 71%). The two lower bands are noisy (26 and 35 games).
- Caveat: before this run, summary margin figures for 2026 were seen once by accident (noted at the time); nothing was changed because of them.

**2026 betting simulation** (`python src/betting.py --season 2026`, `reports/betting_2026.md`): the backtest's rules unchanged (flat stakes at opening prices, every threshold shown).
- **Odds data problems found:** the 2026 sheet has impossible prices (implied probabilities summing to under 100%) for 15 opening lines (away prices of 13–19) and 9 opening / 67 closing totals. The simulation now drops any such price; no 2021–2025 price is affected and the backtest results are unchanged. The remaining 2026 totals prices are also doubtful (about a 1–2% margin instead of 5%; under prices up to 2.26). Head-to-head prices are clean. Note the with-odds models use `open_line` as an input, so the 15 games may also have slightly affected predictions.
- **Head to head (clean prices): the opening-price edge held up.** With-odds ensemble: +24.5% ROI on 132 bets at a 0% edge (95% interval +3% to +46%), +27% at 2%. No-odds: +19% (−1% to +40%). The best evidence is closing line value: the price moved towards the bet 68% of the time (backtest: 69%), with a similar average move (+0.038 implied probability; backtest +0.044). ROI at closing prices was +16%, against −4% in the backtest; with about 130 bets that swing is within luck.
- **Line: loses** (−4% to −10%), as in the backtest.
- **Totals: +11% to +25%, but not trustworthy.** 161 of 167 bets were unders; 2026 games went under the opening total 57% of the time, the most of any season. At standard 1.90 prices the ROI would have been about +9%, not +18%. With doubtful prices and one-directional bets, this is not evidence of an edge.

**Status:** ✅ done · 🔶 partly done · ⬜ not started · ❌ tried, didn't help

---

## 1. Feature selection ✅ (replaced by fixed sets)

Forward selection inside walk-forward CV was built first, then made stricter: a feature had to improve every CV season. The backtest showed it was **unstable and overfit**. With only 1–2 CV seasons for the earlier backtest years, it picked 8–9 features that changed every season.

It's now replaced by **fixed feature sets** (`LINEAR_FEATURES` in `config.py`), built from the features chosen consistently across backtest seasons:
- win and margin: Elo, RAPM total, RAPM defence, RAPM compared with usual line-ups;
- totals: RAPM expected points, Origin period, wet conditions.

The with-odds model adds the opening odds. LightGBM uses the full feature set. Forward selection is still available with `--select`. Fixed sets improved the backtest: no-odds linear went from 0.645 to 0.634, and its total MAE from 11.05 to 10.88.

## 2. Team-news features ✅

- **Named 17 instead of "players with minutes > 0".** The old definition leaked post-match information; the leakage test now scrambles minutes played and goal-kicking.
- Added usual players missing (count and rating), new players by position group, experienced players returning, and goal-kicker missing. Captain changes weren't possible, because the data has no captain field.
- None are in the fixed linear sets. LightGBM uses them.

## 3. Better player ratings (RAPM) ✅

Regularised plus-minus: each player is rated by how the team's margin changes with them in the named 17. It's a ridge regression over earlier games, refitted before every round (penalty 300, 90-day half-life, chosen on 2022–24 CV). **RAPM total is the strongest single feature** and was picked first in every backtest season.

## 4. Improve and stabilise LightGBM ✅ (adopted)

Reopened once the ensemble became the main model, since LightGBM is half of it. After the score fix (item 34), LightGBM moved by up to ±0.006 just from re-tuning on slightly different data. `python src/experiments.py --only lightgbm` (`reports/experiments_lightgbm.md`) compared five variants on accuracy and stability:

- **Stability:** with Optuna on the full ~50 features, a different random seed moved each game's win probability by about **3 percentage points** on average. Fixed settings averaged over 5 seeds: **0.4–0.6 points**, about six times more stable.
- **Accuracy:** a compact feature set was the biggest gain (the full set overfit). LightGBM alone improved from 0.640 to **0.630** with odds and from 0.638 to 0.634 without. The with-odds ensemble went from 0.628 to **0.6245**, margin 13.61 → 13.51, and **total clearly better** (10.85 → 10.78). The no-odds ensemble was about unchanged on win (0.6281 → 0.6279).

**Adopted:** fixed conservative settings (depth 2, learning rate 0.02, at least 40 games per leaf, L2 10, 70% of features and 80% of games per tree; only the number of trees chosen by CV), on a **compact set of 16 features** (every linear-model feature plus RAPM attack, RAPM missing, rookies, rest days, travel, neutral venue and finals flag; plus the 3 opening-odds features for the with-odds model), **averaged over 5 seeds** (`LGB_TUNING`, `LGB_FIXED`, `LGB_COMPACT`, `LGB_SEEDS` in `config.py`). These settings were chosen in advance, not tuned on the backtest. The backtest now takes about 10 seconds instead of about 10 minutes. `--tune-lgb` restores Optuna on the full feature set.

Betting with the new ensembles (opening prices, 0% minimum edge): with-odds head-to-head +9.8% (95% interval +0.9% to +19%), −4.7% at closing prices. Same story as before: the edge is against opening prices only.

## 5. More seasons of data ✅

The scraper now covers 2020–2026. Scraped games are used **from the six-again restart on 28 May 2020** (`SIX_AGAIN_START`); rounds 1–2 of 2020 were played under the old rules. Elo still uses every result since 2009.

- **2020 as history** (ratings, form, experience) is the default. It's neutral in the backtest, but it makes the 2021 features correct and adds 40 usable 2021 games.
- **2020 as training rows** (`--train-from 2020`) was slightly worse, probably because of COVID conditions.
- No earlier seasons: before the six-again rule, the stats mean different things.

## 6. When bets would be placed ⬜

The betting simulation (item 7) showed the model's edge against opening prices comes mostly from team news. That raises a timing problem:
- **Opening prices usually come out before Tuesday's team lists** (often straight after the previous round), so you can't normally bet at the opening price with the lists in hand. The odds sheet doesn't record when its opening price was captured.
- **Prices move quickly** once the lists are out, especially for big changes.
- **The model uses the match-day 17,** which is later than Tuesday's list (late withdrawals, positional reshuffles). A Tuesday bet wouldn't have that information.
- **Much team news is public before Tuesday** (weekend injuries, suspensions), so opening prices may already reflect some of it.

The realistic test needs **Tuesday's team lists** (nrl.com team-list articles; item 24) and **prices captured just after them**: Betfair Exchange historical data (timestamped), a paid historical odds API, or recording prices every Tuesday evening from now on.

Note: the wet-conditions flag assumes predictions just before kickoff. For early-week bets it would need a weather forecast instead.

## 7. Test whether the edge is real ✅

- ✅ A **paired bootstrap** against the market average, opening odds and Elo is built into the backtest report.
- ✅ **Betting simulation** (`python src/betting.py` → `reports/betting.md`). Flat 1-unit bets at the **opening** prices whenever probability × odds − 1 exceeds 0%, 2%, 5% or 10%, on the out-of-sample 2023–2025 backtest predictions. Line and total probabilities come from the predicted margin and total, with the error spread from earlier seasons. Closing line value (CLV) = whether the price or line moved towards the bet by kickoff.

`betting.py` now bets on the main models (the ensembles): with-odds ensemble head-to-head made +8.4% ROI at opening prices (95% interval −0.2% to +17%) and −6.6% at closing prices, the same story as below. The table below is from the earlier run on the linear models.

Results at a 0% minimum edge (the other thresholds tell the same story):

| Market | Model | Bets | ROI at opening price | 95% interval | Price moved towards bet | ROI at closing price |
|---|---|---|---|---|---|---|
| Head-to-head | A | 399 | +11.4% | +2% to +21% | 72% | −6.4% |
| Head-to-head | B | 469 | +12.1% | +2% to +22% | 70% | −6.2% |
| Line | A | 412 | +2.1% | −7% to +11% | 70% | −3.2% |
| Line | B | 482 | +3.8% | −5% to +12% | 64% | +0.2% |
| Total, with rain flag | A | 446 | +5.0% | −4% to +14% | 35% | +5.6% |
| Total, no rain flag | A | 407 | +1.2% | −8% to +10% | 31% | +1.8% |

- **The head-to-head edge is team news.** With no line-up features (Elo and the team rating only), ROI at opening prices falls to +3.7% (the with-odds model) and +2.2% (the no-odds model), both within noise, and the share of prices moving towards the bet falls from about 70% to 57–59%. Opening prices usually come before team lists, so this edge probably can't be bet (item 6).
- **Every market loses or breaks even at closing prices.** Closing prices for head-to-head and line only exist for 2023 and part of 2024.
- **The totals signal was mostly the rain flag.** Without it (the honest version for early-week bets), totals are about break-even.
- Optimistic: draws were excluded from the backtest (about −1 to −2% ROI on head-to-head); 2025 contributes heavily (the market was overconfident that year); the backtest informed many decisions.

**No bettable edge has been shown yet.** Next: the Tuesday-list test (items 6 and 24) and paper trading (item 33).

## 8. Context features ✅

Added short turnaround, game after a bye, Origin period, players backing up from Origin, and usual players missing for Origin. `scrape.py` fetches the State of Origin games. Only `origin_period` is in a fixed linear set (totals); the rest are LightGBM only.

## 9. Evaluate over more seasons ✅

The `--backtest` mode, described above.

## 10. Improve RAPM ✅

- ✅ **Bench weighting:** past games weight players by minutes, and predictions use the typical minutes for each player's named role. It improved CV.
- ✅ **Attack/defence split:** fitted as separate margin and total regressions (equivalent to one attack/defence model, but much faster). It gives RAPM defence (in the fixed win set) and RAPM expected points (in the fixed totals set).
- ❌ **Stats-based prior** (fantasy points): worse on CV. It's off, but available as `RAPM_STATS_PRIOR`.
- The RAPM changes improved CV but didn't move the backtest much on their own.

## 11. Unused match data and other markets ✅

- ✅ **Wet conditions** (rain, or a slippery/wet/heavy/muddy ground): cut total MAE by about 0.09 (with-odds linear 10.82 → 10.73). It's recorded on the day, so it assumes betting near kickoff.
- ❌ **Referee records** (shrunk total points and penalties): no signal.
- ✅ **Line and total markets:** tested in the betting simulation (item 7) and the probabilistic margin/total model (item 14). Although the models beat the opening line and total on average error, that didn't translate into betting value: **no edge on the line** (+2% to +4% ROI at opening prices, within noise; about −3% to 0% at closing prices), and **totals about break-even without the rain flag** (+1% at opening prices). Closing lines are missing for most of 2024–25, so the closing comparison mainly covers 2023.

## 12. Fix the ensemble ❌

Tested (experiment 5): averaging in logit space, stacking learned on earlier seasons, and stacking all four models were all no better than the plain average (+0.0002 to +0.002). Since the linear model improved (item 22), the ensemble no longer beats the linear model on the pooled backtest, but the two are tied within noise and the ensemble won 2 of the 3 seasons, so the plain-average ensemble is the main model for both variants.

---

## Already tried, didn't help

| Idea | Result |
|---|---|
| Win probability from the predicted margin (`Φ(margin / σ)`) | 0.653 at best on 2025; **reversed on the backtest and adopted (item 22)** |
| Market price as a fixed starting point, learning adjustments on top | 0.658 at best on 2025 |
| Weighting recent seasons more heavily | 0.655–0.657 on 2025 |
| Elo plus opening odds model trained on the full 2013–2024 history | 0.654 on 2025 |
| Retuning Elo on 2013–2024 instead of 2013–2020 | 0.655 (vs 0.653) on 2025 |
| Per-season forward feature selection | unstable; backtest worse than fixed sets (0.645 vs 0.634) |
| Separate forward selection for totals | linear total MAE 11.05, worse than predicting the mean |
| Context and Origin features in the linear model | each made CV worse |
| RAPM shrunk towards a fantasy-points prior | CV 0.611 vs 0.606 without |
| 2020 games as training rows | backtest slightly worse than 2020 as history only |
| Referee records for totals | no change in total MAE |
| Market as a fixed starting point (re-tested on the backtest) | −0.0003 |
| Recency weighting (re-tested on the backtest) | −0.002 to +0.001 |
| Elo retuned inside each backtest year | slightly worse (+0.001 to +0.003) |
| Probabilistic margin vs the opening line | no better than a coin flip |
| Team-specific home advantage on top of the team rating | −0.002, within noise |
| Opponent-adjusted form | no help; the full block made margin worse |
| Logit-average or stacked ensembles | no better than the plain average |
| Margin and total models trained on capped targets (margin ±40, total ±25) | margin MAE −0.03, win −0.0005: real but too small to adopt |
| Huber regression for margin and total | mixed (A −0.03, B +0.03 margin MAE), no gain |
| Median (quantile) regression for margin and total | no gain; the no-odds model's totals clearly worse (+0.11) |
| GAM (splines) or Explainable Boosting Machine, alone or in the ensemble | no clear gain; relationships are essentially linear (item 20) |
| Reserve-grade (NSW Cup / QLD Cup) ratings of newcomers, fantasy or plus-minus | margin −0.01 to −0.04, win ±0.001: too small to adopt (item 28) |
| Team total rating for the totals model | total MAE −0.02 to +0.04, not clear (item 27) |
| Weekly refitting of the models | win +0.001 to +0.002; worse from round 19 (item 24) |
| Kickoff slot (night game, day of week) | linear models clearly worse on win (+0.004) (item 18) |
| Travel distance and time-zone change | no clear effect (item 18) |
| Origin representatives in the named 17 | no clear effect; overlaps team strength (item 18) |
| Ladder position and out-of-contention flag | no clear effect; overlaps team strength (item 18) |
| Stats-based or RAPM-based star players (named / out) | no clear effect (item 38) |
| Key-position absences weighted by form (V1–V3) | −0.001 to −0.002, not clear (item 38) |
| Star impact learned from each player's with/without history (V4) | no effect (item 38) |
| Origin-only star absences (S1) | −0.0012 / −0.0007, not clear; S2 adopted instead (item 38) |
| Recalibrating the final win probability on earlier backtest seasons | −0.001 (slope only), redundant after the BlueBet fix (item 23) |
| Weekly refitting of the model weights and/or the calibration | +0.002 to +0.009 (worse), clearly worse late in the season (item 24) |
| No odds in the models; the market as a separate expert in a learned blend (Footy Tipper) | +0.008 vs the with-odds ensemble (clearly worse) (item 39) |

---

## Code review findings

1. **The backtest is no longer a fully independent test.** The fixed linear feature sets came from which features the backtest's selection kept choosing, and the rain flag was kept after seeing the backtest's totals results. The RAPM settings were also tuned on 2022–24 CV, which overlaps the backtest. The backtest numbers are therefore somewhat optimistic, and **the 2026 `--final` run is the only fully clean test left**. Treat the current setup as close to frozen: a new idea should beat it by a clear margin before it's adopted.
2. **Several "already tried" rejections were judged on 2025 only**, and with the old features: win probability from the margin, the market as a fixed starting point, recency weighting, and Elo retuning. 2025 has proved too noisy, so these should be rerun on the backtest (item 13).
3. **Margin and total are scored by average error, but betting needs probabilities.** A line bet needs P(home covers −4.5), which depends on the spread of possible margins as well as the prediction. There's no probabilistic margin or total model yet, and no line-cover or over/under metric (item 14).
4. **Form stats aren't opponent-adjusted.** Raw averages treat yardage against a strong defence the same as against a weak one, which is likely why the form features never help (item 17).
5. Smaller code points:
   - **Attack/defence mixes capped and uncapped targets.** The RAPM margin target is capped at 40 but the total target isn't, so the "exactly equivalent" claim in the `rapm_features` docstring is only approximate. Either cap the total too or adjust the docstring.
   - **The ensemble is a plain 50/50 average of probabilities.** Averaging in logit space or weighting by out-of-fold performance is standard (item 12).
   - ✅ **`--select` and `--train-from` overwrite module-level variables:** settings now live in `config.py` and are read when functions run, so the flags change them in one place (item 37).
   - ✅ **Stale text in `train.py`:** fixed in the restructure (item 37).

---

## Further approaches (items 13–38)

### 13. Rerun the 2025-only rejections on the backtest ✅

Results are in `reports/experiments.md` (`python src/experiments.py`):
- **Win probability from the predicted margin: reversed.** On its own it was −0.005 for the with-odds model; blended with the logistic model −0.005 [−0.010, +0.0005]. That's a near miss, adopted as part of item 22.
- ❌ Market as a fixed starting point with learned adjustments: −0.0003, no difference.
- ❌ Recency weighting (half-life 1 or 2 seasons): −0.002 to +0.001, no difference.
- ❌ Elo retuned inside each backtest year (2013+ or the six-again era 2020+): slightly **worse** (the no-odds model +0.001 to +0.003). Keep the current Elo settings.

### 14. Probabilistic margin and total model 🔶

Tested in `experiments.py`: a Normal or t distribution around the linear prediction, with constant spread or spread depending on mismatch and wet conditions, scored on covering the opening line and going over the opening total. The market is 50% by construction; break-even at $1.91 is 52.4%.
- **Line: no edge.** The with-odds model log loss −0.0007 vs a coin flip; hit rate 53.1%, and 53.8% when over 55% sure.
- **Totals: the most promising signal so far.** The with-odds model hit rate 54.5%, and **57.1% on the 308 games where it's over 55% sure**, about 1.7 standard errors above break-even. Not conclusive, and it relies on the rain flag (betting near kickoff).
- Varying the spread or using a t-distribution made no difference.

Next: the betting simulation on totals against the opening total (item 7).

### 15. Team-level margin rating ✅

`team_ratings` in `features.py`: a ridge regression of capped margins since 2009 on team strengths, a league home advantage and each team's own home advantage (shrunk), refitted weekly with a two-year half-life (the setting chosen inside every backtest year). Adding it to the win model: −0.004 [−0.008, +0.0002] for The with-odds model, a near miss, adopted as part of item 22. Using it instead of Elo was about the same, so both are kept.

### 16. Team-specific home advantage ❌

Each team's own home advantage as a separate feature added nothing beyond the team margin rating (which already includes it): −0.002 for the with-odds model, within noise.

### 17. Opponent-adjusted form ❌

Each team's recent stats relative to what its opponents usually allow (and concede). A single adjusted net-points feature made no difference; the full adjusted block made margin clearly **worse** (+0.16 and +0.25 MAE). Form stats, adjusted or not, don't add to RAPM and Elo.

### 18. More context features 🔶 (four groups tested, none adopted)

Tested in the full pipeline backtest (`python src/experiments.py --only context2` and `--only ladder`; `reports/experiments_context2.md`, `reports/experiments_ladder.md`), each group added to the linear models (and so LightGBM's compact set) or to LightGBM only. Results for the main ensembles, change against current:

| Group | Features | Result |
|---|---|---|
| ❌ Kickoff slot | `night_game`, `kickoff_thursday`, `kickoff_friday`, `kickoff_sunday` (Sydney time) | in the linear models, **clearly worse** on win (+0.004); in LightGBM, no effect |
| ❌ Travel | `diff_travel_km` (great-circle km from each team's base; Warriors' COVID bases handled), `diff_tz_change` | no clear effect; margin slightly worse in the linear models |
| ❌ Origin representatives | `diff_origin_reps`: named players who played Origin in the last 12 months | no clear effect (margin −0.01 to −0.05) |
| ❌ Ladder and motivation | `diff_ladder_pos` (before the round; 2 points a win or bye), `diff_out_of_contention` (can't reach 8th even winning out) | no clear effect (win ±0.0003, margin −0.01 to −0.03) |

Origin representatives and ladder position are strongly related to margin on their own (correlations 0.29 and −0.31), but both just measure team strength, which Elo, RAPM and the team rating already capture. Kickoff slot and travel have little effect on NRL results. All these features stay computed in `features.csv` but aren't used by any model.

Not yet tested:
- **Combination continuity:** games the halves pairing and the spine have played together, not just how many changes there were.
- **Workload and fatigue:** key players' minutes over the last 2–3 weeks, including Origin minutes.

### 19. Position-specific player ratings from stats 🔶

Ratings built from the stats that matter for each position (run metres for forwards, kicking and try involvement for halves), as a steadier signal than RAPM for players with few games. Fantasy points were a poor proxy. The stats-based star definitions tested in item 38 (fantasy points per 80 minutes within position) didn't identify the stars whose absence matters (e.g. Reece Walsh rated as only an average fullback), so this item is unlikely to help on its own.

### 20. Other model types (GAM, Explainable Boosting Machine) ❌

Tested with `python src/experiments.py --only gam` (`reports/experiments_gam.md`): a GAM (cubic splines per feature, then penalised logistic / ridge, penalty tuned by CV) on the linear features and on the compact features, and InterpretML's Explainable Boosting Machine (settings fixed in advance; additive only, or up to 5 interactions) on the compact features. Each was compared alone, replacing LightGBM in the ensemble, and as a third ensemble member.
- **No combination was clearly better** than the current ensemble on win, margin or total.
- The GAM on the linear features scores almost exactly like the linear model (0.6253 vs 0.6243 with odds): **the relationships are essentially linear**, so there's no curvature to exploit. The compact-feature GAM was clearly worse alone.
- The EBM with interactions was the best non-linear model alone (0.628, better than LightGBM), but in the ensemble it moved win log loss by only 0.001–0.003 (best: no-odds 0.6279 → 0.6246 replacing LightGBM, interval −0.010 to +0.004).
- Conclusion: the models are at a ceiling set by the information in the features, not the algorithm. Gains are more likely from better inputs (e.g. item 28) or calibration (item 23).

Needs `interpret-core` (0.7.7, installed in the virtual environment, imported only by this experiment).

### 21. Nested tuning in the backtest ⬜

Re-choose the RAPM settings (and any other feature settings) inside each backtest year, so the backtest stays an honest out-of-sample test.

### 22. Team margin rating + margin-blended win probability ✅ (adopted)

The two near misses (items 13 and 15) tested together: `team_margin` in the linear win model, and the calibrated logistic probability averaged with Φ(predicted margin / σ) from the linear margin model (`MARGIN_BLEND` in `config.py`).
- Linear harness: the with-odds model −0.006 [−0.013, −0.0002], just clear; the no-odds model −0.005 [−0.012, +0.0005].
- Full backtest: with-odds linear 0.631 → **0.624**, with-odds ensemble 0.628 → 0.625, no-odds linear 0.633 → 0.628.
- This combination was chosen after seeing the individual results, out of about 50 comparisons, so part of the gain may be chance. Both parts point the same way independently and the idea is principled (margins carry more information than win/loss), which is why it was adopted.

### 23. Second review: findings ✅

From a second pass over the pipeline (October 2026):
- **The final model is overconfident** (calibration slope 0.81–0.86 in 2024–25 for the with-odds ensemble; 1.0 would be perfect). ❌ **Recalibrating the final probability** (`python src/experiments.py --only calibration`, `reports/experiments_calibration.md`), fitted for each season on earlier seasons' out-of-sample backtest predictions: slope-only shrinking −0.0009 to −0.0014 on 2024–25 (not clear), slope and intercept slightly worse. Not adopted: **most of the overconfidence came from the bookmaker change** (item 35), and once that was fixed recalibration added only 0.0002.
- **The market underrates home teams slightly:** its calibration intercept is +0.10 in logit terms (about 2–3 percentage points). The with-odds model already learns this through its intercept.
- **Robust training for margin and total** was tested and not adopted (see "Already tried").

### 24. Pipeline: prediction time and live use ⬜

- **`predict.py` for upcoming games.** The scraper only keeps finished matches and nothing builds features for unplayed fixtures, so the model can't currently be used. It needs to fetch the next round's fixtures and team lists, build features, and output probabilities, fair odds and edges against current prices.
- **Two prediction snapshots:** a **Tuesday-list model** (built from Tuesday's announced squads) and a **final-17 model** (as now), each evaluated against prices from the same time. Includes scraping historical Tuesday team lists from nrl.com.
- ❌ **Weekly refitting** (`python src/experiments.py --only weekly`, `reports/experiments_weekly.md`): each season's settings kept, but the models refitted before every round with that season's games so far. Main ensembles: win +0.001 to +0.002, margin about 0, total −0.02 to −0.03, none clear; **from round 19 it's worse** (with-odds win +0.006, clear). The calibration comes from complete earlier seasons, so in-season refits drift away from it. Not adopted. (`models.fit_predict_frames` now fits and predicts on any rows; results unchanged.)
- ❌ **Weekly refitting with weekly calibration** (`python src/experiments.py --only weekly2`, `reports/experiments_weekly_calibration.md`): the model weights refitted every round, and the final win probability also recalibrated every round on all earlier out-of-sample predictions (earlier backtest seasons and this season's earlier rounds). Win log loss against the current once-a-season fit:

  | Set-up | With-odds ensemble | No-odds ensemble | With-odds ensemble, rounds 19+ |
  |---|---|---|---|
  | Weekly model weights | +0.0033 | +0.0014 | +0.0083 (clearly worse) |
  | Weekly weights + weekly calibration (slope only) | +0.0060 | +0.0038 | +0.0159 (clearly worse) |
  | Weekly weights + weekly calibration (slope and intercept) | +0.0085 | +0.0065 | +0.0159 (clearly worse) |
  | Weekly calibration only (slope only) | +0.0024 | +0.0021 | +0.0090 |

  Every weekly variant is worse, most late in the season: weekly fitting chases a few rounds of noise (e.g. flattens predictions after early upsets). Week-to-week changes in form are **already handled by the features**, which update every round (Elo after every game, the team margin rating weekly, RAPM before every round with a 90-day half-life, this week's named 17, and the star rule's form part every round). The weights describe stable relationships and are best fitted once per season on complete earlier seasons. Not adopted.

### 25. Pipeline: engineering ⬜

- **Pin dependencies** (`requirements.txt` or a lock file) so results reproduce.
- **A single entry point and a config file** instead of module constants and a manual run order (scrape → features → train), recording which settings produced each report.
- **Data checks** beyond the leakage test: unmatched odds joins, scores matching stat totals, duplicate games, and scrapes that silently drop games.

### 26. Better bookmaker-margin removal ⬜

The opening and closing probabilities split the bookmaker's margin proportionally. The **Shin** or **power** methods correct for favourite–longshot bias. This affects the with-odds model's input, every market benchmark and the betting edges.

### 27. Team-level total rating ❌

`team_total_ratings` in `features.py` (`team_total` in `features.csv`): the totals counterpart of `team_margin`, a ridge regression of each match total since 2009 on a "total tendency" per team (attack plus defence, which is all a total depends on), refitted weekly on earlier games with the team margin rating's settings (two-year half-life).

Tested with `python src/experiments.py --only team_total` (`reports/experiments_team_total.md`) in the full pipeline backtest. Total MAE, change against current:

| Added to | Linear totals (with odds / no odds) | Main ensemble totals (with odds / no odds) |
|---|---|---|
| Linear totals model (and so LightGBM) | +0.016 / +0.036 | +0.000 / +0.009 |
| LightGBM only | unchanged | −0.018 / −0.017 |

None is statistically clear; win and margin barely move. **Not adopted.** Its correlation with actual totals is only 0.17, about the same as RAPM expected points (0.15), and the two overlap. Team scoring tendencies are weak and shift with opponents, weather and referees, and the with-odds model already has the opening total. The feature stays computed but isn't used by any model.

### 28. Reserve-grade data for new players ❌

The idea: RAPM starts every new player at average, but players moving up have a reserve-grade track record.

**Data** (`python src/scrape.py --reserve` → `data/processed/reserve_player_stats.csv`): NSW Cup (competition 113) and QLD's Hostplus Cup (114), 2021–2026 (neither ran in 2020): **1,761 games, 63,266 player rows**. Match pages are on nswrl.com.au and qrl.com.au but use the same JSON and player IDs as nrl.com; **795 of 2,647 reserve-grade players also played NRL**. 2021 NSW Cup has only 71 games (season cut short by COVID lockdowns).

**Two features** (home minus away), both for named players with fewer than 10 NRL games and using only reserve games before the NRL kickoff (the leakage test now also removes later reserve games, and passes):
- `diff_reserve_newcomers`: reserve-grade fantasy points per 80 minutes relative to the position group, shrunk for few games.
- `diff_reserve_rapm_newcomers`: a reserve-grade plus-minus, the same method as the NRL RAPM (ridge on capped reserve margins, players weighted by minutes, penalty 300), with a one-year half-life, refitted before each NRL round; interchange newcomers count half. All settings were decided before testing.

**Results** (`python src/experiments.py --only reserve` → `reports/experiments_reserve.md`; full pipeline backtest, main ensembles, change against current):

| Version | Win log loss (with odds / no odds) | Margin MAE (with odds / no odds) |
|---|---|---|
| Fantasy rating, LightGBM only | +0.0002 / −0.0002 | **−0.037 / −0.034** (clear, but small) |
| Fantasy rating, linear and LightGBM | +0.0008 / +0.0007 | −0.019 / −0.021 |
| Plus-minus, LightGBM only | +0.0002 / +0.0001 | −0.010 / −0.011 |
| Plus-minus, linear and LightGBM | +0.0003 / −0.0002 | −0.005 / −0.013 |

Totals didn't change. **Not adopted:** the only clear gain (margin −0.03 to −0.04 points) is the same size as the capped-target change, too small to adopt.

**Why it didn't work:** most reserve-grade players have too few games for a strongly regularised plus-minus to separate them (the plus-minus feature's typical size is only ±0.3 points), and neither feature explains margin that RAPM, Elo and the team rating miss (correlation +0.05 for the fantasy version, −0.03 for the plus-minus). Newcomers are also a small part of each line-up, and once they've played a few NRL games RAPM takes over.

**Kept:** the scraper and data (useful later, e.g. for a Tuesday-list model, item 24), both features in `features.csv` (not used by any model; the plus-minus adds about 15 seconds to the feature build), and the experiment. The experiment added a reusable full-pipeline harness (`pipeline_backtest` in `experiments.py`), which reruns the whole backtest with any `train.py` setting changed, in seconds.

### 29. Roster turnover between seasons ⬜

The share of last season's minutes that has left the club. RAPM follows individual players, but Elo and the team rating don't see off-season signings.

### 30. Predicting late changes ⬜

The chance each Tuesday-named player actually plays, from history (reserves, players returning from injury). Needed for the Tuesday-list model (item 24).

### 31. Bayesian hierarchical model ⬜

Team strength changing over time plus player effects with partial pooling, in one model (PyMC or Stan) instead of separate ridge regressions. It gives uncertainty for each prediction and handles new players and small samples in a principled way. The biggest lift on this list.

### 32. Features from opening-market disagreement ⬜

For example, the margin implied by the head-to-head price against the opening line, or the opening total against the model's total. All are known at the open. Also: a small draw probability (6 draws in 2021–2025 were dropped), since a draw loses a head-to-head bet.

### 33. Betting practice ⬜

- **Fractional Kelly staking** instead of flat stakes, with bankroll and drawdown tracking, and accounting for related bets on the same game.
- **Closing line value as the main measure,** plus a **paper-trading season**: log predictions and prices every week from now on. That's the only fully clean test of real betting value.
- **Betfair Exchange prices** usually have lower margins than bookmakers, and timestamped history helps item 6.

### 34. Third review: wrong scores in the scraped data ✅ (fixed)

Six games have missing or incorrect scores in the nrl.com data; the odds sheet has the correct results:

| Game | Scraped (nrl.com) | Actual (odds sheet) |
|---|---|---|
| 2020 R8 Titans v Sharks | 0–0 | 10–40 |
| 2021 R2 Bulldogs v Panthers | 0–26 | 0–28 |
| 2021 R4 Sea Eagles v Panthers | 6–42 | 6–46 |
| 2021 R7 Storm v Warriors | 0–0 | 42–20 |
| 2021 R13 Knights v Eels | 0–0 | 4–40 |
| 2021 R19 Cowboys v Storm | 0–0 | 16–20 |

- The four 0–0 games are treated as **draws** and dropped from training. They're also 4 of the 6 "draws" quoted in item 32, so real draws are rarer.
- RAPM learns from them as if they were level, and the team form and points stats are wrong for them. The two other games slightly distort the margin and total targets.
- Elo is unaffected (it uses the odds sheet's results). The effect is probably small (6 of about 1,400 games), but it's a correctness bug.

**Fixed** (`repair_scraped_games` in `features.py`, run on every load and printing each correction):
- The 6 scores are corrected from the odds sheet, in the match and in the team stats' points; 3 fake draws become usable training games (real draws in 2021–2025: 3, not 6).
- Games with no team stats recorded keep them missing instead of zero, and the form averages skip them.
- 5 games with no player minutes recorded (the 4 above plus 2021 R18 Warriors v Panthers) get typical minutes for each named role (starters 70, interchange 32), so their players count in RAPM and the game history.

Effect on the backtest: the linear models barely changed (no-odds linear 0.6279 → 0.6275; with-odds linear unchanged at 0.6243). LightGBM moved by up to ±0.006 in opposite directions for the two variants (with-odds 0.6340 → 0.6397, no-odds 0.6405 → 0.6375), and the main ensembles with it (with-odds 0.6251 → 0.6280, no-odds 0.6302 → 0.6281). That's LightGBM's tuning landing on different settings after a tiny data change, not the fix itself, and it's why LightGBM's stability is now the next priority (item 4).

### 35. Third review: the with-odds model's opening-odds source changes ✅ (adopted)

The opening prices come from **bet365 until April 2024 and BlueBet after**, and they behave in opposite ways: bet365's opening prices were **under-confident** (calibration slope 1.23 in 2021–24: favourites won even more often than priced), BlueBet's **over-confident** (0.77 in 2024–25). The with-odds model learned from mostly bet365 seasons to stretch the opening price, then applied that to BlueBet's already-extreme prices, which made it overconfident (item 23). The **2026 test is entirely BlueBet.**

**Adopted:** the with-odds models get a **BlueBet indicator** and the **opening log-odds × BlueBet** (`bluebet`, `open_logit_bluebet` in the `odds` feature group), so they can weight BlueBet's opening prices differently. The linear **totals** model doesn't get them (they made totals worse: 10.72 → 10.78), via `linear_odds` in `models.py`; LightGBM shares one feature list across targets and keeps them (its totals barely moved).

Results (full pipeline backtest, `python src/experiments.py --only calibration`):
- **2025 calibration fixed:** with-odds ensemble slope 0.86 → **1.01**. 2024 is unchanged (0.81), as its model was trained before any BlueBet data existed.
- With-odds ensemble win 0.6230 → **0.6220** (2025 alone −0.003, not clear); with-odds linear 0.6223 → 0.6209 (2025 −0.004); margins −0.01 to 0; totals unchanged. No-odds models unaffected.
- The gain isn't statistically clear in the backtest, but it corrects a measured problem and should matter more for 2026, whose model trains on about 1.7 seasons of BlueBet prices instead of 0.7.

### 36. Third review: make the final run auditable ✅

- `--final` now runs exactly the backtest procedure for 2026 (`models.backtest`: develop on 2021–2025, predict 2026) instead of the dev run's settings, which were tuned on 2022–2024 only.
- It refuses to run with uncommitted changes.
- It writes the commit, the `features.csv` SHA-256, every setting and the developed configuration to `reports/final_2026_run.json`, and the commit into `final_2026.md` and `final.lock`.
- Run once at commit `c43c38e` (results under "Where things stand").

### 37. Third review: code structure ✅

Done; every prediction is unchanged (backtest predictions, `params.json` and the betting report identical before and after).
- ✅ **`train.py` split** into:
  - `config.py`: every setting in one place. Functions read settings when they run, so the command-line flags and `config.override(...)` (used by the experiments) change them in one place; this also fixes the earlier issue of flags overwriting variables across modules.
  - `models.py`: data and folds, linear models, LightGBM, calibration, `develop`, `fit_predict`, and the shared backtest.
  - `evaluate.py`: metrics, benchmarks, bootstrap, feature importance.
  - `reports.py`: Markdown tables and saved predictions.
  - `train.py`: just the dev, backtest and final runs and the command line.
- ✅ **One shared backtest:** `models.backtest()` is used by `train.py --backtest`, `experiments.py` (`pipeline_backtest`) and `betting.py`, which no longer reimplements the linear backtest (it uses `models.margin_total_sigma` for the line/total spread). `experiments.run_linear` remains only for the historical linear-only experiments.
- ✅ **Regenerable outputs no longer committed:** `data/processed/features.csv` and `reports/*.csv` are in `.gitignore` (rebuild with `python src/features.py`, `python src/train.py [--backtest]`, `python src/betting.py`). The scraped tables, odds sheet, `params.json`, `elo_params.json` and the Markdown reports stay committed.
- ✅ **Fast unit tests** (`tests/test_units.py`, 12 tests, about 3 seconds): odds margin removal, the odds join, score repair, travel helpers, Elo updates, walk-forward folds, the margin blend, BlueBet inputs kept out of totals, LightGBM features, `config.override`, the bootstrap and `md_table`. The leakage test is marked `slow`: `python -m pytest -m "not slow"` runs only the fast tests.
- ✅ **Unused features no longer built by default.** The tested-but-unused features (reserve-grade ratings, team total, kickoff slot, travel, ladder, Origin representatives, other star formulas, key-position and impact absences) are only built with `python src/features.py --experimental`; experiments that need them say so. The default build produces exactly the same core features as before (78 columns) in about **1 minute** instead of 2¼, and the full test suite including the leakage test runs in about **3½ minutes** instead of 9. The experimental build reproduces all 103 columns identically.

### 38. Star players ✅ (S2 adopted)

**Question:** do teams play measurably differently with and without their stars, and does the model account for it?

**Analysis** (seasons up to 2025; each player's games at a club with vs without him, team margin relative to an expectation; `reports/experiments_stars.md`, `experiments_key_absence.md`, `experiments_origin_stars.md`):

| Group | Games without | vs line-up-blind team rating | vs opening line | vs current model (2023–25) |
|---|---|---|---|---|
| A reference list of 20 stars (Cleary, Tedesco, Hynes, Ponga, Hughes, Haas, Trbojevic, Munster, Edwards, Crichton, Yeo, Grant, Walsh, To'o, Mitchell, Fonua-Blake, Walker, S Johnson, H Young, Luai) | 578 | **+6.9** [+5.4, +8.5] | +5.0 | **+3.8** [+1.8, +5.8] |
| … spine players | 442 | +6.9 | +5.1 | **+3.9** |
| All Origin-selected players (in their Origin year) | 1,185 | **+4.2** [+3.0, +5.4] | +3.4 | **+2.9** [+1.4, +4.5] |
| … Origin spine players | 411 | +5.5 | +4.2 | **+4.3** |
| … Origin forwards | 526 | +2.8 | +2.3 | +1.8 (not clear) |

Teams score several points more with their stars, and **both the model and the opening market under-react to a star's absence by about 3–4 points**, most for spine players. Individual effects vary widely: Luai +17, Crichton (Panthers) +16, Yeo +15, Walsh +14, Hughes, Cleary and Trbojevic +11; no effect for Haas, Tedesco, Hynes, S Johnson and Ponga. The reference list was chosen with hindsight, which biases its numbers upwards; the Origin rows are an objective check.

**Star formulas tested** (general rules, no names, information before each game only; full pipeline backtest, main ensembles, win log loss with odds / no odds):

| Formula | Star = | Result |
|---|---|---|
| Stats-based | top 10% of position for fantasy points per 80 minutes | no effect |
| Impact (RAPM) | top 10% plus-minus | picks whole rosters of top teams; −0.002 / −0.001, not clear |
| V1–V3 key positions | missing usual fullback / halfback / five-eighth / hooker, weighted by form percentile | −0.001 to −0.002, not clear |
| V4 learned impact | each player's own with/without history, shrunk | no effect (too few absences to learn from) |
| S1 Origin stars | in an Origin 17 in the last 12 months | −0.0012 / −0.0007, not clear |
| **S2 Origin or elite form** | **S1, or top 10% of position for form** | **−0.0015 (clear) / −0.0013; margin −0.02** |

How well the general rules recognise the reference list: S1 counts 58% of their games (10% of other players' games), S2 67% (18%). Origin selection is by far the best detector; fantasy stats rated Walsh as average. S2 also partly covers players not eligible for Origin (Hughes, S Johnson, Fonua-Blake).

**Adopted: S2** (`STAR_ABSENCES` in `config.py`: `diff_s2_stars_out_spine`, `diff_s2_stars_out_other`, in the win and margin models and so LightGBM's compact set). Each counts the team's usual players (named in 3 of the last 5 games) who are missing from the named 17 and were in an Origin 17 in the last 12 months or are in the top 10% of their position group for form, split into spine and other positions. The gain is concentrated where it should be: the 63% of games with a star missing (win −0.0022, clear) with nothing in the others. Full backtest: with-odds ensemble 0.6245 → **0.6230**, no-odds ensemble 0.6279 → 0.6266, margins −0.02. It's a small gain overall (a few points in some games barely moves average log loss), and it was the best of about eight star variants, so part of it may be luck; it was adopted because it addresses a measured blind spot. All the other star features stay computed in `features.csv` but unused.

## Lessons from Levon Rush's Footy Tipper (items 39–44)

[Footy Tipper](https://github.com/levonrush/footy-tipper) is a public NRL tipping model (documentation on GitHub, with a Medium series). Its design and ours are close, and on 2024–2026 so are the results:

| 2024–2026 | Games | Log loss | Brier | Tips correct | Margin MAE |
|---|---|---|---|---|---|
| Footy Tipper | 587 | 0.6395 | 0.224 | 63.8% | 14.34 |
| Ours, with-odds ensemble | 637 | 0.6385 | 0.223 | 64.5% | 14.15 |
| Ours, no-odds ensemble | 637 | 0.6415 | 0.225 | 63.0% | 14.24 |
| Market average | 637 | 0.6458 | 0.226 | 62.3% | – |

(Not quite the same games: his 2026 is partial. Level within noise.)

| | Footy Tipper | Ours |
|---|---|---|
| Odds | Never model inputs; the market is a separate expert in the blend (and gets zero weight on current data) | With-odds models (opening odds as inputs) and no-odds models (none) |
| Combining | Learned weights per season, non-negative and summing to 1 | Fixed 50/50 average of linear and LightGBM |
| Models | Elo-style rating; LightGBM home and away score models; LightGBM winner model | Elo, team rating and RAPM as features; linear and LightGBM for win, margin and total |
| Margin removal | Shin | Proportional |
| Team lists | Snapshot from 24 hours before kickoff | Final named 17 |
| Testing | Hold out each season | Walk-forward per season, an untouched final season, bootstrap intervals |
| Leakage | Found ladder and crowd leaks by hand | Automated leakage test |
| Betting | Expected value, Kelly sizing, tipping-comp strategy | Flat stakes, closing line value |
| Operations | Weekly automated predictions, emails, versioned models | Run by hand; no weekly prediction script yet |

### 39. No odds in the models; the market as a separate expert in a learned blend ❌

`python src/experiments.py --only blend`, `reports/experiments_blend.md`.

**Setup.**
- **Experts:** the no-odds models (linear win; the linear margin turned into a win probability; LightGBM win; Elo) and, separately, the opening market (log-odds, proportional margin removal; the opening line and total for margin and total). No odds go into any model.
- **Fitting:** for each backtest season, every expert's walk-forward out-of-sample predictions for 2022 to the season before (each season predicted by models trained on earlier seasons, with that backtest season's settings) are used to fit the blend.
  - Win: p = sigmoid(a + Σ wᵢ·expertᵢ) with wᵢ ≥ 0, fitted by log loss. This is the same as weights summing to 1 followed by Platt calibration.
  - Margin and total: intercept plus non-negative weights summing to 1, least squares.
- **One-weight blend:** also tested the simplest version, the current calibrated no-odds ensemble and the opening market averaged on the log-odds scale, with the weight chosen on earlier backtest seasons (2024–25 only).

**Results (631 games, win log loss; lower is better):**

| | Win log loss | Margin MAE | Total MAE | Head-to-head ROI at opening (2% edge) |
|---|---|---|---|---|
| **Current with-odds ensemble** | **0.6220** | **13.49** | 10.78 | **+16.0%** (372 bets) |
| Current no-odds ensemble | 0.6266 | 13.52 | 10.83 | +12.2% (431 bets) |
| Blend: no-odds models + market | 0.6300 | 13.53 | **10.76** | +7.9% (396 bets) |
| Blend: no-odds linear + LightGBM + market | 0.6302 | 13.53 | 10.76 | +7.2% (378 bets) |
| Blend: no-odds models only | 0.6301 | 13.54 | 10.88 | +12.1% (447 bets) |
| Market opening | 0.6331 | 13.66 | 10.84 | – |
| Market average (closing) | 0.6204 | – | – | – |

- **Win probability: clearly worse.** The blend with the market is +0.008 against the current with-odds ensemble (95% interval +0.002 to +0.014). It isn't better than the no-odds ensemble either (+0.0035, not clear).
- **The one-weight blend is also worse:** 0.6376 against the with-odds ensemble's 0.6319 on 2024–25 (+0.006, interval −0.001 to +0.012; market weight 0.65 for 2024, 0.5 for 2025). Even with the best single weight chosen in hindsight (0.3–0.4), it scores 0.6241 on 2023–25, against 0.6220.
- **Unlike Footy Tipper, the market gets substantial weight:** 17% (2023), 45% (2024) and 40% (2025) for the win, 9–38% for the margin and 53–63% for the total. On our data the opening market is a strong expert, not a redundant one.
- **Margin and total:** no clear difference (the blend's totals are 0.015 better than the with-odds ensemble; not clear).
- **Betting:** the blends with the market make fewer and less profitable head-to-head bets (+7–8% ROI against +16%). Closing line value is the same for every version (about 0.047, with the price moving towards the bet about 70% of the time).
- **Why the market works better as an input than as an expert:** in the with-odds model, the other features' coefficients are learned *given* the market price, so they learn what the market misses: mainly team news after the opening price (star absences, line-up changes). In a blend, each no-odds expert also re-learns what the market already knows, and the blend can only reweight whole experts. Footy Tipper's concern was double-counting the market when a model that already contains the odds is blended with the market again, but we don't do that: the market enters once.
- **Learned weights vs the fixed 50/50:** the no-odds-only blend (0.6301) is also worse than the current no-odds ensemble (0.6266). The current ensemble's per-model Platt calibration plus margin blend beats learning five weights from 2–4 seasons of out-of-sample predictions.

**Verdict:** not adopted. Keep the odds as inputs to the with-odds models and the fixed 50/50 ensemble.

### 40. Team lists as they stood before betting ⬜

Footy Tipper trains on the team list as it stood 24 hours before kickoff. We use the final named 17, which can include late changes the opening price never saw, so the 2026 head-to-head betting edge (which comes from team news) is an upper bound. Historical Tuesday lists can't be recovered after the fact (nrl.com overwrites them), so: start saving each round's Tuesday list and Tuesday-evening prices now, build `predict.py` around them (item 24), and re-evaluate the betting edge on those snapshots from 2027 (with paper trading, item 33).

### 41. Disagreement analysis ⬜

List the games where the model differs most from the market (backtest and 2026), check who was right, and which features drove the difference (e.g. star absences, line-up changes, Elo). It's cheap and shows where the edge really comes from, and whether it's concentrated in a few kinds of games worth betting.

### 42. Shin margin removal ⬜

Already item 26. Footy Tipper uses the Shin method; test it for both the with-odds models' input and the market benchmarks.

### 43. Bet sizing ⬜

Add fractional Kelly staking (e.g. a quarter of Kelly, capped) to `betting.py` alongside flat stakes, reporting growth, drawdown and the chance of ruin. Only relevant once the edge is confirmed on pre-betting team lists (item 40).

### 44. Lower priority from Footy Tipper ⬜

- **Separate home-score and away-score models:** mathematically equivalent to our margin and total models; no expected gain.
- **Simulating possible line-ups** to average over late changes: Footy Tipper's elaborate simulator didn't beat a simple normal approximation of the margin.
- **Tipping-comp metrics** (chance of beating a field of favourite-tippers): only if the goal becomes a pub tipping comp.
- **Weekly automation:** scheduled predictions, versioned models and alerts, once `predict.py` exists.

---

## Suggested next steps

The 2026 final test is done, so 2026 is no longer an untouched test season: judge new ideas on the 2023–25 backtest and report 2026 only as extra information. The next honest test is 2027.

1. **`predict.py` with Tuesday team-list snapshots, and pinned requirements** (items 24, 25, 40): without them the model can't be used, and the betting edge can't be tested on information available when betting.
2. **Paper trading** through 2027 (item 33), with bet sizing (item 43).
3. **Cheap analyses:** disagreement analysis (item 41) and Shin margin removal (items 26, 42).
4. Bigger projects when there's time: the Bayesian model (31) and nested tuning (21).
