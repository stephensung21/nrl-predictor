# Shin margin removal (item 42)

Shin's method takes more of the bookmaker's margin off the longshot than the proportional method (it models favourite-longshot bias). Compared two ways.

## As the market benchmark

The market's log loss with each method; `diff` is Shin minus proportional (negative = Shin better), with a paired bootstrap 95% interval. No fitting involved.

| market | seasons | games | proportional | Shin | diff | ci_low | ci_high |
|---|---|---|---|---|---|---|---|
| opening | 2021-2025 | 1033 | 0.6005 | 0.5997 | -0.0008 | -0.0022 | 0.0007 |
| opening | 2023-2025 | 631 | 0.6331 | 0.6336 | 0.0006 | -0.0012 | 0.0024 |
| closing (reliable games) | 2021-2025 | 672 | 0.5590 | 0.5579 | -0.0011 | -0.0030 | 0.0011 |
| closing (reliable games) | 2023-2025 | 271 | 0.5881 | 0.5872 | -0.0009 | -0.0032 | 0.0016 |
| Odds Portal average | 2021-2025 | 1033 | 0.5878 | 0.5877 | -0.0001 | -0.0018 | 0.0018 |
| Odds Portal average | 2023-2025 | 631 | 0.6204 | 0.6212 | 0.0008 | -0.0009 | 0.0027 |

## As the with-odds models' input (2023-2025 backtest)

The opening log-odds (and the BlueBet interaction) computed with Shin's method, rerun through the full backtest. `diff` is new minus current (negative = better).

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 42 Shin opening odds as input: linear | With odds | home_win | log loss | 0.6209 | 0.6209 | 0.0000 | -0.0001 | 0.0001 | no clear difference |  |
| 42 Shin opening odds as input: linear | With odds | margin | MAE | 13.5340 | 13.5347 | 0.0006 | -0.0022 | 0.0037 | no clear difference |  |
| 42 Shin opening odds as input: linear | With odds | total | MAE | 10.7185 | 10.7187 | 0.0001 | -0.0002 | 0.0005 | no clear difference |  |
| 42 Shin opening odds as input: ensemble | With odds | home_win | log loss | 0.6220 | 0.6221 | 0.0001 | -0.0002 | 0.0003 | no clear difference |  |
| 42 Shin opening odds as input: ensemble | With odds | margin | MAE | 13.4944 | 13.4944 | 0.0001 | -0.0032 | 0.0033 | no clear difference |  |
| 42 Shin opening odds as input: ensemble | With odds | total | MAE | 10.7776 | 10.7789 | 0.0012 | -0.0004 | 0.0029 | no clear difference |  |
