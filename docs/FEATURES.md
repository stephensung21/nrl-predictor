# Model features: what's built, what's used and why

Every match feature the project builds or could build, which models use it, and, for the ones left out, why. Written 13 October 2026 from `src/features.py`, `src/config.py` and the experiment write-ups in `IMPROVEMENTS.md` (item numbers below refer to that file) and `NEXT_IDEAS.md`.

Every feature uses only information from before kickoff: earlier games, the published draw, the final named 17 and the opening odds. Team features are **home minus away** (`diff_*`). `tests/test_leakage.py` checks this.

## Status key

| Status | Meaning |
|---|---|
| ✅ **Linear** | In the fixed linear set (`LINEAR_FEATURES` in `config.py`), and so also in LightGBM's compact set |
| ✅ **LightGBM** | In LightGBM's compact set only (`LGB_COMPACT_EXTRA`) |
| ⚪ **Built, unused** | Built by the default `python src/features.py` and saved in `features.csv`, but no model uses it |
| 🧪 **Experimental** | Built only with `python src/features.py --experimental`; tested and not adopted |
| 💡 **Not built** | An idea that could be built from data the project has or could get |
| ⛔ **Ruled out** | Not built on purpose: it would leak, or the data doesn't exist |

## How the models use them

The main model for both variants is the ensemble: a 50/50 average of the linear model and LightGBM.

| Model | Win | Margin | Total |
|---|---|---|---|
| **Linear** (logistic / ridge) | `elo_logit`, `diff_rapm_total`, `diff_rapm_defence`, `diff_rapm_vs_usual`, `team_margin`, the two S2 star absences | The same without `team_margin` | `rapm_points`, `origin_period`, `wet_conditions` |
| **LightGBM** (compact set) | Every linear feature above, plus `diff_rapm_missing`, `diff_rookies`, `diff_rest_days`, `home_travel`, `away_travel`, `neutral` | Same | Same |
| **With-odds variant** adds | `open_logit`, `open_line`, `open_total`, `bluebet`, `open_logit_bluebet` | Same | `open_logit`, `open_line`, `open_total` (not the BlueBet inputs) |

So **16 features** feed the no-odds models and **21** feed the with-odds models, out of about 50 built by default and about 75 with `--experimental`.

Why so few? Per-season forward selection over all the features was unstable and overfit (item 1), and LightGBM on the full ~50 features overfit and moved by ~3 percentage points between random seeds (item 4). The fixed sets are the features the backtest's selection kept choosing.

> **Note:** the frozen 2027 bundle (`models/2027/meta.json`, frozen 10 October) still has the older LightGBM set with `diff_rapm_attack` and `is_final`. Item 47 dropped both on 12 October; the bundle needs refreezing (`python src/train.py --freeze --force`) before Round 1.

## Team strength (Elo and team ratings)

| Feature | What it is | Status | Why |
|---|---|---|---|
| `elo_logit` | Pre-match Elo win probability as a logit, from every result since 2009 | ✅ Linear (win, margin) | Strong and chosen in every backtest season |
| `team_margin` | Ridge regression of capped margins since 2009 on team strengths plus home advantages, two-year half-life | ✅ Linear (win) | Adopted with the margin-blended win probability (items 15, 22) |
| Team-specific home advantage | Each team's own home advantage as its own feature | ❌ tested, not kept | −0.002, within noise; `team_margin` already includes it (item 16) |
| `team_total` | The totals counterpart of `team_margin`: each team's scoring tendency | 🧪 Experimental | Total MAE −0.02 to +0.04, not clear; weak and overlaps `rapm_points` and the opening total (item 27) |
| Elo retuned on 2013–2024, or inside each backtest year | Different Elo settings | ❌ tested | Slightly worse (item 13) |
| Poisson team and player ratings | Multiplicative attack/defence ratings | ❌ tested | Nothing clear; same information as RAPM (correlation 0.92) (item 49) |

## Team form

Exponentially weighted averages over about the last 6 games, pulled a third of the way back to the league average each new season.

