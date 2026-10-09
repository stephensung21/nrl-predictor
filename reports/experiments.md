# Experiments on the 2023–2025 backtest

Each idea is compared with the current model on the same 631 games. `diff` is new minus baseline (negative = better); the interval is a paired bootstrap 95% interval. Linear models unless stated; settings an idea needs are chosen inside each backtest year from earlier seasons.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 1a win prob from margin | With odds | home_win | log loss | 0.6305 | 0.6252 | -0.0052 | -0.0157 | 0.0047 | no clear difference |  |
| 1a blend: logistic + margin | With odds | home_win | log loss | 0.6305 | 0.6257 | -0.0047 | -0.0104 | 0.0005 | no clear difference |  |
| 1a win prob from margin | No odds | home_win | log loss | 0.6334 | 0.6301 | -0.0032 | -0.0132 | 0.0062 | no clear difference |  |
| 1a blend: logistic + margin | No odds | home_win | log loss | 0.6334 | 0.6299 | -0.0035 | -0.0089 | 0.0015 | no clear difference |  |
| 1b market offset + no-odds features | With odds | home_win | log loss | 0.6305 | 0.6304 | -0.0000 | -0.0072 | 0.0070 | no clear difference |  |
| 1c recency weights (half-life 1 season) | With odds | home_win | log loss | 0.6305 | 0.6288 | -0.0017 | -0.0053 | 0.0018 | no clear difference |  |
| 1c recency weights (half-life 1 season) | With odds | margin | MAE | 13.5866 | 13.5309 | -0.0557 | -0.1326 | 0.0203 | no clear difference |  |
| 1c recency weights (half-life 1 season) | With odds | total | MAE | 10.7185 | 10.7825 | 0.0640 | -0.0069 | 0.1371 | no clear difference |  |
| 1c recency weights (half-life 1 season) | No odds | home_win | log loss | 0.6334 | 0.6326 | -0.0007 | -0.0036 | 0.0021 | no clear difference |  |
| 1c recency weights (half-life 1 season) | No odds | margin | MAE | 13.6034 | 13.5759 | -0.0275 | -0.0822 | 0.0276 | no clear difference |  |
| 1c recency weights (half-life 1 season) | No odds | total | MAE | 10.8072 | 10.8180 | 0.0107 | -0.0419 | 0.0622 | no clear difference |  |
| 1c recency weights (half-life 2 season) | With odds | home_win | log loss | 0.6305 | 0.6294 | -0.0011 | -0.0031 | 0.0008 | no clear difference |  |
| 1c recency weights (half-life 2 season) | With odds | margin | MAE | 13.5866 | 13.5500 | -0.0366 | -0.0776 | 0.0042 | no clear difference |  |
| 1c recency weights (half-life 2 season) | With odds | total | MAE | 10.7185 | 10.7585 | 0.0399 | -0.0110 | 0.0931 | no clear difference |  |
| 1c recency weights (half-life 2 season) | No odds | home_win | log loss | 0.6334 | 0.6328 | -0.0005 | -0.0021 | 0.0010 | no clear difference |  |
| 1c recency weights (half-life 2 season) | No odds | margin | MAE | 13.6034 | 13.5799 | -0.0235 | -0.0495 | 0.0016 | no clear difference |  |
| 1c recency weights (half-life 2 season) | No odds | total | MAE | 10.8072 | 10.8126 | 0.0054 | -0.0240 | 0.0343 | no clear difference |  |
| 1d Elo retuned 2013..year-1 | With odds | home_win | log loss | 0.6305 | 0.6309 | 0.0004 | -0.0001 | 0.0009 | no clear difference |  |
| 1d Elo retuned 2013..year-1 | With odds | margin | MAE | 13.5866 | 13.5913 | 0.0046 | -0.0032 | 0.0127 | no clear difference |  |
| 1d Elo retuned 2013..year-1 | No odds | home_win | log loss | 0.6334 | 0.6344 | 0.0011 | 0.0001 | 0.0021 | worse |  |
| 1d Elo retuned 2013..year-1 | No odds | margin | MAE | 13.6034 | 13.6163 | 0.0129 | -0.0068 | 0.0327 | no clear difference |  |
| 1d Elo retuned 2020..year-1 | With odds | home_win | log loss | 0.6305 | 0.6317 | 0.0012 | -0.0001 | 0.0025 | no clear difference |  |
| 1d Elo retuned 2020..year-1 | With odds | margin | MAE | 13.5866 | 13.6036 | 0.0170 | -0.0052 | 0.0392 | no clear difference |  |
| 1d Elo retuned 2020..year-1 | No odds | home_win | log loss | 0.6334 | 0.6366 | 0.0032 | 0.0005 | 0.0062 | worse |  |
| 1d Elo retuned 2020..year-1 | No odds | margin | MAE | 13.6034 | 13.6485 | 0.0451 | -0.0149 | 0.1057 | no clear difference |  |
| 3 + team margin rating | With odds | home_win | log loss | 0.6305 | 0.6269 | -0.0036 | -0.0076 | 0.0003 | no clear difference |  |
| 3 + team margin rating | With odds | margin | MAE | 13.5866 | 13.6080 | 0.0214 | -0.0402 | 0.0824 | no clear difference |  |
| 3 + team margin rating | No odds | home_win | log loss | 0.6334 | 0.6285 | -0.0049 | -0.0103 | 0.0004 | no clear difference |  |
| 3 + team margin rating | No odds | margin | MAE | 13.6034 | 13.5954 | -0.0080 | -0.1175 | 0.0993 | no clear difference |  |
| 3 team margin rating instead of Elo | With odds | home_win | log loss | 0.6305 | 0.6267 | -0.0037 | -0.0077 | 0.0003 | no clear difference |  |
| 3 team margin rating instead of Elo | With odds | margin | MAE | 13.5866 | 13.6030 | 0.0164 | -0.0556 | 0.0854 | no clear difference |  |
| 3 team margin rating instead of Elo | No odds | home_win | log loss | 0.6334 | 0.6289 | -0.0044 | -0.0113 | 0.0024 | no clear difference |  |
| 3 team margin rating instead of Elo | No odds | margin | MAE | 13.6034 | 13.6233 | 0.0199 | -0.1251 | 0.1696 | no clear difference |  |
| 3 + team rating + team home advantage | With odds | home_win | log loss | 0.6305 | 0.6287 | -0.0017 | -0.0049 | 0.0012 | no clear difference |  |
| 3 + team rating + team home advantage | With odds | margin | MAE | 13.5866 | 13.6089 | 0.0223 | -0.0595 | 0.1002 | no clear difference |  |
| 3 + team rating + team home advantage | No odds | home_win | log loss | 0.6334 | 0.6307 | -0.0027 | -0.0070 | 0.0016 | no clear difference |  |
| 3 + team rating + team home advantage | No odds | margin | MAE | 13.6034 | 13.6099 | 0.0066 | -0.0919 | 0.0995 | no clear difference |  |
| 4 + adjusted net points | With odds | home_win | log loss | 0.6305 | 0.6310 | 0.0005 | -0.0005 | 0.0016 | no clear difference |  |
| 4 + adjusted net points | With odds | margin | MAE | 13.5866 | 13.6163 | 0.0297 | -0.0283 | 0.0914 | no clear difference |  |
| 4 + adjusted net points | With odds | total | MAE | 10.7185 | 10.7260 | 0.0075 | -0.0105 | 0.0258 | no clear difference |  |
| 4 + adjusted net points | No odds | home_win | log loss | 0.6334 | 0.6349 | 0.0015 | -0.0001 | 0.0032 | no clear difference |  |
| 4 + adjusted net points | No odds | margin | MAE | 13.6034 | 13.6450 | 0.0417 | -0.0317 | 0.1191 | no clear difference |  |
| 4 + adjusted net points | No odds | total | MAE | 10.8072 | 10.8009 | -0.0063 | -0.0422 | 0.0312 | no clear difference |  |
| 4 + all adjusted form | With odds | home_win | log loss | 0.6305 | 0.6343 | 0.0038 | -0.0051 | 0.0126 | no clear difference |  |
| 4 + all adjusted form | With odds | margin | MAE | 13.5866 | 13.7500 | 0.1634 | 0.0017 | 0.3198 | worse |  |
| 4 + all adjusted form | With odds | total | MAE | 10.7185 | 10.7260 | 0.0075 | -0.0105 | 0.0258 | no clear difference |  |
| 4 + all adjusted form | No odds | home_win | log loss | 0.6334 | 0.6433 | 0.0099 | -0.0010 | 0.0209 | no clear difference |  |
| 4 + all adjusted form | No odds | margin | MAE | 13.6034 | 13.8628 | 0.2594 | 0.0491 | 0.4627 | worse |  |
| 4 + all adjusted form | No odds | total | MAE | 10.8072 | 10.8009 | -0.0063 | -0.0422 | 0.0312 | no clear difference |  |
| 5 ensemble: logit average | With odds | home_win | log loss | 0.6280 | 0.6320 | 0.0040 | 0.0007 | 0.0076 | worse | baseline = current 50/50 ensemble |
| 5 ensemble: stacked (learned on earlier seasons) | With odds | home_win | log loss | 0.6280 | 0.6323 | 0.0043 | -0.0039 | 0.0125 | no clear difference | baseline = current 50/50 ensemble |
| 5 ensemble: logit average | No odds | home_win | log loss | 0.6281 | 0.6318 | 0.0037 | 0.0003 | 0.0075 | worse | baseline = current 50/50 ensemble |
| 5 ensemble: stacked (learned on earlier seasons) | No odds | home_win | log loss | 0.6281 | 0.6342 | 0.0061 | -0.0006 | 0.0126 | no clear difference | baseline = current 50/50 ensemble |
| 5 ensemble of all four: logit average | With odds | home_win | log loss | 0.6280 | 0.6306 | 0.0026 | -0.0025 | 0.0077 | no clear difference | baseline = current with-odds ensemble |
| 5 ensemble of all four: stacked (learned on earlier seasons) | With odds | home_win | log loss | 0.6280 | 0.6331 | 0.0051 | -0.0035 | 0.0137 | no clear difference | baseline = current with-odds ensemble |
| 6 combined: team rating + margin blend | With odds | home_win | log loss | 0.6305 | 0.6243 | -0.0062 | -0.0128 | -0.0001 | better |  |
| 6 combined: team rating + margin blend | No odds | home_win | log loss | 0.6334 | 0.6275 | -0.0058 | -0.0127 | 0.0003 | no clear difference |  |

