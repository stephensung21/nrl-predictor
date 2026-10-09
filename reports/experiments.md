# Experiments on the 2023–2025 backtest

Each idea is compared with the current model on the same 631 games. `diff` is new minus baseline (negative = better); the interval is a paired bootstrap 95% interval. Linear models unless stated; settings an idea needs are chosen inside each backtest year from earlier seasons.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 1a win prob from margin | With odds | home_win | log loss | 0.6306 | 0.6253 | -0.0053 | -0.0156 | 0.0044 | no clear difference |  |
| 1a blend: logistic + margin | With odds | home_win | log loss | 0.6306 | 0.6258 | -0.0047 | -0.0104 | 0.0005 | no clear difference |  |
| 1a win prob from margin | No odds | home_win | log loss | 0.6332 | 0.6302 | -0.0030 | -0.0126 | 0.0061 | no clear difference |  |
| 1a blend: logistic + margin | No odds | home_win | log loss | 0.6332 | 0.6300 | -0.0032 | -0.0084 | 0.0016 | no clear difference |  |
| 1b market offset + no-odds features | With odds | home_win | log loss | 0.6306 | 0.6303 | -0.0003 | -0.0076 | 0.0068 | no clear difference |  |
| 1c recency weights (half-life 1 season) | With odds | home_win | log loss | 0.6306 | 0.6289 | -0.0017 | -0.0053 | 0.0018 | no clear difference |  |
| 1c recency weights (half-life 1 season) | With odds | margin | MAE | 13.5894 | 13.5329 | -0.0565 | -0.1316 | 0.0179 | no clear difference |  |
| 1c recency weights (half-life 1 season) | With odds | total | MAE | 10.7321 | 10.7820 | 0.0499 | -0.0014 | 0.1022 | no clear difference |  |
| 1c recency weights (half-life 1 season) | No odds | home_win | log loss | 0.6332 | 0.6325 | -0.0007 | -0.0036 | 0.0021 | no clear difference |  |
| 1c recency weights (half-life 1 season) | No odds | margin | MAE | 13.6112 | 13.5800 | -0.0312 | -0.0863 | 0.0241 | no clear difference |  |
| 1c recency weights (half-life 1 season) | No odds | total | MAE | 10.7977 | 10.8096 | 0.0119 | -0.0450 | 0.0681 | no clear difference |  |
| 1c recency weights (half-life 2 season) | With odds | home_win | log loss | 0.6306 | 0.6295 | -0.0011 | -0.0031 | 0.0008 | no clear difference |  |
| 1c recency weights (half-life 2 season) | With odds | margin | MAE | 13.5894 | 13.5524 | -0.0370 | -0.0771 | 0.0028 | no clear difference |  |
| 1c recency weights (half-life 2 season) | With odds | total | MAE | 10.7321 | 10.7575 | 0.0254 | -0.0036 | 0.0551 | no clear difference |  |
| 1c recency weights (half-life 2 season) | No odds | home_win | log loss | 0.6332 | 0.6327 | -0.0005 | -0.0021 | 0.0010 | no clear difference |  |
| 1c recency weights (half-life 2 season) | No odds | margin | MAE | 13.6112 | 13.5977 | -0.0135 | -0.0544 | 0.0275 | no clear difference |  |
| 1c recency weights (half-life 2 season) | No odds | total | MAE | 10.7977 | 10.8027 | 0.0050 | -0.0272 | 0.0366 | no clear difference |  |
| 1d Elo retuned 2013..year-1 | With odds | home_win | log loss | 0.6306 | 0.6310 | 0.0004 | -0.0001 | 0.0009 | no clear difference |  |
| 1d Elo retuned 2013..year-1 | With odds | margin | MAE | 13.5894 | 13.5937 | 0.0043 | -0.0037 | 0.0126 | no clear difference |  |
| 1d Elo retuned 2013..year-1 | No odds | home_win | log loss | 0.6332 | 0.6343 | 0.0011 | 0.0001 | 0.0021 | worse |  |
| 1d Elo retuned 2013..year-1 | No odds | margin | MAE | 13.6112 | 13.6227 | 0.0116 | -0.0083 | 0.0317 | no clear difference |  |
| 1d Elo retuned 2020..year-1 | With odds | home_win | log loss | 0.6306 | 0.6318 | 0.0012 | -0.0001 | 0.0026 | no clear difference |  |
| 1d Elo retuned 2020..year-1 | With odds | margin | MAE | 13.5894 | 13.6059 | 0.0165 | -0.0061 | 0.0394 | no clear difference |  |
| 1d Elo retuned 2020..year-1 | No odds | home_win | log loss | 0.6332 | 0.6365 | 0.0033 | 0.0005 | 0.0062 | worse |  |
| 1d Elo retuned 2020..year-1 | No odds | margin | MAE | 13.6112 | 13.6571 | 0.0459 | -0.0110 | 0.1021 | no clear difference |  |
| 3 + team margin rating | With odds | home_win | log loss | 0.6306 | 0.6269 | -0.0037 | -0.0076 | 0.0002 | no clear difference |  |
| 3 + team margin rating | With odds | margin | MAE | 13.5894 | 13.6128 | 0.0234 | -0.0402 | 0.0861 | no clear difference |  |
| 3 + team margin rating | No odds | home_win | log loss | 0.6332 | 0.6293 | -0.0039 | -0.0094 | 0.0014 | no clear difference |  |
| 3 + team margin rating | No odds | margin | MAE | 13.6112 | 13.6053 | -0.0059 | -0.1161 | 0.1019 | no clear difference |  |
| 3 team margin rating instead of Elo | With odds | home_win | log loss | 0.6306 | 0.6268 | -0.0038 | -0.0078 | 0.0002 | no clear difference |  |
| 3 team margin rating instead of Elo | With odds | margin | MAE | 13.5894 | 13.6089 | 0.0195 | -0.0547 | 0.0908 | no clear difference |  |
| 3 team margin rating instead of Elo | No odds | home_win | log loss | 0.6332 | 0.6287 | -0.0045 | -0.0114 | 0.0024 | no clear difference |  |
| 3 team margin rating instead of Elo | No odds | margin | MAE | 13.6112 | 13.6365 | 0.0254 | -0.1223 | 0.1739 | no clear difference |  |
| 3 + team rating + team home advantage | With odds | home_win | log loss | 0.6306 | 0.6287 | -0.0018 | -0.0050 | 0.0011 | no clear difference |  |
| 3 + team rating + team home advantage | With odds | margin | MAE | 13.5894 | 13.6127 | 0.0233 | -0.0575 | 0.1004 | no clear difference |  |
| 3 + team rating + team home advantage | No odds | home_win | log loss | 0.6332 | 0.6305 | -0.0027 | -0.0070 | 0.0016 | no clear difference |  |
| 3 + team rating + team home advantage | No odds | margin | MAE | 13.6112 | 13.6181 | 0.0070 | -0.0917 | 0.1006 | no clear difference |  |
| 4 + adjusted net points | With odds | home_win | log loss | 0.6306 | 0.6311 | 0.0005 | -0.0005 | 0.0016 | no clear difference |  |
| 4 + adjusted net points | With odds | margin | MAE | 13.5894 | 13.6244 | 0.0350 | -0.0273 | 0.1025 | no clear difference |  |
| 4 + adjusted net points | With odds | total | MAE | 10.7321 | 10.7392 | 0.0070 | -0.0154 | 0.0295 | no clear difference |  |
| 4 + adjusted net points | No odds | home_win | log loss | 0.6332 | 0.6347 | 0.0015 | -0.0002 | 0.0032 | no clear difference |  |
| 4 + adjusted net points | No odds | margin | MAE | 13.6112 | 13.6598 | 0.0486 | -0.0301 | 0.1328 | no clear difference |  |
| 4 + adjusted net points | No odds | total | MAE | 10.7977 | 10.8006 | 0.0029 | -0.0245 | 0.0310 | no clear difference |  |
| 4 + all adjusted form | With odds | home_win | log loss | 0.6306 | 0.6343 | 0.0037 | -0.0053 | 0.0124 | no clear difference |  |
| 4 + all adjusted form | With odds | margin | MAE | 13.5894 | 13.7520 | 0.1626 | 0.0051 | 0.3191 | worse |  |
| 4 + all adjusted form | With odds | total | MAE | 10.7321 | 10.7392 | 0.0070 | -0.0154 | 0.0295 | no clear difference |  |
| 4 + all adjusted form | No odds | home_win | log loss | 0.6332 | 0.6430 | 0.0098 | -0.0011 | 0.0206 | no clear difference |  |
| 4 + all adjusted form | No odds | margin | MAE | 13.6112 | 13.8626 | 0.2514 | 0.0432 | 0.4534 | worse |  |
| 4 + all adjusted form | No odds | total | MAE | 10.7977 | 10.8006 | 0.0029 | -0.0245 | 0.0310 | no clear difference |  |
| 5 ensemble: logit average | With odds | home_win | log loss | 0.6251 | 0.6289 | 0.0038 | 0.0005 | 0.0074 | worse | baseline = current 50/50 ensemble |
| 5 ensemble: stacked (learned on earlier seasons) | With odds | home_win | log loss | 0.6251 | 0.6289 | 0.0039 | -0.0027 | 0.0104 | no clear difference | baseline = current 50/50 ensemble |
| 5 ensemble: logit average | No odds | home_win | log loss | 0.6302 | 0.6333 | 0.0031 | -0.0000 | 0.0066 | no clear difference | baseline = current 50/50 ensemble |
| 5 ensemble: stacked (learned on earlier seasons) | No odds | home_win | log loss | 0.6302 | 0.6339 | 0.0037 | -0.0035 | 0.0107 | no clear difference | baseline = current 50/50 ensemble |
| 5 ensemble of all four: logit average | With odds | home_win | log loss | 0.6251 | 0.6298 | 0.0048 | -0.0002 | 0.0098 | no clear difference | baseline = current with-odds ensemble |
| 5 ensemble of all four: stacked (learned on earlier seasons) | With odds | home_win | log loss | 0.6251 | 0.6317 | 0.0067 | -0.0014 | 0.0145 | no clear difference | baseline = current with-odds ensemble |
| 6 combined: team rating + margin blend | With odds | home_win | log loss | 0.6306 | 0.6243 | -0.0062 | -0.0127 | -0.0002 | better |  |
| 6 combined: team rating + margin blend | No odds | home_win | log loss | 0.6332 | 0.6279 | -0.0053 | -0.0117 | 0.0005 | no clear difference |  |