| Feature | Status | Why |
|---|---|---|
| `diff_form_points_for`, `diff_form_points_against`, `diff_form_completion_rate`, `diff_form_possession_pct`, `diff_form_all_run_metres`, `diff_form_post_contact_metres`, `diff_form_line_breaks`, `diff_form_tackle_breaks`, `diff_form_errors`, `diff_form_penalties_conceded`, `diff_form_missed_tackles` | ⚪ Built, unused | They don't add to Elo and RAPM. Selection never kept them, and they correlate with results (form points r ≈ 0.2–0.3) but not with the model's errors (item 46) |
| Opponent-adjusted form | ❌ tested | No help; the full adjusted block made margin worse by 0.16–0.25 (item 17) |

## Match context

| Feature | What it is | Status | Why |
|---|---|---|---|
| `origin_period` | A State of Origin game within 7 days | ✅ Linear (total) | Chosen consistently by the totals selection |
| `wet_conditions` | Rain, or a slippery, wet, heavy or muddy ground, as recorded on the day | ✅ Linear (total) | Cut total MAE by about 0.09 (item 11). Live predictions set it to 0, since the weather isn't known yet (see Weather below) |
| `diff_rest_days` | Days since each team's last game, capped at 14 | ✅ LightGBM | Kept in the compact set; no single extra helps much on its own (item 47) |
| `home_travel`, `away_travel` | Team playing outside its home state | ✅ LightGBM | As above |
| `neutral` | Neutral venue (Magic Round, Las Vegas and similar) | ✅ LightGBM | As above |
| `is_final` | Finals game | ⚪ Built, unused | Dropped in item 47: too few finals for a 40-game leaf, so LightGBM never split on it |
| `away_at_ground` | The away team is playing at its own home ground | ⚪ Built, unused | Never chosen; context features made the linear models' CV worse |
| `diff_short_turnaround`, `diff_after_bye` | Under 6 days' rest; 11+ days since the last game | ⚪ Built, unused | Never chosen; context features made the linear models' CV worse (item 8) |
| `night_game`, `kickoff_thursday`, `kickoff_friday`, `kickoff_sunday` | Kickoff slot, Sydney time | 🧪 Experimental | Clearly worse in the linear models (+0.004 win log loss) (item 18) |
| `diff_travel_km`, `diff_tz_change` | Great-circle distance from each team's base; time-zone change | 🧪 Experimental | No clear effect (item 18) |
| `diff_ladder_pos`, `diff_out_of_contention` | NRL ladder place before the round; can't reach 8th even by winning out | 🧪 Experimental | No clear effect; they measure team strength, which Elo and RAPM already have (item 18) |
| Referee records | Each referee's shrunk total points and penalties | ❌ tested (the referee is scraped) | No signal (item 11) |

## Players and line-ups

Player names and IDs are never features: with about 700 players and about 1,000 training games, they would mostly learn noise. Player quality comes in through ratings.

### RAPM (plus-minus ratings)

A ridge regression of each game's margin on who was in the named 17, refitted before every round. It is the project's strongest single input.

| Feature | What it is | Status | Why |
|---|---|---|---|
| `diff_rapm_total` | Margin rating of the named 17 | ✅ Linear (win, margin) | Strongest single feature; picked first in every backtest season (item 3) |
| `diff_rapm_defence` | The defensive half of the rating | ✅ Linear (win, margin) | Chosen consistently (item 10) |
| `diff_rapm_vs_usual` | Today's 17 against the team's last 5 line-ups, valued with the same ratings | ✅ Linear (win, margin) | Captures team news; chosen consistently |
| `rapm_points` | Expected total points from the attack and defence ratings (a match feature, not home minus away) | ✅ Linear (total) | Chosen consistently for totals |
| `diff_rapm_missing` | Rating of the usual players missing from the 17 | ✅ LightGBM | Kept in the compact set |
| `diff_rapm_attack` | The attacking half of the rating | ⚪ Built, unused | Exactly `diff_rapm_total` + `diff_rapm_defence`, so it adds nothing. Dropping it improved the backtest and 2026 (item 47) |
| RAPM with a fantasy-points prior | Shrink towards a box-score estimate instead of 0 | ❌ tested (`RAPM_STATS_PRIOR`) | CV worse (0.611 vs 0.606) (item 10) |

