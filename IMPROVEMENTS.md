# NRL Predictor: Improvement Plan

The goal is to beat the bookmakers' closing odds.

## Where things stand

The main yardstick is now the **2023–2025 backtest** (`python src/train.py --backtest`). For each season, the whole development procedure is rerun on earlier seasons only, then that season is predicted: 631 out-of-sample games in total. A single dev season (212 games) proved too noisy to judge by. 2025 alone once suggested the no-odds model beat the market, and the backtest showed that was luck.

**Main models: the ensemble for both variants** (`MAIN_MODEL` in `train.py`): with-odds ensemble and no-odds ensemble, each the 50/50 average of the linear model and LightGBM. On the pooled backtest the with-odds ensemble ties with with-odds linear (0.625 vs 0.624; difference +0.0007, 95% interval −0.006 to +0.008), but it won 2 of the 3 seasons (2024 and 2025), so it's the more robust choice. All model types are still fitted and reported.

Pooled backtest results for the current setup:

| | Win log loss | Margin MAE | Total MAE |
|---|---|---|---|
| **With-odds ensemble** (main model) | 0.625 | **13.59** | 10.80 |
| With-odds linear | **0.624** | 13.59 | **10.73** |
| **No-odds ensemble** (main model) | 0.630 | 13.61 | 10.84 |
| No-odds linear | 0.628 | 13.61 | 10.80 |
| With-odds LightGBM | 0.634 | 13.86 | 10.95 |
| Market closing (Odds Portal average) | 0.620 | – | 10.72 |
| Market opening | 0.633 | 13.66 | 10.84 |
| Elo only | 0.638 | – | – |

- **Win probability:** with-odds linear is 0.004 behind the market average (95% interval −0.008 to +0.016), down from +0.024 at the start of the backtest work. By season it was behind in 2023 (0.595 vs 0.576) and slightly ahead in 2024 (0.631 vs 0.636) and 2025 (0.647 vs 0.648). Against real closing odds (271 reliable games, mostly 2023) it's still clearly behind (0.604 vs 0.588). It beats the opening market and Elo.
- **Margin:** the models beat the opening line on average error, but not on line-cover probability (item 14).
- **Totals:** with-odds linear is level with the closing total and beats the opening total.
- **Betting:** no bettable edge shown yet. Against opening prices, head-to-head bets made +11–12% ROI, but almost all of it comes from team news the opening price doesn't yet reflect, and every market loses at closing prices (item 7).
- **Caveat:** the backtest has now informed many decisions (fixed feature sets, the rain flag, the adopted combination), so these numbers are somewhat optimistic. The 2026 `--final` run is the honest verdict.

2026 stays untouched until `python src/train.py --final`. Settings for that run come from the dev run (`reports/params.json`).

**Status:** ✅ done · 🔶 partly done · ⬜ not started · ❌ tried, didn't help

---

## 1. Feature selection ✅ (replaced by fixed sets)

Forward selection inside walk-forward CV was built first, then made stricter: a feature had to improve every CV season. The backtest showed it was **unstable and overfit**. With only 1–2 CV seasons for the earlier backtest years, it picked 8–9 features that changed every season.

It's now replaced by **fixed feature sets** (`LINEAR_FEATURES` in `train.py`), built from the features chosen consistently across backtest seasons:
- win and margin: Elo, RAPM total, RAPM defence, RAPM compared with usual line-ups;
- totals: RAPM expected points, Origin period, wet conditions.

The with-odds model adds the opening odds. LightGBM uses the full feature set. Forward selection is still available with `--select`. Fixed sets improved the backtest: no-odds linear went from 0.645 to 0.634, and its total MAE from 11.05 to 10.88.

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

## Further approaches (items 13–37)

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
- Linear harness: the with-odds model −0.006 [−0.013, −0.0002], just clear; the no-odds model −0.005 [−0.012, +0.0005].
- Full backtest: with-odds linear 0.631 → **0.624**, with-odds ensemble 0.628 → 0.625, no-odds linear 0.633 → 0.628.
- This combination was chosen after seeing the individual results, out of about 50 comparisons, so part of the gain may be chance. Both parts point the same way independently and the idea is principled (margins carry more information than win/loss), which is why it was adopted.

### 23. Second review: findings ⬜

From a second pass over the pipeline (October 2026):
- **The final model is overconfident.** Calibration slope on the backtest is 0.85 for with-odds linear and 0.82 for the ensemble (1.0 would be perfect), against about 1.0 for the market. Each part is calibrated, but blending them and moving to test seasons leaves the result too extreme. Shrinking the final probability towards 50%, with the amount learned from earlier seasons, is a cheap likely gain.
- **The market underrates home teams slightly:** its calibration intercept is +0.10 in logit terms (about 2–3 percentage points). The with-odds model already learns this through its intercept.
- **Robust training for margin and total** was tested and not adopted (see "Already tried").