## Probabilistic margin and total vs the opening line and total

Log loss on whether the home side covered the opening line / the total went over the opening total (pushes excluded). The market is 50% on both by construction, so `vs_50pct` < 0 means the model priced these markets better than a coin flip. Break-even hit rate at $1.91 is 52.4%.

| model | market | spread | games | log_loss | vs_50pct | ci_low | ci_high | hit_rate | bets_p>55% | hit_rate_p>55% |
|---|---|---|---|---|---|---|---|---|---|---|
| With odds | line | normal, constant spread | 631 | 0.6924 | -0.0007 | -0.0103 | 0.0091 | 0.5309 | 253 | 0.5375 |
| With odds | line | normal, varying spread | 631 | 0.6928 | -0.0003 | -0.0101 | 0.0097 | 0.5309 | 264 | 0.5341 |
| With odds | line | t, constant spread | 631 | 0.6929 | -0.0002 | -0.0104 | 0.0102 | 0.5309 | 276 | 0.5362 |
| With odds | total | normal, constant spread | 631 | 0.6894 | -0.0038 | -0.0169 | 0.0093 | 0.5452 | 308 | 0.5714 |
| With odds | total | normal, varying spread | 631 | 0.6892 | -0.0039 | -0.0167 | 0.0089 | 0.5452 | 319 | 0.5737 |
| With odds | total | t, constant spread | 631 | 0.6894 | -0.0037 | -0.0169 | 0.0094 | 0.5452 | 314 | 0.5701 |
| No odds | line | normal, constant spread | 631 | 0.6942 | 0.0011 | -0.0139 | 0.0166 | 0.5357 | 362 | 0.5276 |
| No odds | line | normal, varying spread | 631 | 0.6950 | 0.0019 | -0.0136 | 0.0178 | 0.5357 | 367 | 0.5313 |
| No odds | line | t, constant spread | 631 | 0.6955 | 0.0023 | -0.0136 | 0.0188 | 0.5357 | 374 | 0.5374 |
| No odds | total | normal, constant spread | 631 | 0.6975 | 0.0043 | -0.0136 | 0.0224 | 0.5404 | 431 | 0.5615 |
| No odds | total | normal, varying spread | 631 | 0.6973 | 0.0042 | -0.0133 | 0.0219 | 0.5404 | 430 | 0.5605 |
| No odds | total | t, constant spread | 631 | 0.6976 | 0.0045 | -0.0134 | 0.0227 | 0.5404 | 434 | 0.5599 |
