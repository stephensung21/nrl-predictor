# NRL Predictor: Improvement Plan

The goal is to beat the bookmakers' closing odds.

## Where things stand

The main yardstick is now the **2023–2025 backtest** (`python src/train.py --backtest`). For each season, the whole development procedure is rerun on earlier seasons only, then that season is predicted: 631 out-of-sample games in total. A single dev season (212 games) proved too noisy to judge by. 2025 alone once suggested Model B beat the market, and the backtest showed that was luck.

**Main model: Model A linear** (logistic / ridge with the opening odds as inputs). It's the best on win probability and totals, and the simplest. The ensemble is still reported for comparison, but since the linear model improved it no longer adds anything.

Pooled backtest results for the current setup:

| | Win log loss | Margin MAE | Total MAE |
|---|---|---|---|
| **Model A linear** (main model) | **0.624** | 13.59 | **10.73** |
| Model A ensemble | 0.625 | **13.59** | 10.80 |
| Model B linear (no odds) | 0.628 | 13.61 | 10.80 |
| Model B ensemble | 0.630 | 13.61 | 10.84 |
| Model A LightGBM | 0.634 | 13.86 | 10.95 |
| Market closing (Odds Portal average) | 0.620 | – | 10.72 |
| Market opening | 0.633 | 13.66 | 10.84 |
| Elo only | 0.638 | – | – |

- **Win probability:** Model A linear is 0.004 behind the market average (95% interval −0.008 to +0.016), down from +0.024 at the start of the backtest work. By season it was behind in 2023 (0.595 vs 0.576) and slightly ahead in 2024 (0.631 vs 0.636) and 2025 (0.647 vs 0.648). Against real closing odds (271 reliable games, mostly 2023) it's still clearly behind (0.604 vs 0.588). It beats the opening market and Elo.
- **Margin:** the models beat the opening line on average error, but not on line-cover probability (item 14).
- **Totals:** Model A linear is level with the closing total and beats the opening total.
- **Caveat:** the backtest has now informed many decisions (fixed feature sets, the rain flag, the adopted combination), so these numbers are somewhat optimistic. The 2026 `--final` run is the honest verdict.

2026 stays untouched until `python src/train.py --final`. Settings for that run come from the dev run (`reports/params.json`).

**Status:** ✅ done · 🔶 partly done · ⬜ not started · ❌ tried, didn't help

---

## 1. Feature selection ✅ (replaced by fixed sets)

Forward selection inside walk-forward CV was built first, then made stricter: a feature had to improve every CV season. The backtest showed it was **unstable and overfit**. With only 1–2 CV seasons for the earlier backtest years, it picked 8–9 features that changed every season.

It's now replaced by **fixed feature sets** (`LINEAR_FEATURES` in `train.py`), built from the features chosen consistently across backtest seasons:
- win and margin: Elo, RAPM total, RAPM defence, RAPM compared with usual line-ups;
- totals: RAPM expected points, Origin period, wet conditions.

Model A adds the opening odds. LightGBM uses the full feature set. Forward selection is still available with `--select`. Fixed sets improved the backtest: Model B linear went from 0.645 to 0.634, and its total MAE from 11.05 to 10.88.

## 2. Team-news features ✅

- **Named 17 instead of "players with minutes > 0".** The old definition leaked post-match information; the leakage test now scrambles minutes played and goal-kicking.
- Added usual players missing (count and rating), new players by position group, experienced players returning, and goal-kicker missing. Captain changes weren't possible, because the data has no captain field.
- None are in the fixed linear sets. LightGBM uses them.

## 3. Better player ratings (RAPM) ✅

Regularised plus-minus: each player is rated by how the team's margin changes with them in the named 17. It's a ridge regression over earlier games, refitted before every round (penalty 300, 90-day half-life, chosen on 2022–24 CV). **RAPM total is the strongest single feature** and was picked first in every backtest season.

## 4. Drop or constrain LightGBM ⬜ (on hold, probably not needed)

The case for this came from 2025 alone. In the backtest, LightGBM beat the linear model in some seasons, and the **ensembles were the most robust models**. Leave it as it is.

## 5. More seasons of data ✅

The scraper now covers 2020–2026. Scraped games are used **from the six-again restart on 28 May 2020** (`SIX_AGAIN_START`); rounds 1–2 of 2020 were played under the old rules. Elo still uses every result since 2009.

- **2020 as history** (ratings, form, experience) is the default. It's neutral in the backtest, but it makes the 2021 features correct and adds 40 usable 2021 games.
- **2020 as training rows** (`--train-from 2020`) was slightly worse, probably because of COVID conditions.
- No earlier seasons: before the six-again rule, the stats mean different things.

