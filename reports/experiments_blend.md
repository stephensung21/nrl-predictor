# Learned blend with the market as a separate expert (2023–2025 backtest)

Item 39, after Levon Rush's Footy Tipper. **No odds go into any model.** The experts are the no-odds models (linear win, linear margin turned into a win probability, LightGBM win, and Elo) and, separately, the opening market (log-odds with the margin removed proportionally; the opening line and total for margin and total). For each backtest season, every expert's walk-forward out-of-sample predictions for 2022 to the season before (each season predicted by models trained on earlier seasons, with that backtest season's settings) are used to fit the blend, which then predicts the season.

- **Win:** p = sigmoid(a + Σ wᵢ·expertᵢ) with wᵢ ≥ 0, fitted by log loss. This is the same as weights that sum to 1 followed by Platt calibration; the table shows each expert's share of the weight and the calibration slope (the sum).
- **Margin and total:** intercept + weights that are non-negative and sum to 1, fitted by least squares.
- **One-weight blend:** the current no-odds ensemble's (calibrated) probability and the opening market, averaged on the log-odds scale, with the market's weight chosen on the earlier backtest seasons (so scored on 2024–25 only).

## Pooled scores (631 games)

| model | log_loss | accuracy | margin_mae | total_mae |
|---|---|---|---|---|
| Current: with odds ensemble | 0.6220 | 0.6434 | 13.4944 | 10.7776 |
| Current: no odds ensemble | 0.6266 | 0.6387 | 13.5158 | 10.8333 |
| Blend: no-odds models only | 0.6301 | 0.6339 | 13.5423 | 10.8767 |
| Blend: no-odds models + market | 0.6300 | 0.6387 | 13.5345 | 10.7631 |
| Blend: no-odds linear + LightGBM + market | 0.6302 | 0.6355 | 13.5345 | 10.7631 |
| Market opening | 0.6331 | 0.6434 | 13.6616 | 10.8439 |
| Market average (closing) | 0.6204 | 0.6513 | - | - |

## Each blend against the current main models

`diff` is the blend minus the current model (negative = blend better), with a paired bootstrap 95% interval.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 39 blend: no-odds models only vs with odds ensemble | With odds | home_win | log loss | 0.6220 | 0.6301 | 0.0081 | 0.0007 | 0.0158 | worse |  |
| 39 blend: no-odds models only vs with odds ensemble | With odds | margin | MAE | 13.4944 | 13.5423 | 0.0479 | -0.1268 | 0.2273 | no clear difference |  |
| 39 blend: no-odds models only vs with odds ensemble | With odds | total | MAE | 10.7776 | 10.8767 | 0.0991 | -0.0649 | 0.2599 | no clear difference |  |
| 39 blend: no-odds models only vs no odds ensemble | No odds | home_win | log loss | 0.6266 | 0.6301 | 0.0036 | -0.0002 | 0.0076 | no clear difference |  |
| 39 blend: no-odds models only vs no odds ensemble | No odds | margin | MAE | 13.5158 | 13.5423 | 0.0265 | -0.0907 | 0.1469 | no clear difference |  |
| 39 blend: no-odds models only vs no odds ensemble | No odds | total | MAE | 10.8333 | 10.8767 | 0.0434 | -0.0905 | 0.1727 | no clear difference |  |
| 39 blend: no-odds models + market vs with odds ensemble | With odds | home_win | log loss | 0.6220 | 0.6300 | 0.0080 | 0.0024 | 0.0139 | worse |  |
| 39 blend: no-odds models + market vs with odds ensemble | With odds | margin | MAE | 13.4944 | 13.5345 | 0.0401 | -0.0858 | 0.1678 | no clear difference |  |
| 39 blend: no-odds models + market vs with odds ensemble | With odds | total | MAE | 10.7776 | 10.7631 | -0.0145 | -0.1231 | 0.0945 | no clear difference |  |
| 39 blend: no-odds models + market vs no odds ensemble | No odds | home_win | log loss | 0.6266 | 0.6300 | 0.0035 | -0.0032 | 0.0101 | no clear difference |  |
| 39 blend: no-odds models + market vs no odds ensemble | No odds | margin | MAE | 13.5158 | 13.5345 | 0.0187 | -0.1122 | 0.1467 | no clear difference |  |
| 39 blend: no-odds models + market vs no odds ensemble | No odds | total | MAE | 10.8333 | 10.7631 | -0.0702 | -0.2533 | 0.1200 | no clear difference |  |
| 39 blend: no-odds linear + LightGBM + market vs with odds ensemble | With odds | home_win | log loss | 0.6220 | 0.6302 | 0.0082 | 0.0022 | 0.0144 | worse |  |
| 39 blend: no-odds linear + LightGBM + market vs with odds ensemble | With odds | margin | MAE | 13.4944 | 13.5345 | 0.0401 | -0.0858 | 0.1678 | no clear difference |  |
| 39 blend: no-odds linear + LightGBM + market vs with odds ensemble | With odds | total | MAE | 10.7776 | 10.7631 | -0.0145 | -0.1231 | 0.0945 | no clear difference |  |
| 39 blend: no-odds linear + LightGBM + market vs no odds ensemble | No odds | home_win | log loss | 0.6266 | 0.6302 | 0.0036 | -0.0035 | 0.0108 | no clear difference |  |
| 39 blend: no-odds linear + LightGBM + market vs no odds ensemble | No odds | margin | MAE | 13.5158 | 13.5345 | 0.0187 | -0.1122 | 0.1467 | no clear difference |  |
| 39 blend: no-odds linear + LightGBM + market vs no odds ensemble | No odds | total | MAE | 10.8333 | 10.7631 | -0.0702 | -0.2533 | 0.1200 | no clear difference |  |
| 39 one-weight blend: no-odds ensemble + market vs with odds ensemble, 2024-25 | With odds | home_win | log loss | 0.6319 | 0.6376 | 0.0057 | -0.0010 | 0.0123 | no clear difference | market weight 2024: 0.65, 2025: 0.50 |
| 39 one-weight blend: no-odds ensemble + market vs no odds ensemble, 2024-25 | No odds | home_win | log loss | 0.6345 | 0.6376 | 0.0030 | -0.0075 | 0.0133 | no clear difference | market weight 2024: 0.65, 2025: 0.50 |

## Blend weights by season

Win: each expert's share of the total weight, and the calibration slope. Margin and total: the weights themselves (they sum to 1).

| blend | target | season | calibration slope | lin_win | lin_margin | gbm_win | elo | lin | gbm | market |
|---|---|---|---|---|---|---|---|---|
| no-odds models only | home_win | 2023 | 1.1520 | 0.0000 | 0.4620 | 0.4090 | 0.1290 | - | - | - |
| no-odds models only | margin | 2023 | - | - | - | - | - | 1 | 0.0000 | - |
| no-odds models only | total | 2023 | - | - | - | - | - | 0.1430 | 0.8570 | - |
| no-odds models + market | home_win | 2023 | 1.1700 | 0.0000 | 0.4290 | 0.3720 | 0.0280 | - | - | 0.1710 |
| no-odds models + market | margin | 2023 | - | - | - | - | - | 0.9060 | 0.0000 | 0.0940 |
| no-odds models + market | total | 2023 | - | - | - | - | - | 0.1310 | 0.3360 | 0.5330 |
| no-odds linear + LightGBM + market | home_win | 2023 | 1.1710 | 0.4570 | - | 0.3500 | - | - | - | 0.1930 |
| no-odds linear + LightGBM + market | margin | 2023 | - | - | - | - | - | 0.9060 | 0.0000 | 0.0940 |
| no-odds linear + LightGBM + market | total | 2023 | - | - | - | - | - | 0.1310 | 0.3360 | 0.5330 |
| no-odds models only | home_win | 2024 | 1.0940 | 0.0000 | 0.6740 | 0.3030 | 0.0230 | - | - | - |
| no-odds models only | margin | 2024 | - | - | - | - | - | 0.9560 | 0.0440 | - |
| no-odds models only | total | 2024 | - | - | - | - | - | 0.9440 | 0.0560 | - |
| no-odds models + market | home_win | 2024 | 1.2130 | 0.0000 | 0.4380 | 0.1160 | 0.0000 | - | - | 0.4460 |
| no-odds models + market | margin | 2024 | - | - | - | - | - | 0.7050 | 0.0000 | 0.2950 |
| no-odds models + market | total | 2024 | - | - | - | - | - | 0.3800 | 0.0000 | 0.6200 |
| no-odds linear + LightGBM + market | home_win | 2024 | 1.1790 | 0.3350 | - | 0.1530 | - | - | - | 0.5120 |
| no-odds linear + LightGBM + market | margin | 2024 | - | - | - | - | - | 0.7050 | 0.0000 | 0.2950 |
| no-odds linear + LightGBM + market | total | 2024 | - | - | - | - | - | 0.3800 | 0.0000 | 0.6200 |
| no-odds models only | home_win | 2025 | 1.0590 | 0.0590 | 0.5320 | 0.4090 | 0.0000 | - | - | - |
| no-odds models only | margin | 2025 | - | - | - | - | - | 0.8310 | 0.1690 | - |
| no-odds models only | total | 2025 | - | - | - | - | - | 0.9830 | 0.0170 | - |
| no-odds models + market | home_win | 2025 | 1.1460 | 0.0000 | 0.3480 | 0.2550 | 0.0000 | - | - | 0.3970 |
| no-odds models + market | margin | 2025 | - | - | - | - | - | 0.6160 | 0.0000 | 0.3840 |
| no-odds models + market | total | 2025 | - | - | - | - | - | 0.3700 | 0.0000 | 0.6300 |
| no-odds linear + LightGBM + market | home_win | 2025 | 1.0860 | 0.2480 | - | 0.3110 | - | - | - | 0.4400 |
| no-odds linear + LightGBM + market | margin | 2025 | - | - | - | - | - | 0.6160 | 0.0000 | 0.3840 |
| no-odds linear + LightGBM + market | total | 2025 | - | - | - | - | - | 0.3700 | 0.0000 | 0.6300 |

## Head-to-head betting at opening prices (2% minimum edge)

Flat 1-unit bets as in `betting.py`. CLV is the move in the closing price's implied probability in the bet's favour, where closing prices are reliable (mostly 2023).

| model | bets | ROI | ROI ci_low | ROI ci_high | CLV bets | CLV mean | CLV positive |
|---|---|---|---|---|---|---|---|
| Current: with odds ensemble | 372 | 0.1601 | 0.0512 | 0.2704 | 180 | 0.0483 | 0.7056 |
| Current: no odds ensemble | 431 | 0.1216 | 0.0172 | 0.2291 | 195 | 0.0483 | 0.7077 |
| Blend: no-odds models only | 447 | 0.1209 | 0.0213 | 0.2228 | 202 | 0.0468 | 0.7129 |
| Blend: no-odds models + market | 396 | 0.0786 | -0.0126 | 0.1726 | 195 | 0.0477 | 0.7128 |
| Blend: no-odds linear + LightGBM + market | 378 | 0.0718 | -0.0245 | 0.1648 | 193 | 0.0445 | 0.6891 |