### Star absences

| Feature | What it is | Status | Why |
|---|---|---|---|
| `diff_s2_stars_out_spine`, `diff_s2_stars_out_other` | Usual players missing from the 17 who played Origin in the last 12 months or are top 10% of their position for form, split into spine and other | ✅ Linear (win, margin) | The model under-reacted to stars' absences by 3–4 points; S2 was the best of about eight versions (−0.0015 win log loss) (item 38) |
| `diff_stars_named`, `diff_stars_out` | Stats-based stars (top 10% fantasy points per 80 minutes) | 🧪 Experimental | No effect; fantasy stats miss real stars (item 38) |
| `diff_rapm_stars_named`, `diff_rapm_stars_out` | RAPM-based stars | 🧪 Experimental | Picks whole rosters of top teams; re-tested on top of S2, win −0.001: too small (items 38, 46) |
| `diff_missq_fullback`, `diff_missq_halfback`, `diff_missq_five_eighth`, `diff_missq_hooker`, `diff_key_absence`, `diff_key_star_out` | Missing usual player at each key position, weighted by form | 🧪 Experimental | −0.001 to −0.002, not clear (item 38) |
| `diff_impact_out` | Each player's own with/without record, shrunk | 🧪 Experimental | No effect: too few absences to learn from (item 38) |
| `diff_origin_stars_out_spine`, `diff_origin_stars_out_other` | Origin-only stars (S1) | 🧪 Experimental | Not clear; S2 does better (items 38, 46) |

### Fantasy-points ratings and line-up changes

| Feature | What it is | Status | Why |
|---|---|---|---|
| `diff_rookies` | Players with fewer than 3 earlier games | ✅ LightGBM | In the compact set. Adding it to the linear models gave margin −0.05, which is real but too small to adopt; it's the first to revisit if 2027 shows the same pattern (item 46) |
| `diff_rating_total`, `diff_rating_spine`, `diff_rating_forwards`, `diff_rating_backs`, `diff_rating_bench` | Fantasy-points ratings summed by position group | ⚪ Built, unused | RAPM replaced them. Fantasy points turned out a poor measure of value (items 3, 19) |
| `diff_spine_vs_usual`, `diff_spine_changes`, `diff_halfback_changed` | Spine against its usual rating; spine changes since the last game; new halfback | ⚪ Built, unused | `diff_rapm_vs_usual` covers team news better; full-set LightGBM overfit (items 2, 4) |
| `diff_missing_usual`, `diff_missing_usual_rating` | Count and fantasy rating of usual players missing | ⚪ Built, unused | As above; `diff_rapm_missing` and the S2 stars cover it |
| `diff_ins_forwards`, `diff_ins_backs`, `diff_ins_bench` | New players by position group | ⚪ Built, unused | As above |
| `diff_returning` | Experienced players back after missing the previous game | ⚪ Built, unused | As above |
| `diff_kicker_changed` | The usual goal-kicker is out | ⚪ Built, unused | As above |

### Origin and reserve grade

| Feature | What it is | Status | Why |
|---|---|---|---|
| `diff_origin_backup`, `diff_origin_out` | Players backing up from Origin; usual players missing for Origin | ⚪ Built, unused | Never chosen for the linear models; left out of LightGBM's compact set (items 4, 8) |
| `diff_origin_reps` | Named players who played Origin in the last 12 months | 🧪 Experimental | No clear effect; measures team strength (item 18) |
| `diff_reserve_newcomers`, `diff_reserve_rapm_newcomers` | NSW Cup / QLD Cup ratings of players with fewer than 10 NRL games | 🧪 Experimental | Margin −0.01 to −0.04: too small. Newcomers have too few reserve games, and RAPM takes over after a few NRL games (item 28) |