## 6. When bets would be placed ⬜

Team lists are named on Tuesday, but prices keep moving until kickoff. The models beat the **opening** market, so the realistic edge is betting early, after team lists, before prices adjust. Measuring that needs **mid-week odds**, which the current odds sheet doesn't have.

Note: the wet-conditions flag assumes predictions just before kickoff. For early-week bets it would need a weather forecast instead.

## 7. Test whether the edge is real 🔶

- ✅ A **paired bootstrap** against the market average, opening odds and Elo is built into the backtest report.
- ⬜ **Betting simulation:** bet when the model's edge over the price exceeds a threshold, and track profit and ROI. Most worth testing against opening prices, on margin and win probability.

## 8. Context features ✅

Added short turnaround, game after a bye, Origin period, players backing up from Origin, and usual players missing for Origin. `scrape.py` fetches the State of Origin games. Only `origin_period` is in a fixed linear set (totals); the rest are LightGBM only.

## 9. Evaluate over more seasons ✅

The `--backtest` mode, described above.

## 10. Improve RAPM ✅

- ✅ **Bench weighting:** past games weight players by minutes, and predictions use the typical minutes for each player's named role. It improved CV.
- ✅ **Attack/defence split:** fitted as separate margin and total regressions (equivalent to one attack/defence model, but much faster). It gives RAPM defence (in the fixed win set) and RAPM expected points (in the fixed totals set).
- ❌ **Stats-based prior** (fantasy points): worse on CV. It's off, but available as `RAPM_STATS_PRIOR`.
- The RAPM changes improved CV but didn't move the backtest much on their own.

## 11. Unused match data and other markets 🔶

- ✅ **Wet conditions** (rain, or a slippery/wet/heavy/muddy ground): cut total MAE by about 0.09 (Model A linear 10.82 → 10.73). It's recorded on the day, so it assumes betting near kickoff.
- ❌ **Referee records** (shrunk total points and penalties): no signal.
- ⬜ **Line and total markets:** the models beat the opening line and opening total, so these markets may offer more edge than head-to-head. Closing lines are missing for most of 2024–25, so the comparison needs 2026 or another odds source.

## 12. Fix the ensemble ❌

Tested (experiment 5): averaging in logit space, stacking learned on earlier seasons, and stacking all four models were all no better than the plain average (+0.0002 to +0.002). Since the linear model improved (item 22), the ensemble no longer beats the linear model on its own, so Model A linear is now the main model.

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

---

## Code review findings

1. **The backtest is no longer a fully independent test.** The fixed linear feature sets came from which features the backtest's selection kept choosing, and the rain flag was kept after seeing the backtest's totals results. The RAPM settings were also tuned on 2022–24 CV, which overlaps the backtest. The backtest numbers are therefore somewhat optimistic, and **the 2026 `--final` run is the only fully clean test left**. Treat the current setup as close to frozen: a new idea should beat it by a clear margin before it's adopted.
2. **Several "already tried" rejections were judged on 2025 only**, and with the old features: win probability from the margin, the market as a fixed starting point, recency weighting, and Elo retuning. 2025 has proved too noisy, so these should be rerun on the backtest (item 13).
3. **Margin and total are scored by average error, but betting needs probabilities.** A line bet needs P(home covers −4.5), which depends on the spread of possible margins as well as the prediction. There's no probabilistic margin or total model yet, and no line-cover or over/under metric (item 14).
4. **Form stats aren't opponent-adjusted.** Raw averages treat yardage against a strong defence the same as against a weak one, which is likely why the form features never help (item 17).
5. Smaller code points:
   - **Attack/defence mixes capped and uncapped targets.** The RAPM margin target is capped at 40 but the total target isn't, so the "exactly equivalent" claim in the `rapm_features` docstring is only approximate. Either cap the total too or adjust the docstring.
   - **The ensemble is a plain 50/50 average of probabilities.** Averaging in logit space or weighting by out-of-fold performance is standard (item 12).
   - **`--select` and `--train-from` overwrite module-level variables in `__main__`.** Scripts that import `train` silently get the defaults; passing them as arguments would be safer.
   - **Stale text in `train.py`:** the `walk_forward` docstring says "from 2021", the comment above `LINEAR_FEATURES` overruns its line, and the module docstring still describes selection as part of the procedure.

---

## Further approaches (items 13–22)

### 13. Rerun the 2025-only rejections on the backtest ✅

