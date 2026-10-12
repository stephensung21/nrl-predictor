# NRL Predictor: Next Ideas

A review of the architecture and every experiment so far (IMPROVEMENTS.md items 1–47; item 48, upsets, came after), written
12 October 2026. It records what is still worth trying and what isn't.

## Where the ceiling is

The algorithm side is exhausted:
- GAM and EBM showed the relationships are essentially linear (item 20).
- Logit averaging, stacking and learned blend weights were no better than the plain 50/50 average (items 12, 39).
- Recalibration added nothing after the BlueBet fix (item 23).
- Weekly refits and recency weighting made things worse or no better (items 13, 24).

More features of the same kind won't help either. Elo, the team margin rating and RAPM already
cover team strength, so new features keep overlapping them: ladder position, Origin
representatives, form and opponent-adjusted form (items 17, 18). An "unpredictability"
(volatility) index would most likely go the same way: it has no direction for the winner, its
estimate is noisy from about 10 games, and the causes behind it (line-up churn, absences, rain)
are already features.

What's left: **a less noisy training target, better player-rating priors, and the gaps between
the backtest and live use.**

## Worth testing, in order

### 1. Train on the closing price, not just win or loss ⬜

The with-odds model's edge is anticipating where the price moves between the opening and the
close: in the largest 10% of disagreements the closing price moved towards the model 86% of the
time (item 41). The model learns that move from a 0/1 outcome, which is extremely noisy.

- **Data:** `p_avg` (the Odds Portal closing average) and `close_total` exist for every season
  2020–2026. `p_close` and `close_line` are missing for most of 2024–25.
- **Model:** regress `logit(p_avg)` on the same features, including the opening logit. The target
  has a tiny fraction of the noise of a win/loss, so the weights on team news (RAPM vs usual, star
  absences) should be far better estimated from about 1,000 games. Same for `close_total` → totals.
- **Use:** as a third ensemble member, or as an input to the with-odds model.
- **Ceiling:** the close scores 0.620 against the with-odds ensemble's 0.622 on the backtest, so
  the win-model gain is capped at about 0.002. The bigger payoff is a cleaner "how far will the
  price move" signal for betting.
- **Leakage:** none, as long as only earlier games' closes are used as targets. The modelling
  plan bans open→close movement as a *feature*, not as a target.

### 2. Better RAPM priors, aimed at the star blind spot ⬜

The model under-reacts to a star's absence by **3–4 points** (item 38). That's the largest measured
bias in the project, and S2 only partly fixed it. Two likely structural causes in `rapm_features`:

- **Everyone is shrunk towards 0, the league average.** A newcomer or fringe replacement gets 0,
  but replacements are below average. When a star is out, the drop-off is understated twice: the
  star is rated too low and the replacement too high.
- **The 90-day half-life with penalty 300 forgets last season.** A game two years old counts about
  0.2% as much as today's, so established stars rely on a thin recent sample.

Variants to try:
- **Replacement-level prior:** shrink towards a value set by selection (the share of recent games
  started, career NRL games), not by box-score stats. This is different from the fantasy-points
  prior that failed (item 10): coaches' selection carries information box scores don't.
- **Previous-estimate prior:** shrink each player towards last season's rating instead of 0. This
  is the cheap version of the Bayesian model (item 31).

Score it on the backtest and also on item 38's star with/without check. If the 3–4 point gap
shrinks, that's evidence it works even if log loss barely moves.

### 3. Re-run "Elo + odds on the full 2013–2024 history" on the backtest ⬜

It's in "Already tried", but it was judged on 2025 alone (0.654). Code-review point 2 says the
2025-only rejections should be rerun on the backtest, and this is the one that never was (item 13
reran the other four).

The training rows start in 2021 (about 1,000 games), but Elo, `team_margin` and the opening odds
go back to 2009. Fit a base model on those over about 3,000 games and use it as an offset, so the
2021+ player features only learn the residual. The bookmaker change (item 35) complicates it.
Cheap to test with `pipeline_backtest`.

## Live performance (won't show in the backtest)

These close the gap between the backtest and what `predict.py` will actually do in 2027:

- **Wet flag from the forecast** (item 45): live totals lose about 0.1 MAE because the flag is set
  to 0. Open-Meteo's forecast wins back most of it; it only needs changes in the predict and refresh jobs.
- **Train on Tuesday lists** (item 40 caveat): the models train on final 17s but would predict from
  Tuesday lists. With only 344 games that have a list, the realistic version is the current model
  with a light adjustment fitted on those games.
- **Late-change probability** (item 30): expected availability for each named player, weighted
  into the line-up ratings.

### News agent: flag news that should move a prediction ⬜

An agent that reads r/nrl and nrl.com (team lists, injury and casualty ward, match previews,
late-mail) during the week, picks out news that could matter, and checks it by rerunning the model.

- **Steps:** scrape the sources; have the agent pull out structured facts (who is out, in, moved
  position or doubtful, and the source); map each fact to a line-up change; rerun `predict.py` with
  the changed line-up; flag the game if the win probability or margin moves past a threshold set in
  advance (e.g. 3 percentage points or 2 points of margin).
- **Why it might help:** the model only knows what's in the team list it's given. Late withdrawals,
  "named but in doubt" players and 1-hour changes reach Reddit and late-mail before the data does.
  It is a way to get at the late-change gap (item 30) and the star blind spot (idea 2) as they happen.
- **Limits:** news that isn't a line-up change (coach sacked, off-field issues, a player "carrying
  a knock") has no feature to enter through, so the agent can only report it, not change a
  prediction. Reddit rumours are unreliable, so keep each fact's source and only rerun on confirmed
  or official news unless it is clearly marked.
- **Testing:** no archive of past news yet, so it can't be backtested (the news-archive builder,
  PLAN.md §7.10, would fix that). Meanwhile, log every flag in 2027 paper
  trading, with the prediction before and after, and check whether the rerun predictions beat the
  originals and the closing price on the flagged games.

## Low priority or skip

- **Combination continuity, fatigue (item 18), roster turnover (item 29):** these likely overlap
  RAPM vs usual and the RAPM ratings themselves; expect about ±0.001.
- **Full Bayesian hierarchical model (item 31):** a big build. Only worth it if idea 2 shows that
  better priors help.
- **More model types, ensemble weighting, calibration, a volatility index:** already covered by
  the rejections above.

## How to judge these

The 2023–25 backtest has been used for about 50 or more comparisons, and 2026 has been seen once.
Under the adoption rule (a meaningful backtest gain, otherwise "Already tried"), decide each test
and its pass criteria **before** running it, and treat 2027 paper trading as the real verdict.
