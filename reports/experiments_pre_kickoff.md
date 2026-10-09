# Pre-kickoff team lists (item 40)

Footy Tipper trains and predicts on the team list as it stood at least a day before kickoff. Our line-up features use the final named 17, which can include late changes the opening price never saw. `teamlists.py` recovers, from the Internet Archive's snapshots of nrl.com match pages, each game's earliest list published after the Tuesday announcement and at least 24 hours before kickoff (usually Tuesday evening's 22-man squad: jerseys 1–17 named). `features.py --pre-kickoff` describes each game by that list instead (team ratings, rookies, RAPM and star absences; history still uses the teams that actually played).

Here the main models, trained exactly as in the backtest (and the 2026 final run), predict each game twice: from its final named 17 (the pipeline's own predictions, checked) and from its pre-kickoff list. Only games with a list for both teams are compared.

## How different the lists are

| season | teams | teams with any change | mean players changed | median hours before kickoff |
|---|---|---|---|---|
| 2023 | 90 | 0.5889 | 0.8111 | 86.1192 |
| 2024 | 238 | 0.5462 | 0.7311 | 74.9528 |
| 2025 | 370 | 0.4811 | 0.6514 | 69.2272 |
| 2026 | 128 | 0.6016 | 0.8047 | 74.5967 |

## 2023-2025 backtest (344 games with a pre-kickoff list)

| model | log_loss | accuracy | margin_mae | total_mae |
|---|---|---|---|---|
| With odds ensemble, final named 17 | 0.6258 | 0.6337 | 13.5833 | 10.8290 |
| With odds ensemble, pre-kickoff list | 0.6272 | 0.6366 | 13.6770 | 10.8316 |
| No odds ensemble, final named 17 | 0.6291 | 0.6308 | 13.5713 | 10.9587 |
| No odds ensemble, pre-kickoff list | 0.6305 | 0.6308 | 13.6962 | 10.9562 |
| Market opening | 0.6375 | 0.6337 | 13.7791 | 10.8227 |
| Market average (closing) | 0.6308 | 0.6337 | - | - |

Head-to-head bets at opening prices (2% minimum edge):

| model | bets | ROI | ROI ci_low | ROI ci_high | CLV bets | CLV mean | CLV positive |
|---|---|---|---|---|---|---|---|
| With odds ensemble, final named 17 | 190 | 0.2198 | 0.0560 | 0.3884 | 40 | 0.0668 | 0.7750 |
| With odds ensemble, pre-kickoff list | 197 | 0.1834 | 0.0190 | 0.3537 | 42 | 0.0610 | 0.7381 |
| No odds ensemble, final named 17 | 227 | 0.1142 | -0.0314 | 0.2689 | 47 | 0.0613 | 0.7660 |
| No odds ensemble, pre-kickoff list | 229 | 0.1131 | -0.0329 | 0.2618 | 47 | 0.0571 | 0.7447 |

## 2026 final test (64 games with a pre-kickoff list)

| model | log_loss | accuracy | margin_mae | total_mae |
|---|---|---|---|---|
| With odds ensemble, final named 17 | 0.6443 | 0.6719 | 16.2253 | 9.6344 |
| With odds ensemble, pre-kickoff list | 0.6449 | 0.6875 | 16.2957 | 9.6405 |
| No odds ensemble, final named 17 | 0.6431 | 0.6406 | 16.1436 | 9.7702 |
| No odds ensemble, pre-kickoff list | 0.6440 | 0.6562 | 16.1975 | 9.7762 |
| Market opening | 0.6328 | 0.6562 | 16.0703 | 10.1719 |
| Market average (closing) | 0.6340 | 0.6094 | - | - |

Head-to-head bets at opening prices (2% minimum edge):

| model | bets | ROI | ROI ci_low | ROI ci_high | CLV bets | CLV mean | CLV positive |
|---|---|---|---|---|---|---|---|
| With odds ensemble, final named 17 | 34 | -0.1306 | -0.4841 | 0.2482 | 30 | 0.0339 | 0.6667 |
| With odds ensemble, pre-kickoff list | 32 | -0.3097 | -0.6119 | 0.0144 | 28 | 0.0323 | 0.6429 |
| No odds ensemble, final named 17 | 34 | -0.1147 | -0.4938 | 0.2906 | 30 | 0.0229 | 0.5667 |
| No odds ensemble, pre-kickoff list | 34 | -0.2485 | -0.5550 | 0.0609 | 30 | 0.0193 | 0.5667 |

## Paired comparisons (log loss; negative = the pre-kickoff version better)

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 40 pre-kickoff list vs final named 17, 2023-2025 backtest | With odds | home_win | log loss | 0.6258 | 0.6272 | 0.0014 | -0.0013 | 0.0042 | no clear difference |  |
| 40 pre-kickoff list vs market opening, 2023-2025 backtest | With odds | home_win | log loss | 0.6375 | 0.6272 | -0.0102 | -0.0262 | 0.0053 | no clear difference |  |
| 40 pre-kickoff list vs final named 17, 2023-2025 backtest | No odds | home_win | log loss | 0.6291 | 0.6305 | 0.0014 | -0.0018 | 0.0047 | no clear difference |  |
| 40 pre-kickoff list vs market opening, 2023-2025 backtest | No odds | home_win | log loss | 0.6375 | 0.6305 | -0.0070 | -0.0283 | 0.0139 | no clear difference |  |
| 40 pre-kickoff list vs final named 17, 2026 final test | With odds | home_win | log loss | 0.6443 | 0.6449 | 0.0006 | -0.0070 | 0.0084 | no clear difference |  |
| 40 pre-kickoff list vs market opening, 2026 final test | With odds | home_win | log loss | 0.6328 | 0.6449 | 0.0121 | -0.0181 | 0.0432 | no clear difference |  |
| 40 pre-kickoff list vs final named 17, 2026 final test | No odds | home_win | log loss | 0.6431 | 0.6440 | 0.0010 | -0.0073 | 0.0096 | no clear difference |  |
| 40 pre-kickoff list vs market opening, 2026 final test | No odds | home_win | log loss | 0.6328 | 0.6440 | 0.0113 | -0.0235 | 0.0471 | no clear difference |  |