Results are in `reports/experiments.md` (`python src/experiments.py`):
- **Win probability from the predicted margin: reversed.** On its own it was −0.005 for Model A; blended with the logistic model −0.005 [−0.010, +0.0005]. That's a near miss, adopted as part of item 22.
- ❌ Market as a fixed starting point with learned adjustments: −0.0003, no difference.
- ❌ Recency weighting (half-life 1 or 2 seasons): −0.002 to +0.001, no difference.
- ❌ Elo retuned inside each backtest year (2013+ or the six-again era 2020+): slightly **worse** (Model B +0.001 to +0.003). Keep the current Elo settings.

### 14. Probabilistic margin and total model 🔶

Tested in `experiments.py`: a Normal or t distribution around the linear prediction, with constant spread or spread depending on mismatch and wet conditions, scored on covering the opening line and going over the opening total. The market is 50% by construction; break-even at $1.91 is 52.4%.
- **Line: no edge.** Model A log loss −0.0007 vs a coin flip; hit rate 53.1%, and 53.8% when over 55% sure.
- **Totals: the most promising signal so far.** Model A hit rate 54.5%, and **57.1% on the 308 games where it's over 55% sure**, about 1.7 standard errors above break-even. Not conclusive, and it relies on the rain flag (betting near kickoff).
- Varying the spread or using a t-distribution made no difference.

Next: the betting simulation on totals against the opening total (item 7).

### 15. Team-level margin rating ✅

`team_ratings` in `features.py`: a ridge regression of capped margins since 2009 on team strengths, a league home advantage and each team's own home advantage (shrunk), refitted weekly with a two-year half-life (the setting chosen inside every backtest year). Adding it to the win model: −0.004 [−0.008, +0.0002] for Model A, a near miss, adopted as part of item 22. Using it instead of Elo was about the same, so both are kept.

### 16. Team-specific home advantage ❌

Each team's own home advantage as a separate feature added nothing beyond the team margin rating (which already includes it): −0.002 for Model A, within noise.

### 17. Opponent-adjusted form ❌

Each team's recent stats relative to what its opponents usually allow (and concede). A single adjusted net-points feature made no difference; the full adjusted block made margin clearly **worse** (+0.16 and +0.25 MAE). Form stats, adjusted or not, don't add to RAPM and Elo.

### 18. More context features ⬜

- **Ladder and motivation:** finals place already decided or out of reach, late-season dead rubbers. Known before kickoff, and possibly underweighted by the market.
- **Combination continuity:** games the halves pairing and the spine have played together, not just how many changes there were.
- **Workload and fatigue:** key players' minutes over the last 2–3 weeks, including Origin minutes.
- **Kickoff slot and distance:** day or night, Thursday short weeks, and travel distance or time zone instead of an interstate flag.

### 19. Position-specific player ratings from stats ⬜

Ratings built from the stats that matter for each position (run metres for forwards, kicking and try involvement for halves), as a steadier signal than RAPM for players with few games. Fantasy points were a poor proxy.

### 20. Other model types ⬜

A GAM or Explainable Boosting Machine: smooth non-linear effects with strong regularisation, sitting between the linear models and LightGBM in flexibility, which suits small data.

### 21. Nested tuning in the backtest ⬜

Re-choose the RAPM settings (and any other feature settings) inside each backtest year, so the backtest stays an honest out-of-sample test.

### 22. Team margin rating + margin-blended win probability ✅ (adopted)

The two near misses (items 13 and 15) tested together: `team_margin` in the linear win model, and the calibrated logistic probability averaged with Φ(predicted margin / σ) from the linear margin model (`MARGIN_BLEND` in `train.py`).
- Linear harness: Model A −0.006 [−0.013, −0.0002], just clear; Model B −0.005 [−0.012, +0.0005].
- Full backtest: Model A linear 0.631 → **0.624**, Model A ensemble 0.628 → 0.625, Model B linear 0.633 → 0.628.
- This combination was chosen after seeing the individual results, out of about 50 comparisons, so part of the gain may be chance. Both parts point the same way independently and the idea is principled (margins carry more information than win/loss), which is why it was adopted.

---

## Suggested next steps

1. **Betting simulation on totals against the opening total** (items 7 and 14): the most promising edge so far.
2. **Mid-week odds** (item 6), to test the realistic betting window for early bets.
3. **More context features** (item 18) and **position-specific stat ratings** (item 19), each needing a clear backtest gain.
4. **Nested tuning in the backtest** (item 21), to make the backtest honest again before relying on it further.

When development is finished, run the one-time **`--final` test on 2026**, with Model A linear as the main model.
