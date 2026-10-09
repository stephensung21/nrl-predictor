# Recalibration and the bookmaker change (2023–2025 backtest)

**Item 23:** the main models' final win probabilities are recalibrated for each season from 2024 using earlier backtest seasons' out-of-sample predictions (logit(p') = a + b·logit(p); slope only sets a = 0). 2023 has no earlier backtest season and is unchanged, so the 2024–25 rows are the fair comparison.

**Item 35:** opening prices come from bet365 until April 2024 and BlueBet after. The with-odds models get a BlueBet indicator and opening log-odds × BlueBet as extra inputs, run through the full pipeline backtest; 2025 (all BlueBet, with part of 2024 in training) is where it can show.

`diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 19 recalibration (slope only): linear, 2024-25 | With odds | home_win | log loss | 0.6366 | 0.6360 | -0.0007 | -0.0031 | 0.0016 | no clear difference |  |
| 19 recalibration (slope only): linear, 2023-25 | With odds | home_win | log loss | 0.6223 | 0.6219 | -0.0005 | -0.0021 | 0.0011 | no clear difference |  |
| 19 recalibration (slope and intercept): linear, 2024-25 | With odds | home_win | log loss | 0.6366 | 0.6381 | 0.0014 | -0.0027 | 0.0055 | no clear difference |  |
| 19 recalibration (slope and intercept): linear, 2023-25 | With odds | home_win | log loss | 0.6223 | 0.6233 | 0.0010 | -0.0018 | 0.0036 | no clear difference |  |
| 19 recalibration (slope only): ensemble, 2024-25 | With odds | home_win | log loss | 0.6334 | 0.6320 | -0.0014 | -0.0057 | 0.0027 | no clear difference |  |
| 19 recalibration (slope only): ensemble, 2023-25 | With odds | home_win | log loss | 0.6230 | 0.6220 | -0.0009 | -0.0038 | 0.0018 | no clear difference |  |
| 19 recalibration (slope and intercept): ensemble, 2024-25 | With odds | home_win | log loss | 0.6334 | 0.6345 | 0.0012 | -0.0046 | 0.0068 | no clear difference |  |
| 19 recalibration (slope and intercept): ensemble, 2023-25 | With odds | home_win | log loss | 0.6230 | 0.6238 | 0.0008 | -0.0031 | 0.0045 | no clear difference |  |
| 19 recalibration (slope only): linear, 2024-25 | No odds | home_win | log loss | 0.6374 | 0.6363 | -0.0011 | -0.0053 | 0.0030 | no clear difference |  |
| 19 recalibration (slope only): linear, 2023-25 | No odds | home_win | log loss | 0.6261 | 0.6254 | -0.0007 | -0.0035 | 0.0019 | no clear difference |  |
| 19 recalibration (slope and intercept): linear, 2024-25 | No odds | home_win | log loss | 0.6374 | 0.6375 | 0.0001 | -0.0046 | 0.0046 | no clear difference |  |
| 19 recalibration (slope and intercept): linear, 2023-25 | No odds | home_win | log loss | 0.6261 | 0.6262 | 0.0001 | -0.0030 | 0.0031 | no clear difference |  |
| 19 recalibration (slope only): ensemble, 2024-25 | No odds | home_win | log loss | 0.6345 | 0.6336 | -0.0009 | -0.0062 | 0.0043 | no clear difference |  |
| 19 recalibration (slope only): ensemble, 2023-25 | No odds | home_win | log loss | 0.6266 | 0.6260 | -0.0006 | -0.0042 | 0.0028 | no clear difference |  |
| 19 recalibration (slope and intercept): ensemble, 2024-25 | No odds | home_win | log loss | 0.6345 | 0.6355 | 0.0010 | -0.0051 | 0.0067 | no clear difference |  |
| 19 recalibration (slope and intercept): ensemble, 2023-25 | No odds | home_win | log loss | 0.6266 | 0.6272 | 0.0006 | -0.0034 | 0.0044 | no clear difference |  |
| 19 BlueBet inputs (with-odds models): linear | With odds | home_win | log loss | 0.6223 | 0.6209 | -0.0015 | -0.0057 | 0.0025 | no clear difference |  |
| 19 BlueBet inputs (with-odds models): linear | With odds | margin | MAE | 13.5470 | 13.5340 | -0.0130 | -0.0938 | 0.0702 | no clear difference |  |
| 19 BlueBet inputs (with-odds models): linear | With odds | total | MAE | 10.7185 | 10.7185 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 19 BlueBet inputs (with-odds models): ensemble | With odds | home_win | log loss | 0.6230 | 0.6220 | -0.0010 | -0.0036 | 0.0016 | no clear difference |  |
| 19 BlueBet inputs (with-odds models): ensemble | With odds | margin | MAE | 13.4924 | 13.4944 | 0.0020 | -0.0394 | 0.0447 | no clear difference |  |
| 19 BlueBet inputs (with-odds models): ensemble | With odds | total | MAE | 10.7696 | 10.7776 | 0.0080 | -0.0014 | 0.0179 | no clear difference |  |
| 19 BlueBet inputs (with-odds models): linear | No odds | home_win | log loss | 0.6261 | 0.6261 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 19 BlueBet inputs (with-odds models): linear | No odds | margin | MAE | 13.5628 | 13.5628 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 19 BlueBet inputs (with-odds models): linear | No odds | total | MAE | 10.8072 | 10.8072 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 19 BlueBet inputs (with-odds models): ensemble | No odds | home_win | log loss | 0.6266 | 0.6266 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 19 BlueBet inputs (with-odds models): ensemble | No odds | margin | MAE | 13.5158 | 13.5158 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 19 BlueBet inputs (with-odds models): ensemble | No odds | total | MAE | 10.8333 | 10.8333 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 19 BlueBet inputs: linear, 2025 only | With odds | home_win | log loss | 0.6419 | 0.6375 | -0.0044 | -0.0172 | 0.0072 | no clear difference |  |
| 19 BlueBet inputs: ensemble, 2025 only | With odds | home_win | log loss | 0.6414 | 0.6385 | -0.0029 | -0.0109 | 0.0044 | no clear difference |  |
