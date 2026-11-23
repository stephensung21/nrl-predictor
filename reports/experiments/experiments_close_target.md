# The closing price as the training target (item 50, 2023–2025 backtest)

For each backtest season, a ridge model of the closing price is fitted on earlier seasons only: `logit(p_avg)` (the Odds Portal closing average) on the linear win model's features (with or without the opening odds, as each variant), and `close_total` on the linear totals model's features. The penalty is chosen by walk-forward CV on the price, and the win probability is Platt-calibrated against the result on walk-forward out-of-fold predictions, as the pipeline does. It is then used alone, as a third member of the ensemble (equal thirds), or in place of the linear member. `baseline` is the current main ensemble; `diff` is new minus current (negative = better), with a paired bootstrap 95% interval. The last rows are the closing price itself, the ceiling (not usable before kickoff).

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 50 closing-price model alone | With odds | home_win | log loss | 0.6209 | 0.6247 | 0.0038 | -0.0044 | 0.0123 | no clear difference |  |
| 50 closing-price model as a third member | With odds | home_win | log loss | 0.6209 | 0.6208 | -0.0001 | -0.0027 | 0.0026 | no clear difference |  |
| 50 closing-price model instead of the linear member | With odds | home_win | log loss | 0.6209 | 0.6224 | 0.0015 | -0.0023 | 0.0056 | no clear difference |  |
| 50 closing-price model alone | With odds | total | MAE | 10.7765 | 10.7542 | -0.0223 | -0.1802 | 0.1376 | no clear difference |  |
| 50 closing-price model as a third member | With odds | total | MAE | 10.7765 | 10.7485 | -0.0279 | -0.0804 | 0.0256 | no clear difference |  |
| 50 closing-price model instead of the linear member | With odds | total | MAE | 10.7765 | 10.7974 | 0.0209 | -0.0613 | 0.1019 | no clear difference |  |
| 50 reference: the closing price itself (p_avg) | With odds | home_win | log loss | 0.6209 | 0.6204 | -0.0005 | -0.0139 | 0.0126 | no clear difference |  |
| 50 closing-price model alone | No odds | home_win | log loss | 0.6255 | 0.6289 | 0.0034 | -0.0050 | 0.0121 | no clear difference |  |
| 50 closing-price model as a third member | No odds | home_win | log loss | 0.6255 | 0.6253 | -0.0002 | -0.0028 | 0.0025 | no clear difference |  |
| 50 closing-price model instead of the linear member | No odds | home_win | log loss | 0.6255 | 0.6262 | 0.0007 | -0.0023 | 0.0039 | no clear difference |  |
| 50 closing-price model alone | No odds | total | MAE | 10.8346 | 10.7962 | -0.0385 | -0.1273 | 0.0520 | no clear difference |  |
| 50 closing-price model as a third member | No odds | total | MAE | 10.8346 | 10.8159 | -0.0187 | -0.0486 | 0.0116 | no clear difference |  |
| 50 closing-price model instead of the linear member | No odds | total | MAE | 10.8346 | 10.8404 | 0.0058 | -0.0386 | 0.0502 | no clear difference |  |
| 50 reference: the closing price itself (p_avg) | No odds | home_win | log loss | 0.6255 | 0.6204 | -0.0051 | -0.0216 | 0.0113 | no clear difference |  |

## Anticipating the price move

The betting use: the predicted move is the model's log-odds minus the opening log-odds, the actual move the closing average's minus the opening's. 'Move towards it' is how often the price moved in the direction the model disagreed with the opening price (item 41's measure).

| model | predictor | corr. with the price move | move towards it, all games | move towards it, largest 10% disagreements |
|---|---|---|---|---|
| With odds | current ensemble | 0.428 | 0.640 | 0.797 |
| With odds | closing-price model | 0.571 | 0.704 | 0.953 |
| With odds | third member | 0.504 | 0.672 | 0.859 |
| No odds | current ensemble | 0.378 | 0.612 | 0.703 |
| No odds | closing-price model | 0.484 | 0.664 | 0.812 |
| No odds | third member | 0.426 | 0.639 | 0.734 |

Flat 1-unit bets at the opening head-to-head price on the side whose edge (probability × price − 1) is over the threshold; closing line value is the closing implied probability minus the opening one for the side bet. The return interval is a bootstrap 95% interval over bets.

| model | predictor | edge over | bets | return per bet | ci_low | ci_high | closing line value |
|---|---|---|---|---|---|---|---|
| With odds | current ensemble | 0.020 | 378 | 0.176 | 0.068 | 0.284 | 0.045 |
| With odds | current ensemble | 0.050 | 271 | 0.151 | 0.009 | 0.291 | 0.055 |
| With odds | closing-price model | 0.020 | 372 | 0.129 | 0.040 | 0.216 | 0.056 |
| With odds | closing-price model | 0.050 | 248 | 0.180 | 0.065 | 0.297 | 0.069 |
| With odds | third member | 0.020 | 361 | 0.177 | 0.070 | 0.287 | 0.050 |
| With odds | third member | 0.050 | 246 | 0.155 | 0.017 | 0.294 | 0.062 |
| No odds | current ensemble | 0.020 | 423 | 0.113 | 0.008 | 0.217 | 0.046 |
| No odds | current ensemble | 0.050 | 346 | 0.129 | 0.011 | 0.252 | 0.054 |
| No odds | closing-price model | 0.020 | 442 | 0.076 | -0.022 | 0.175 | 0.051 |
| No odds | closing-price model | 0.050 | 362 | 0.119 | 0.005 | 0.231 | 0.057 |
| No odds | third member | 0.020 | 420 | 0.117 | 0.013 | 0.224 | 0.050 |
| No odds | third member | 0.050 | 335 | 0.150 | 0.032 | 0.270 | 0.057 |
