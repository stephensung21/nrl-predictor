# RAPM priors (item 51, 2023–2025 backtest)

Every RAPM feature (`diff_rapm_total`, `_vs_usual`, `_missing`, `_attack`, `_defence`, `rapm_points`) rebuilt with a prior other than 0, then the full pipeline backtest (all settings unchanged; the RAPM penalty stays 300 and the half-life 90 days). Previous-season prior: from each season's first round, players are shrunk towards kappa × their rating at the end of the previous season instead of 0. Selection prior: two lightly penalised columns, log(1 + career NRL games) and log(1 + starts in the last 365 days), both before the match, so players are shrunk towards what their selection history implies (player data starts in 2020, so career games are truncated at 2020). `diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 51 previous-season prior, kappa 0.5: linear | With odds | home_win | log loss | 0.6209 | 0.6206 | -0.0003 | -0.0044 | 0.0037 | no clear difference |  |
| 51 previous-season prior, kappa 0.5: linear | With odds | margin | MAE | 13.5340 | 13.5212 | -0.0129 | -0.1049 | 0.0765 | no clear difference |  |
| 51 previous-season prior, kappa 0.5: linear | With odds | total | MAE | 10.7185 | 10.7187 | 0.0002 | -0.0457 | 0.0461 | no clear difference |  |
| 51 previous-season prior, kappa 0.5: ensemble | With odds | home_win | log loss | 0.6209 | 0.6227 | 0.0018 | -0.0036 | 0.0071 | no clear difference |  |
| 51 previous-season prior, kappa 0.5: ensemble | With odds | margin | MAE | 13.4774 | 13.4971 | 0.0197 | -0.0704 | 0.1098 | no clear difference |  |
| 51 previous-season prior, kappa 0.5: ensemble | With odds | total | MAE | 10.7765 | 10.7649 | -0.0116 | -0.0489 | 0.0251 | no clear difference |  |
| 51 previous-season prior, kappa 0.5: linear | No odds | home_win | log loss | 0.6261 | 0.6260 | -0.0001 | -0.0062 | 0.0059 | no clear difference |  |
| 51 previous-season prior, kappa 0.5: linear | No odds | margin | MAE | 13.5628 | 13.5708 | 0.0080 | -0.1339 | 0.1464 | no clear difference |  |
| 51 previous-season prior, kappa 0.5: linear | No odds | total | MAE | 10.8072 | 10.7881 | -0.0192 | -0.0512 | 0.0119 | no clear difference |  |
| 51 previous-season prior, kappa 0.5: ensemble | No odds | home_win | log loss | 0.6255 | 0.6277 | 0.0022 | -0.0051 | 0.0091 | no clear difference |  |
| 51 previous-season prior, kappa 0.5: ensemble | No odds | margin | MAE | 13.5058 | 13.5533 | 0.0474 | -0.0888 | 0.1818 | no clear difference |  |
| 51 previous-season prior, kappa 0.5: ensemble | No odds | total | MAE | 10.8346 | 10.8140 | -0.0206 | -0.0855 | 0.0434 | no clear difference |  |
| 51 previous-season prior, kappa 1: linear | With odds | home_win | log loss | 0.6209 | 0.6230 | 0.0021 | -0.0054 | 0.0098 | no clear difference |  |
| 51 previous-season prior, kappa 1: linear | With odds | margin | MAE | 13.5340 | 13.6122 | 0.0782 | -0.0828 | 0.2358 | no clear difference |  |
| 51 previous-season prior, kappa 1: linear | With odds | total | MAE | 10.7185 | 10.7153 | -0.0033 | -0.0640 | 0.0581 | no clear difference |  |
| 51 previous-season prior, kappa 1: ensemble | With odds | home_win | log loss | 0.6209 | 0.6263 | 0.0054 | -0.0024 | 0.0131 | no clear difference |  |
| 51 previous-season prior, kappa 1: ensemble | With odds | margin | MAE | 13.4774 | 13.5586 | 0.0812 | -0.0552 | 0.2138 | no clear difference |  |
| 51 previous-season prior, kappa 1: ensemble | With odds | total | MAE | 10.7765 | 10.7642 | -0.0123 | -0.0743 | 0.0483 | no clear difference |  |
| 51 previous-season prior, kappa 1: linear | No odds | home_win | log loss | 0.6261 | 0.6319 | 0.0058 | -0.0058 | 0.0168 | no clear difference |  |
| 51 previous-season prior, kappa 1: linear | No odds | margin | MAE | 13.5628 | 13.7420 | 0.1792 | -0.0743 | 0.4283 | no clear difference |  |
| 51 previous-season prior, kappa 1: linear | No odds | total | MAE | 10.8072 | 10.8004 | -0.0068 | -0.0723 | 0.0616 | no clear difference |  |
| 51 previous-season prior, kappa 1: ensemble | No odds | home_win | log loss | 0.6255 | 0.6339 | 0.0084 | -0.0027 | 0.0195 | no clear difference |  |
| 51 previous-season prior, kappa 1: ensemble | No odds | margin | MAE | 13.5058 | 13.6538 | 0.1480 | -0.0656 | 0.3574 | no clear difference |  |
| 51 previous-season prior, kappa 1: ensemble | No odds | total | MAE | 10.8346 | 10.8238 | -0.0108 | -0.0941 | 0.0718 | no clear difference |  |
| 51 selection prior (career games, recent starts): linear | With odds | home_win | log loss | 0.6209 | 0.6208 | -0.0001 | -0.0095 | 0.0096 | no clear difference |  |
| 51 selection prior (career games, recent starts): linear | With odds | margin | MAE | 13.5340 | 13.4892 | -0.0448 | -0.2464 | 0.1613 | no clear difference |  |
| 51 selection prior (career games, recent starts): linear | With odds | total | MAE | 10.7185 | 10.7375 | 0.0189 | -0.0327 | 0.0707 | no clear difference |  |
| 51 selection prior (career games, recent starts): ensemble | With odds | home_win | log loss | 0.6209 | 0.6263 | 0.0054 | -0.0046 | 0.0157 | no clear difference |  |
| 51 selection prior (career games, recent starts): ensemble | With odds | margin | MAE | 13.4774 | 13.4633 | -0.0141 | -0.2094 | 0.1886 | no clear difference |  |
| 51 selection prior (career games, recent starts): ensemble | With odds | total | MAE | 10.7765 | 10.7817 | 0.0052 | -0.0488 | 0.0586 | no clear difference |  |
| 51 selection prior (career games, recent starts): linear | No odds | home_win | log loss | 0.6261 | 0.6272 | 0.0011 | -0.0121 | 0.0146 | no clear difference |  |
| 51 selection prior (career games, recent starts): linear | No odds | margin | MAE | 13.5628 | 13.5616 | -0.0011 | -0.2725 | 0.2784 | no clear difference |  |
| 51 selection prior (career games, recent starts): linear | No odds | total | MAE | 10.8072 | 10.8548 | 0.0476 | -0.0167 | 0.1134 | no clear difference |  |
| 51 selection prior (career games, recent starts): ensemble | No odds | home_win | log loss | 0.6255 | 0.6316 | 0.0061 | -0.0071 | 0.0191 | no clear difference |  |
| 51 selection prior (career games, recent starts): ensemble | No odds | margin | MAE | 13.5058 | 13.5102 | 0.0044 | -0.2421 | 0.2600 | no clear difference |  |
| 51 selection prior (career games, recent starts): ensemble | No odds | total | MAE | 10.8346 | 10.8431 | 0.0085 | -0.0462 | 0.0654 | no clear difference |  |
| 51 selection prior and previous-season prior (kappa 1): linear | With odds | home_win | log loss | 0.6209 | 0.6215 | 0.0007 | -0.0089 | 0.0106 | no clear difference |  |
| 51 selection prior and previous-season prior (kappa 1): linear | With odds | margin | MAE | 13.5340 | 13.4933 | -0.0408 | -0.2434 | 0.1668 | no clear difference |  |
| 51 selection prior and previous-season prior (kappa 1): linear | With odds | total | MAE | 10.7185 | 10.7259 | 0.0074 | -0.0587 | 0.0744 | no clear difference |  |
| 51 selection prior and previous-season prior (kappa 1): ensemble | With odds | home_win | log loss | 0.6209 | 0.6275 | 0.0066 | -0.0036 | 0.0170 | no clear difference |  |
| 51 selection prior and previous-season prior (kappa 1): ensemble | With odds | margin | MAE | 13.4774 | 13.4911 | 0.0136 | -0.1946 | 0.2282 | no clear difference |  |
| 51 selection prior and previous-season prior (kappa 1): ensemble | With odds | total | MAE | 10.7765 | 10.7908 | 0.0143 | -0.0452 | 0.0745 | no clear difference |  |
| 51 selection prior and previous-season prior (kappa 1): linear | No odds | home_win | log loss | 0.6261 | 0.6268 | 0.0007 | -0.0124 | 0.0142 | no clear difference |  |
| 51 selection prior and previous-season prior (kappa 1): linear | No odds | margin | MAE | 13.5628 | 13.5537 | -0.0091 | -0.2903 | 0.2777 | no clear difference |  |
| 51 selection prior and previous-season prior (kappa 1): linear | No odds | total | MAE | 10.8072 | 10.8102 | 0.0030 | -0.0653 | 0.0716 | no clear difference |  |
| 51 selection prior and previous-season prior (kappa 1): ensemble | No odds | home_win | log loss | 0.6255 | 0.6325 | 0.0070 | -0.0061 | 0.0201 | no clear difference |  |
| 51 selection prior and previous-season prior (kappa 1): ensemble | No odds | margin | MAE | 13.5058 | 13.5256 | 0.0198 | -0.2414 | 0.2831 | no clear difference |  |
| 51 selection prior and previous-season prior (kappa 1): ensemble | No odds | total | MAE | 10.8346 | 10.8016 | -0.0330 | -0.1038 | 0.0390 | no clear difference |  |

