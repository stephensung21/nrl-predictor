# NRL Predictor: Improvement Plan

The goal is to beat the bookmakers' closing odds. Current standing on the 2025 dev season:

| | 2025 log loss | Before improvements |
|---|---|---|
| **Model B, linear (no odds)** | **0.643** | 0.652 |
| Market closing (Odds Portal average) | 0.648 | |
| Model B, ensemble | 0.648 | 0.660 |
| Model A, linear (with opening odds) | 0.651 | 0.650 |
| Elo only | 0.653 | |
| Market opening | 0.660 | |

Model B's linear model now uses three features chosen by cross-validation: the **RAPM line-up rating**, **Elo** and **rookies**. A paired bootstrap against the market gives a difference of −0.006 (95% interval −0.032 to +0.019; the model is better in 67% of resamples). That's promising but not conclusive over 212 games. The 2026 test against real closing odds will settle it.

All work is chosen and checked on 2025 or earlier. 2026 stays untouched until `python src/train.py --final`. 2025 has now been looked at many times, so it's a less independent check than it was.

**Status:** ✅ done · 🔶 partly done · ⬜ not started

---

## 1. Build feature selection into `train.py` ✅

Greedy forward selection for the linear models inside walk-forward CV (2022–2024). A feature is added only if it improves log loss in **every** CV season and the pooled score by at least **0.001**. LightGBM keeps the full feature set.

- The first version (pooled gain of 0.0005 or more) picked 10 features and overfit: CV improved but 2025 got worse (0.657). The every-season rule fixed this, and now picks 3.
- The selection steps are in `reports/cv_forward_selection.csv` and the dev report.

## 2. Expand the team-news features ✅

- **Named 17 instead of "players with minutes > 0".** The old definition leaked post-match information: part of the early 0.645 result came from it, and the leak-free equivalent scored 0.648. The leakage test now scrambles minutes played and goal-kicking, and the old code fails it.
- Added: usual players missing (count and combined rating), new players by position group, experienced players returning, goal-kicker missing.
- **Captain changes: not possible.** The scraped data has no captain field.
- None of these were selected for the linear model once RAPM existed. LightGBM uses them.

## 3. Better player ratings ✅

**Regularised plus-minus (RAPM):** each player is rated by how the team's margin changes with them in the named 17. It's a ridge regression over earlier games, refitted before every round with an exact solve. Settings (penalty 300, 90-day half-life) were chosen on 2022–24 CV.

- Three features: the named 17's total RAPM, that total compared with the team's usual line-ups, and the RAPM of usual players who are missing.
- `diff_rapm_total` is the strongest single feature, chosen even before Elo.
- The fantasy-points ratings are kept alongside it.

## 4. Drop or heavily constrain LightGBM ⬜ (on hold)

Left unchanged at your request. LightGBM is still the weakest model (Model B 0.660 on 2025) and drags the ensembles down. Item 12 is a way to deal with that without changing LightGBM itself.

## 5. Get more seasons of stats ⬜

Training starts in 2021. If nrl.com has match and player stats for earlier seasons, extend `src/scrape.py` back as far as the data allows (avoiding 2020). More history would help RAPM in particular, since player ratings in 2021 start from nothing. This remains the fundamental fix for noisy results.

## 6. Think about when the bets would be placed ⬜

Team lists are named on Tuesday, but the market keeps adjusting until kickoff. If the edge comes from team news, it should be largest straight after the lists are named.

- Needs **mid-week odds** (after team lists, before kickoff), which the current odds sheet doesn't have.
- Compare the model against the price you could actually bet at, not only the closing price.

## 7. Test whether the edge is real 🔶

- ✅ A one-off **bootstrap** of model vs market log loss on 2025 (results above). Not yet built into the pipeline.
- ⬜ The **betting simulation**: bet when the model's edge over the price exceeds a threshold, and track profit and ROI.

## 8. Context features ✅

Added `short_turnaround`, `after_bye`, `origin_period`, `origin_backup` (players backing up from Origin) and `origin_out` (usual players missing for Origin). `scrape.py` now also fetches State of Origin games into `data/processed/origin_players.csv`.

- None help the linear model: each makes CV log loss worse when added to the selected three. Origin absences are likely already captured by RAPM and the missing-player features.
- LightGBM uses them; Model B LightGBM improved from 0.669 to 0.660 on 2025, though part of that may be tuning variation.

## 9. Evaluate over more seasons ⬜ (recommended next)

Run the **whole procedure** (selection and tuning on earlier seasons, then predict) for 2023, 2024 and 2025 in turn. That's about 630 evaluation games instead of 212, giving a much tighter confidence interval. It also shows whether feature selection is stable from season to season.

## 10. Improve RAPM ⬜

- **Weight bench players lower:** interchange players play about half the minutes of starters, and their role is known before kickoff.
- **Shrink towards a stats-based estimate** (fantasy points or player stats) instead of zero, so new players start at a sensible rating.
- **Separate attack and defence ratings** (points scored and conceded), to help the total-points model.

## 11. Use the unused match data and other markets ⬜

- `matches.csv` has **weather, ground conditions and referee**. These should mainly help the total-points model. Weather before kickoff is only a forecast, so it needs care.
- **Line and total markets:** Model B's margin error on 2025 (13.64) is below the opening line's (13.97), so line betting may offer more edge than head-to-head. 2025 closing lines are missing, so this needs the 2026 data or another odds source.

## 12. Fix the ensemble ⬜

Weight the linear and LightGBM models by their CV performance (or stack them) instead of a plain average, or use the linear model alone. This doesn't change LightGBM itself.

---

## Already tried, didn't help

| Idea | Result |
|---|---|
| Win probability from the predicted margin (`Φ(margin / σ)`) | 0.653 at best on 2025 |
| Market price as a fixed starting point, learning adjustments on top | 0.658 at best on 2025 |
| Weighting recent seasons more heavily | 0.655–0.657 on 2025 |
| Elo plus opening odds model trained on the full 2013–2024 history | 0.654 on 2025 |
| Retuning Elo on 2013–2024 instead of 2013–2020 | 0.655 (vs 0.653) on 2025 |
| Looser feature selection (pooled gain of 0.0005 or more, 10 features) | CV better, 2025 worse (0.657) |
| Context and Origin features in the linear model | each made CV log loss worse |

## Suggested order

9 first, since it makes every later decision more reliable. Then 10, which is cheap and builds on the strongest feature. Then 5, which takes the most effort but helps most. 6 and 7 are needed before betting real money.