### 24. Pipeline: prediction time and live use ⬜

- **`predict.py` for upcoming games.** The scraper only keeps finished matches and nothing builds features for unplayed fixtures, so the model can't currently be used. It needs to fetch the next round's fixtures and team lists, build features, and output probabilities, fair odds and edges against current prices.
- **Two prediction snapshots:** a **Tuesday-list model** (built from Tuesday's announced squads) and a **final-17 model** (as now), each evaluated against prices from the same time. Includes scraping historical Tuesday team lists from nrl.com.
- **Weekly refitting.** Ratings update weekly, but the model weights and calibration are fixed for the whole season. A weekly-refit backtest is cheap to test.

### 25. Pipeline: engineering ⬜

- **Pin dependencies** (`requirements.txt` or a lock file) so results reproduce.
- **A single entry point and a config file** instead of module constants and a manual run order (scrape → features → train), recording which settings produced each report.
- **Data checks** beyond the leakage test: unmatched odds joins, scores matching stat totals, duplicate games, and scrapes that silently drop games.

### 26. Better bookmaker-margin removal ⬜

The opening and closing probabilities split the bookmaker's margin proportionally. The **Shin** or **power** methods correct for favourite–longshot bias. This affects the with-odds model's input, every market benchmark and the betting edges.

### 27. Team-level total rating ⬜

Like `team_margin`, but fitted to match totals: each team's tendency to produce high or low scores. `team_margin` helped the win model, and the totals model has the weakest features.

### 28. Reserve-grade data for new players ⬜

nrl.com also has NSW Cup and QLD Cup stats. Players moving up have a track record there, but RAPM starts them at average. That's the biggest blind spot in the player ratings.

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

### 35. Third review: the with-odds model's opening-odds source changes ⬜

The opening prices come from **bet365 until April 2024 and BlueBet after**, and they behave differently: on win log loss, bet365 openers were 0.017 worse than the market average, BlueBet openers only 0.008 worse. BlueBet opens closer to the eventual market price. The with-odds model learns mostly from bet365 seasons, but the **2026 test is entirely BlueBet**, so it may give the opening price the wrong weight.

**Fix to test:** a BlueBet indicator that lets the opening-odds weight differ by bookmaker, or weighting the BlueBet-era seasons more for the with-odds model. Worth checking before `--final`, since it affects the main model.

### 36. Third review: make the final run auditable ⬜

`--final` uses `reports/params.json` from the latest dev run (currently up to date) and refits on 2021–2025, but nothing records which code produced it.
- Tag the commit (e.g. `final-2026`) before running.
- Write the git commit hash and a hash of `features.csv` into `final_2026.md`.
- Refuse to run with uncommitted changes.

### 37. Third review: code structure ⬜

- **Split `train.py`** (over 600 lines, mixing fitting, the dev run, the backtest, the final run and reports) into `models.py` (fit and predict), `evaluate.py` (metrics, bootstrap, benchmarks) and `reports.py`, keeping `train.py` as the command-line entry point.
- **One shared linear-backtest function.** `experiments.py` and `betting.py` reimplement the linear backtest; assertions catch drift today, but `train.py` should expose a `linear_backtest()` they all use.
- **Stop committing regenerable data and reports** (`player_match_stats.csv` is 10 MB; `features.csv` and the prediction CSVs are rewritten every run). Keep the raw odds sheet and code, or use DVC or Git LFS for versioned data.
- **Fast unit tests** (joins, score checks, the margin blend, `md_table`) to run on every change, keeping the 2–4 minute leakage test as the slow, thorough check.

---

## Suggested next steps

1. **Fix the wrong scores** (item 34): a correctness bug, so before anything else. Then **check the bookmaker change** (item 35), which affects the main model's 2026 test.
2. **`predict.py` for upcoming games and pinned requirements** (items 24–25): without them the model can't be used.
3. **Cheap fixes to test with the experiments harness:** shrinking overconfident probabilities (item 23) and Shin margin removal (item 26). Adopt only if the gain is meaningful.
4. **Tuesday-list snapshot** (items 6, 24, 30): team-list scrape, late-change prediction, and prices from Tuesday evening. The route to a real betting test.
5. **Paper trading** from now on (item 33).
6. Bigger projects when there's time: reserve-grade player priors (28), team-level total rating (27), weekly refitting (24), the Bayesian model (31) and the code clean-up (37).

When development is finished, make the final run auditable (item 36) and run the one-time **`--final` test on 2026**, with the ensemble (with odds and no odds) as the main models.
