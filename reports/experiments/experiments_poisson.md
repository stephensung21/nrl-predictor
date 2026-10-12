# Poisson ratings and score model (2023–2025 backtest)

## Do the scores fit a Poisson?

Per team and game, 1407 games since the six-again restart. Dispersion after team strength: a Poisson model with each team's attack and defence per season and home advantage (1 = Poisson).

| per team-game | score | tries |
|---|---|---|
| mean | 22.7249 | 3.9662 |
| variance | 147.2826 | 4.5721 |
| variance / mean | 6.4811 | 1.1527 |
| Pearson dispersion after team strength | 5.1009 | 0.9141 |

Home and away tries are negatively correlated: -0.306, and -0.211 after team strength (an independent double-Poisson assumes 0).

Players with 30+ games of 20+ minutes (471 players), tries per game against Poisson at the player's own rate × minutes / 80:

| tries in a game | observed | Poisson expected |
|---|---|---|
| 0 | 32241 | 32264 |
| 1 | 6890 | 6867 |
| 2 | 1279 | 1264 |
| 3+ | 231 | 246 |

## Poisson ratings as features

- Player ratings: Poisson regression of each team's tries (or quasi-Poisson on points) on its players' attack and the opposing players' defence, weighted by minutes, refitted before each round with a 90-day half-life (as RAPM).
- Team rating: multiplicative (Maher) attack/defence model on points since 2009, refitted weekly with a two-year half-life (as the team margin rating).
- Features: log(expected home / expected away), and expected home + away for the totals model. Penalties chosen on 2021–22 Poisson deviance:

| model | penalty | deviance 2021-22 |
|---|---|---|
| team | 0.0010 | 6.2722 |
| team | 0.0100 | 6.2749 |
| tries | 0.1000 | 1.1812 |
| tries | 0.3000 | 1.1367 |
| tries | 1 | 1.1469 |
| tries | 3 | 1.2118 |
| points | 0.3000 | 6.4871 |
| points | 1 | 6.0010 |
| points | 3 | 5.9060 |
| points | 10 | 6.1630 |

Correlations on the backtest games:

| feature | diff_ptries | diff_ppoints | diff_tpois | diff_rapm_total | team_margin | elo_logit | margin |
|---|---|---|---|---|---|---|---|
| diff_ptries | 1 | 0.98 | 0.57 | 0.92 | 0.57 | 0.81 | 0.33 |
| diff_ppoints | 0.98 | 1 | 0.61 | 0.94 | 0.61 | 0.85 | 0.33 |
| diff_tpois | 0.57 | 0.61 | 1 | 0.62 | 0.99 | 0.81 | 0.31 |

