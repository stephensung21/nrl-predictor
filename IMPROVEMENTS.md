# NRL Predictor: Improvement Plan

The goal is to beat the bookmakers' closing odds. On the 2025 dev season the current models are close but behind:

| | 2025 log loss |
|---|---|
| Market closing (Odds Portal average) | 0.648 |
| Model A, linear (with opening odds) | 0.650 |
| Model B, linear (no odds) | 0.652 |
| Elo only | 0.653 |
| Market opening | 0.660 |

A quick experiment showed that a **small feature set chosen by cross-validation** (Elo, spine strength vs the team's usual spine, rookies, outside backs' rating, penalties conceded, home travel, points conceded) scores **0.645** on 2025 with no odds. The edge comes mainly from **team-news features**. The gap is within noise over 212 games, so only the 2026 test against real closing odds will settle it.

All work below is chosen and checked on 2025 or earlier. 2026 stays untouched until `python src/train.py --final`.

---

## 1. Build feature selection into `train.py`

Do greedy forward selection inside walk-forward cross-validation (2022–2024): add one feature at a time, keep it only if CV log loss improves by at least 0.0005, and stop when nothing does. Model B gets the selected set; Model A adds the opening odds to it.

- **Why:** 27 features is too many for about 780 training games. The extra form features add noise. On the 125 games where the full Model B differs from the market by more than 5 points, the market wins (0.645 vs 0.654).
- **Care:** choose the stopping point by CV only, never by the 2025 score.

## 2. Expand the team-news features

This is where the edge comes from: `diff_spine_vs_usual` and `diff_rookies` were the first features chosen after Elo.

- Use the **named team list (jerseys 1–17)** instead of "players with minutes > 0". An unused bench player can't be known before kickoff, so the current line-up is slightly after-the-fact.
- The combined rating of the **usual starters who are missing**.
- **Changes by position group** (forwards, outside backs, bench), not just the spine.
- **Goal-kicker** and **captain** changes.
- The number of players **returning from injury or long absence**.
- Add the leakage test's checks for each new feature.

## 3. Better player ratings

Ratings are currently an exponentially weighted average of fantasy points, which is a rough measure of a player's value.

- Build ratings from the underlying player stats (run metres, tackle breaks, line-break involvements, errors, missed tackles) with **position-specific weights**, fitted on earlier seasons only.
- Or estimate each player's effect on team margin when they're on the field (a regularised plus-minus).
- Compare against the fantasy-points version in CV before switching.

## 4. Drop or heavily constrain LightGBM

LightGBM was best in CV but worst on 2025 (0.676). It overfits through 60 Optuna trials that early-stop on the same seasons they're scored on.

- Either drop it from the ensemble, or
- limit it to depth 2, cut the number of trials, and early-stop on a validation season separate from the test season.
- Return to it if more seasons of data become available (item 5).

## 5. Get more seasons of stats

Training currently starts in 2021. If nrl.com has match and player stats for earlier seasons, extend `src/scrape.py` back as far as the data allows (avoiding 2020 as planned). Doubling the training data would help the player features and make LightGBM viable.

## 6. Think about when the bets would be placed

Team lists are named on Tuesday, but the market keeps adjusting until kickoff. If the edge comes from team news, it should be largest straight after the lists are named and shrink as prices move.

- Measuring this needs **mid-week odds** (after team lists, before kickoff), which the current odds sheet doesn't have. Find a source or start recording them.
- Compare the model against the price you could actually bet at, not only the closing price.

## 7. Test whether the edge is real

- **Bootstrap** the per-game log-loss difference between the model and the market to get a confidence interval, not just a point estimate.
- Run the **betting simulation** (already listed as a future step): bet when the model's edge over the price exceeds a threshold, and track profit and ROI.

---

## Already tried on 2025, didn't help

| Idea | 2025 log loss |
|---|---|
| Win probability from the predicted margin (`Φ(margin / σ)`) | 0.653 at best |
| Market price as a fixed starting point, learning adjustments on top | 0.658 at best |
| Weighting recent seasons more heavily | 0.655–0.657 |
| Elo plus opening odds model trained on the full 2013–2024 history | 0.654 |
| Retuning Elo on 2013–2024 instead of 2013–2020 | 0.655 (vs 0.653) |

## Suggested order

Items 1, 2 and 4 are the quickest wins and work with the data already scraped. Items 3 and 5 take more effort. Items 6 and 7 are needed before betting real money.