## The star blind spot (item 38)

Least-squares slope of (actual margin − the main ensemble's predicted margin) on the S2 stars out (home minus away), with a bootstrap 95% interval: the points a team loses beyond the prediction for each extra star missing. 0 means the model fully accounts for absences; negative means it under-reacts.

| variant | model | points per star out | ci_low | ci_high |
|---|---|---|---|---|
| current | With odds | -1.18 | -2.35 | 0.07 |
| current | No odds | -1.24 | -2.47 | 0.02 |
| 51 previous-season prior, kappa 0.5 | With odds | -1.18 | -2.34 | 0.07 |
| 51 previous-season prior, kappa 0.5 | No odds | -1.29 | -2.52 | -0.01 |
| 51 previous-season prior, kappa 1 | With odds | -1.12 | -2.27 | 0.15 |
| 51 previous-season prior, kappa 1 | No odds | -1.24 | -2.44 | 0.05 |
| 51 selection prior (career games, recent starts) | With odds | -1.14 | -2.28 | 0.12 |
| 51 selection prior (career games, recent starts) | No odds | -1.19 | -2.36 | 0.06 |
| 51 selection prior and previous-season prior (kappa 1) | With odds | -1.15 | -2.30 | 0.09 |
| 51 selection prior and previous-season prior (kappa 1) | No odds | -1.21 | -2.41 | 0.02 |

## How much the rating changed

| variant | corr. with current diff_rapm_total | corr. with margin | current's corr. with margin |
|---|---|---|---|
| 51 previous-season prior, kappa 0.5 | 0.944 | 0.361 | 0.351 |
| 51 previous-season prior, kappa 1 | 0.790 | 0.337 | 0.351 |
| 51 selection prior (career games, recent starts) | 0.613 | 0.354 | 0.351 |
| 51 selection prior and previous-season prior (kappa 1) | 0.678 | 0.380 | 0.351 |