Full pipeline backtest, main ensembles. `diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 49 Poisson tries player rating added: ensemble | With odds | home_win | log loss | 0.6209 | 0.6209 | 0.0000 | -0.0017 | 0.0017 | no clear difference |  |
| 49 Poisson tries player rating added: ensemble | With odds | margin | MAE | 13.4774 | 13.4827 | 0.0053 | -0.0421 | 0.0522 | no clear difference |  |
| 49 Poisson tries player rating added: ensemble | With odds | total | MAE | 10.7765 | 10.7752 | -0.0013 | -0.0203 | 0.0184 | no clear difference |  |
| 49 Poisson tries player rating added: ensemble | No odds | home_win | log loss | 0.6255 | 0.6259 | 0.0004 | -0.0020 | 0.0028 | no clear difference |  |
| 49 Poisson tries player rating added: ensemble | No odds | margin | MAE | 13.5058 | 13.4954 | -0.0104 | -0.0861 | 0.0659 | no clear difference |  |
| 49 Poisson tries player rating added: ensemble | No odds | total | MAE | 10.8346 | 10.8052 | -0.0294 | -0.0846 | 0.0282 | no clear difference |  |
| 49 Poisson tries rating replaces RAPM: ensemble | With odds | home_win | log loss | 0.6209 | 0.6248 | 0.0039 | -0.0018 | 0.0093 | no clear difference |  |
| 49 Poisson tries rating replaces RAPM: ensemble | With odds | margin | MAE | 13.4774 | 13.5279 | 0.0504 | -0.0463 | 0.1462 | no clear difference |  |
| 49 Poisson tries rating replaces RAPM: ensemble | With odds | total | MAE | 10.7765 | 10.7769 | 0.0004 | -0.0240 | 0.0250 | no clear difference |  |
| 49 Poisson tries rating replaces RAPM: ensemble | No odds | home_win | log loss | 0.6255 | 0.6299 | 0.0044 | -0.0032 | 0.0118 | no clear difference |  |
| 49 Poisson tries rating replaces RAPM: ensemble | No odds | margin | MAE | 13.5058 | 13.5513 | 0.0454 | -0.1027 | 0.1904 | no clear difference |  |
| 49 Poisson tries rating replaces RAPM: ensemble | No odds | total | MAE | 10.8346 | 10.8300 | -0.0046 | -0.0177 | 0.0081 | no clear difference |  |
| 49 quasi-Poisson points player rating added: ensemble | With odds | home_win | log loss | 0.6209 | 0.6213 | 0.0004 | -0.0014 | 0.0021 | no clear difference |  |
| 49 quasi-Poisson points player rating added: ensemble | With odds | margin | MAE | 13.4774 | 13.5002 | 0.0228 | -0.0127 | 0.0581 | no clear difference |  |
| 49 quasi-Poisson points player rating added: ensemble | With odds | total | MAE | 10.7765 | 10.7624 | -0.0141 | -0.0330 | 0.0048 | no clear difference |  |
| 49 quasi-Poisson points player rating added: ensemble | No odds | home_win | log loss | 0.6255 | 0.6265 | 0.0009 | -0.0015 | 0.0034 | no clear difference |  |
| 49 quasi-Poisson points player rating added: ensemble | No odds | margin | MAE | 13.5058 | 13.5173 | 0.0115 | -0.0465 | 0.0693 | no clear difference |  |
| 49 quasi-Poisson points player rating added: ensemble | No odds | total | MAE | 10.8346 | 10.7988 | -0.0358 | -0.0932 | 0.0218 | no clear difference |  |
| 49 quasi-Poisson points rating replaces RAPM: ensemble | With odds | home_win | log loss | 0.6209 | 0.6246 | 0.0037 | -0.0022 | 0.0094 | no clear difference |  |
| 49 quasi-Poisson points rating replaces RAPM: ensemble | With odds | margin | MAE | 13.4774 | 13.5576 | 0.0802 | -0.0109 | 0.1704 | no clear difference |  |
| 49 quasi-Poisson points rating replaces RAPM: ensemble | With odds | total | MAE | 10.7765 | 10.7792 | 0.0027 | -0.0212 | 0.0269 | no clear difference |  |
| 49 quasi-Poisson points rating replaces RAPM: ensemble | No odds | home_win | log loss | 0.6255 | 0.6305 | 0.0050 | -0.0025 | 0.0122 | no clear difference |  |
| 49 quasi-Poisson points rating replaces RAPM: ensemble | No odds | margin | MAE | 13.5058 | 13.5852 | 0.0794 | -0.0552 | 0.2145 | no clear difference |  |
| 49 quasi-Poisson points rating replaces RAPM: ensemble | No odds | total | MAE | 10.8346 | 10.8243 | -0.0103 | -0.0392 | 0.0187 | no clear difference |  |
| 49 Poisson team rating added: ensemble | With odds | home_win | log loss | 0.6209 | 0.6211 | 0.0002 | -0.0018 | 0.0021 | no clear difference |  |
| 49 Poisson team rating added: ensemble | With odds | margin | MAE | 13.4774 | 13.4999 | 0.0225 | -0.0229 | 0.0659 | no clear difference |  |
| 49 Poisson team rating added: ensemble | With odds | total | MAE | 10.7765 | 10.8019 | 0.0254 | -0.0350 | 0.0851 | no clear difference |  |
| 49 Poisson team rating added: ensemble | No odds | home_win | log loss | 0.6255 | 0.6248 | -0.0007 | -0.0032 | 0.0017 | no clear difference |  |
| 49 Poisson team rating added: ensemble | No odds | margin | MAE | 13.5058 | 13.4845 | -0.0214 | -0.0880 | 0.0428 | no clear difference |  |
| 49 Poisson team rating added: ensemble | No odds | total | MAE | 10.8346 | 10.8685 | 0.0339 | -0.0397 | 0.1071 | no clear difference |  |
| 49 Poisson team rating replaces team margin: ensemble | With odds | home_win | log loss | 0.6209 | 0.6211 | 0.0002 | -0.0013 | 0.0018 | no clear difference |  |
| 49 Poisson team rating replaces team margin: ensemble | With odds | margin | MAE | 13.4774 | 13.4871 | 0.0096 | -0.0318 | 0.0503 | no clear difference |  |
| 49 Poisson team rating replaces team margin: ensemble | With odds | total | MAE | 10.7765 | 10.7738 | -0.0027 | -0.0225 | 0.0176 | no clear difference |  |
| 49 Poisson team rating replaces team margin: ensemble | No odds | home_win | log loss | 0.6255 | 0.6250 | -0.0005 | -0.0025 | 0.0015 | no clear difference |  |
| 49 Poisson team rating replaces team margin: ensemble | No odds | margin | MAE | 13.5058 | 13.4828 | -0.0230 | -0.0841 | 0.0365 | no clear difference |  |
| 49 Poisson team rating replaces team margin: ensemble | No odds | total | MAE | 10.8346 | 10.8313 | -0.0033 | -0.0102 | 0.0036 | no clear difference |  |
| 49 Poisson tries rating, LightGBM only: ensemble | With odds | home_win | log loss | 0.6209 | 0.6208 | -0.0001 | -0.0011 | 0.0009 | no clear difference |  |
| 49 Poisson tries rating, LightGBM only: ensemble | With odds | margin | MAE | 13.4774 | 13.4777 | 0.0002 | -0.0240 | 0.0244 | no clear difference |  |
| 49 Poisson tries rating, LightGBM only: ensemble | With odds | total | MAE | 10.7765 | 10.7706 | -0.0059 | -0.0285 | 0.0164 | no clear difference |  |
| 49 Poisson tries rating, LightGBM only: ensemble | No odds | home_win | log loss | 0.6255 | 0.6252 | -0.0003 | -0.0017 | 0.0011 | no clear difference |  |
| 49 Poisson tries rating, LightGBM only: ensemble | No odds | margin | MAE | 13.5058 | 13.4941 | -0.0118 | -0.0499 | 0.0261 | no clear difference |  |
| 49 Poisson tries rating, LightGBM only: ensemble | No odds | total | MAE | 10.8346 | 10.8226 | -0.0120 | -0.0355 | 0.0119 | no clear difference |  |

## Poisson score distribution instead of the Normal

The with-odds ensemble's backtest margin and total are turned into expected tries per team, and each team's points built from Poisson tries, 75% conversions, Poisson penalty goals (0.41 a game) and field goals (0.06). tau adds a shared game effect for the negative correlation between the sides. Win = P(margin > 0) without draws; cover = P(home beats the opening line), pushes excluded.

| model | win log loss | cover log loss |
|---|---|---|
| Poisson tries, tau 0.0 | 0.6215 | 0.6854 |
| Poisson tries, tau 0.1 | 0.6213 | 0.6855 |
| Poisson tries, tau 0.15 | 0.6212 | 0.6855 |
| Poisson tries, tau 0.2 | 0.6214 | 0.6856 |
| Poisson tries, tau 0.25 | 0.6221 | 0.6857 |
| Poisson tries, tau 0.3 | 0.6231 | 0.6859 |
| Normal (sigma 16.1 win, 18.3 cover; fitted on these games) | 0.6212 | 0.6871 |

Best Poisson against the Normal (paired bootstrap; negative = Poisson better):

| probability | best tau | games | diff | ci_low | ci_high |
|---|---|---|---|---|---|
| win | 0.1500 | 631 | 0.0000 | -0.0010 | 0.0010 |
| cover | 0.0000 | 631 | -0.0017 | -0.0039 | 0.0004 |

How often the final margin lands on each value:

| |margin| | observed | Poisson | Normal |
|---|---|---|---|
| 1 | 0.051 | 0.010 | 0.049 |
| 2 | 0.097 | 0.080 | 0.049 |
| 3 | 0.002 | 0.009 | 0.048 |
| 4 | 0.095 | 0.079 | 0.048 |
| 5 | 0.005 | 0.009 | 0.047 |
| 6 | 0.068 | 0.080 | 0.046 |
| 7 | 0.011 | 0.009 | 0.045 |
| 8 | 0.084 | 0.072 | 0.043 |