## Odds (with-odds variant only)

| Feature | What it is | Status | Why |
|---|---|---|---|
| `open_logit` | Opening head-to-head probability, bookmaker margin removed, as a logit | ✅ With-odds | The market's view at the open |
| `open_line`, `open_total` | Opening line and total | ✅ With-odds | As above |
| `bluebet`, `open_logit_bluebet` | Flag for BlueBet prices (from April 2024; bet365 before), and its interaction with the opening logit | ✅ With-odds (win, margin) | Fixes calibration after the bookmaker change; made the totals model worse, so not used there (item 35) |
| Shin margin removal | A different way to remove the bookmaker margin | ❌ tested | ±0.001, no difference (items 26, 42) |
| The market as a separate expert in a learned blend, with no odds in the models | Footy Tipper's approach | ❌ tested | +0.008, clearly worse (item 39) |

## Weather

`src/weather.py` gets each game's weather from Open-Meteo, but it isn't part of `features.csv`.

| Feature | Status | Why |
|---|---|---|
| Rain, wind and temperature at kickoff, as model features or replacing `wet_conditions` | ❌ tested | Total MAE −0.01 to +0.05, not clear (item 45) |
| Wet flag filled from the forecast in the live jobs | 💡 Not built | Would win back most of the ~0.1 total MAE that live predictions lose by setting the flag to 0. Totals only, so not a priority (item 45) |

## Could be built (not yet)

| Idea | What it would be | Notes |
|---|---|---|
| **Closing price as a training target** | Regress the closing price on the features, instead of only learning from win or loss | First on the list in `NEXT_IDEAS.md`. Win-model gain capped at about 0.002; a target, not a feature, so no leakage |
| **Better RAPM priors** | Shrink players towards a replacement level set by selection, or towards last season's rating | Aimed at the 3–4 point star blind spot (`NEXT_IDEAS.md` idea 2) |
| **Elo and odds base model over 2013–2024** | Fit on about 3,000 games and use as an offset | Only judged on 2025 so far (`NEXT_IDEAS.md` idea 3) |
| **Market-disagreement features** | E.g. margin implied by the head-to-head price against the opening line | Item 32 |
| **Draw probability** | A small draw chance, since a draw loses a head-to-head bet | Item 32 |
| **Roster turnover** | Share of last season's minutes that has left the club | Item 29; likely overlaps RAPM |
| **Combination continuity** | Games the halves pairing and spine have played together | Item 18; likely overlaps `diff_rapm_vs_usual` |
| **Workload and fatigue** | Key players' minutes over the last 2–3 weeks, including Origin | Item 18; likely overlaps the Origin features |
| **Late-change probability** | The chance each Tuesday-named player actually plays | Item 30; needed to predict from Tuesday lists |
| **News-agent flags** | Line-up news from r/nrl and nrl.com fed back through the model | `NEXT_IDEAS.md`; can't be backtested without a news archive |
| **Bayesian hierarchical model** | Team strength plus player effects in one model | Item 31; a big build, only if better priors help first |

`NEXT_IDEAS.md` expects most new team-strength features to overlap Elo, RAPM and the team rating, and to move log loss by about ±0.001.

## Ruled out

| Feature | Why |
|---|---|
| Players with minutes > 0 as the line-up | Leaks post-match information; the named 17 is used instead (item 2) |
| Opening-to-closing price movement, or closing odds as inputs | Not known before the bet is placed (`MODELLING_PLAN.md` §7) |
| Min and Max odds columns | Never used (`MODELLING_PLAN.md` §3) |
| One-hot team, venue or player IDs; embeddings | Too many levels for about 1,000 games; Elo, venue flags and ratings carry the information |
| Captain changes | The data has no captain field (item 2) |
| Pre-2020 scraped games | Played before the six-again rule, so the stats mean different things (item 5). Elo still uses results since 2009 |
