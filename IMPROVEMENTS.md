# NRL Predictor: Improvement Plan

The goal is to beat the bookmakers' closing odds.

## Where things stand

The main yardstick is now the **2023–2025 backtest** (`python src/train.py --backtest`). For each season, the whole development procedure is rerun on earlier seasons only, then that season is predicted: 631 out-of-sample games in total. A single dev season (212 games) proved too noisy to judge by. 2025 alone once suggested Model B beat the market, and the backtest showed that was luck.

Pooled backtest results for the current setup:

| | Win log loss | Margin MAE | Total MAE |
|---|---|---|---|
| **Model A ensemble** (with opening odds) | **0.628** | **13.58** | 10.80 |
| Model A linear | 0.631 | 13.59 | **10.73** |
| Model B ensemble (no odds) | 0.631 | 13.63 | 10.85 |
| Model B linear | 0.633 | 13.61 | 10.80 |
| Market closing (Odds Portal average) | 0.620 | – | 10.72 |
| Market opening | 0.633 | 13.66 | 10.84 |
| Elo only | 0.638 | – | – |

- **Win probability:** Model A ensemble is 0.008 behind the market average (95% interval −0.007 to +0.023). That's not conclusive, but the market is probably still slightly better. It beats the opening market and Elo.
- **Margin:** the models beat the opening line.
- **Totals:** Model A linear is level with the closing total and beats the opening total.
- Over this work, the gap to the market on win probability narrowed from about +0.024 to +0.008.

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

## 12. Fix the ensemble ⬜

Weight the linear and LightGBM models by backtest performance, or stack them, instead of a plain average.

---

## Already tried, didn't help

| Idea | Result |
|---|---|
| Win probability from the predicted margin (`Φ(margin / σ)`) | 0.653 at best on 2025 |
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

## Approaches not yet tested

### 13. Rerun the 2025-only rejections on the backtest ⬜

Win probability from the predicted margin (blended with the logistic model), the market as a fixed starting point with learned adjustments, recency weighting, and Elo retuned on the six-again era. All are cheap, and with the current features some may now help.

### 14. Probabilistic margin and total model ⬜

Predict the **spread** of possible margins and totals as well as the mean (e.g. a Normal or t distribution whose spread depends on the mismatch and wet conditions). This gives P(cover line) and P(over total), which can be scored against the actual line and total outcomes (cover rate, log loss) and used directly for betting. It's probably the most valuable next model, since the backtest suggests the line and total markets may be where the edge is.

### 15. Team-level margin rating ⬜

A team rating built directly on margins, such as a Kalman filter or an exponentially weighted ridge rating with separate attack and defence, either alongside Elo or replacing it. Elo here only uses win/loss with a margin multiplier, and margins carry more information.

### 16. Team-specific and venue-specific home advantage ⬜

Elo uses one home advantage for every team. A per-team or per-venue home advantage, shrunk towards the league average, could capture grounds that are much harder to win at.

### 17. Opponent-adjusted form ⬜

Express each team's recent stats relative to what its opponents usually allow (and concede), turning the form block into measures of strength.

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

---

## Suggested next steps

1. **Rerun the 2025-only rejections on the backtest** (item 13): cheap, and they might reverse.
2. **Probabilistic margin and total model** with line and total metrics (item 14), then the **betting simulation against opening prices** (item 7).
3. **Team-level margin rating** and **team-specific home advantage** (items 15–16).
4. **Opponent-adjusted form** (item 17).
5. **Stacked or weighted ensemble** (item 12).
6. **Mid-week odds** (item 6), to test the realistic betting window.

Each should beat the current setup clearly on the backtest before it's adopted. When development is finished, run the one-time **`--final` test on 2026**.