## Probabilistic margin and total vs the opening line and total

Log loss on whether the home side covered the opening line / the total went over the opening total (pushes excluded). The market is 50% on both by construction, so `vs_50pct` < 0 means the model priced these markets better than a coin flip. Break-even hit rate at $1.91 is 52.4%.

| model | market | spread | games | log_loss | vs_50pct | ci_low | ci_high | hit_rate | bets_p>55% | hit_rate_p>55% |
|---|---|---|---|---|---|---|---|---|---|---|
| With odds | line | normal, constant spread | 631 | 0.6923 | -0.0009 | -0.0103 | 0.0088 | 0.5261 | 251 | 0.5339 |
| With odds | line | normal, varying spread | 631 | 0.6927 | -0.0005 | -0.0101 | 0.0095 | 0.5261 | 259 | 0.5367 |
| With odds | line | t, constant spread | 631 | 0.6928 | -0.0004 | -0.0105 | 0.0100 | 0.5261 | 269 | 0.5353 |
| With odds | total | normal, constant spread | 631 | 0.6888 | -0.0043 | -0.0175 | 0.0092 | 0.5452 | 295 | 0.5763 |
| With odds | total | normal, varying spread | 631 | 0.6888 | -0.0044 | -0.0173 | 0.0089 | 0.5452 | 307 | 0.5863 |
| With odds | total | t, constant spread | 631 | 0.6889 | -0.0042 | -0.0174 | 0.0093 | 0.5452 | 304 | 0.5855 |
| No odds | line | normal, constant spread | 631 | 0.6938 | 0.0006 | -0.0142 | 0.0161 | 0.5388 | 364 | 0.5302 |
| No odds | line | normal, varying spread | 631 | 0.6946 | 0.0014 | -0.0139 | 0.0173 | 0.5388 | 371 | 0.5364 |
| No odds | line | t, constant spread | 631 | 0.6950 | 0.0018 | -0.0140 | 0.0182 | 0.5388 | 374 | 0.5374 |
| No odds | total | normal, constant spread | 631 | 0.6979 | 0.0048 | -0.0128 | 0.0226 | 0.5341 | 422 | 0.5498 |
| No odds | total | normal, varying spread | 631 | 0.6977 | 0.0046 | -0.0127 | 0.0221 | 0.5341 | 423 | 0.5508 |
| No odds | total | t, constant spread | 631 | 0.6981 | 0.0050 | -0.0126 | 0.0229 | 0.5341 | 423 | 0.5485 |
