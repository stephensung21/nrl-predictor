# LightGBM accuracy and stability (2023–2025 backtest)

Each LightGBM variant is backtested as `train.py` does it (tuned on earlier seasons only, win model Platt-calibrated) and averaged with the linear model to form the main ensemble. The fixed settings were chosen in advance (depth 2, learning rate 0.02, at least 40 games per leaf, L2 10, 70% of features and 80% of games per tree); only the number of trees is chosen by CV. The compact set is every linear-model feature plus diff_rapm_attack, diff_rapm_missing, diff_rookies, diff_rest_days, home_travel, away_travel, neutral, is_final.

## Scores (log loss for `home_win`, MAE for margin and total)

| model | LightGBM variant | target | LightGBM | linear | ensemble |
|---|---|---|---|---|---|
| With odds | current (Optuna, full features, 1 seed) | home_win | 0.6397 | 0.6243 | 0.6280 |
| With odds | current (Optuna, full features, 1 seed) | margin | 13.8344 | 13.5866 | 13.6060 |
| With odds | current (Optuna, full features, 1 seed) | total | 11.0725 | 10.7185 | 10.8516 |
| With odds | Optuna, full features, 5 seeds | home_win | 0.6350 | 0.6243 | 0.6264 |
| With odds | Optuna, full features, 5 seeds | margin | 13.8015 | 13.5866 | 13.5849 |
| With odds | Optuna, full features, 5 seeds | total | 10.9911 | 10.7185 | 10.8159 |
| With odds | fixed settings, full features, 5 seeds | home_win | 0.6336 | 0.6243 | 0.6257 |
| With odds | fixed settings, full features, 5 seeds | margin | 13.7199 | 13.5866 | 13.5505 |
| With odds | fixed settings, full features, 5 seeds | total | 10.9638 | 10.7185 | 10.7960 |
| With odds | fixed settings, compact features, 5 seeds | home_win | 0.6297 | 0.6243 | 0.6245 |
| With odds | fixed settings, compact features, 5 seeds | margin | 13.5679 | 13.5866 | 13.5148 |
| With odds | fixed settings, compact features, 5 seeds | total | 10.9094 | 10.7185 | 10.7773 |
| With odds | Optuna, compact features, 5 seeds | home_win | 0.6311 | 0.6243 | 0.6248 |
| With odds | Optuna, compact features, 5 seeds | margin | 13.5990 | 13.5866 | 13.5323 |
| With odds | Optuna, compact features, 5 seeds | total | 10.8635 | 10.7185 | 10.7613 |
| No odds | current (Optuna, full features, 1 seed) | home_win | 0.6375 | 0.6275 | 0.6281 |
| No odds | current (Optuna, full features, 1 seed) | margin | 13.6713 | 13.6034 | 13.5052 |
| No odds | current (Optuna, full features, 1 seed) | total | 11.0076 | 10.8072 | 10.8607 |
| No odds | Optuna, full features, 5 seeds | home_win | 0.6378 | 0.6275 | 0.6289 |
| No odds | Optuna, full features, 5 seeds | margin | 13.6726 | 13.6034 | 13.5284 |
| No odds | Optuna, full features, 5 seeds | total | 10.9385 | 10.8072 | 10.8291 |
| No odds | fixed settings, full features, 5 seeds | home_win | 0.6370 | 0.6275 | 0.6284 |
| No odds | fixed settings, full features, 5 seeds | margin | 13.7147 | 13.6034 | 13.5536 |
| No odds | fixed settings, full features, 5 seeds | total | 10.9569 | 10.8072 | 10.8457 |
| No odds | fixed settings, compact features, 5 seeds | home_win | 0.6344 | 0.6275 | 0.6279 |
| No odds | fixed settings, compact features, 5 seeds | margin | 13.5800 | 13.6034 | 13.5366 |
| No odds | fixed settings, compact features, 5 seeds | total | 10.9292 | 10.8072 | 10.8319 |
| No odds | Optuna, compact features, 5 seeds | home_win | 0.6325 | 0.6275 | 0.6270 |
| No odds | Optuna, compact features, 5 seeds | margin | 13.5505 | 13.6034 | 13.5166 |
| No odds | Optuna, compact features, 5 seeds | total | 10.8372 | 10.8072 | 10.7917 |

## Ensemble against the current ensemble (paired bootstrap; negative = better)

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 current (Optuna, full features, 1 seed): ensemble | With odds | home_win | log loss | 0.6280 | 0.6280 | -0.0000 | -0.0000 | 0.0000 | no clear difference |  |
| 8 current (Optuna, full features, 1 seed): ensemble | With odds | margin | MAE | 13.6060 | 13.6060 | -0.0000 | -0.0000 | 0.0000 | no clear difference |  |
| 8 current (Optuna, full features, 1 seed): ensemble | With odds | total | MAE | 10.8516 | 10.8516 | -0.0000 | -0.0000 | -0.0000 | better |  |
| 8 Optuna, full features, 5 seeds: ensemble | With odds | home_win | log loss | 0.6280 | 0.6264 | -0.0016 | -0.0038 | 0.0005 | no clear difference |  |
| 8 Optuna, full features, 5 seeds: ensemble | With odds | margin | MAE | 13.6060 | 13.5849 | -0.0211 | -0.0686 | 0.0261 | no clear difference |  |
| 8 Optuna, full features, 5 seeds: ensemble | With odds | total | MAE | 10.8516 | 10.8159 | -0.0356 | -0.0646 | -0.0059 | better |  |
| 8 fixed settings, full features, 5 seeds: ensemble | With odds | home_win | log loss | 0.6280 | 0.6257 | -0.0023 | -0.0056 | 0.0012 | no clear difference |  |
| 8 fixed settings, full features, 5 seeds: ensemble | With odds | margin | MAE | 13.6060 | 13.5505 | -0.0555 | -0.1333 | 0.0226 | no clear difference |  |
| 8 fixed settings, full features, 5 seeds: ensemble | With odds | total | MAE | 10.8516 | 10.7960 | -0.0556 | -0.1041 | -0.0058 | better |  |
| 8 fixed settings, compact features, 5 seeds: ensemble | With odds | home_win | log loss | 0.6280 | 0.6245 | -0.0035 | -0.0084 | 0.0012 | no clear difference |  |
| 8 fixed settings, compact features, 5 seeds: ensemble | With odds | margin | MAE | 13.6060 | 13.5148 | -0.0911 | -0.2198 | 0.0372 | no clear difference |  |
| 8 fixed settings, compact features, 5 seeds: ensemble | With odds | total | MAE | 10.8516 | 10.7773 | -0.0742 | -0.1323 | -0.0144 | better |  |
| 8 Optuna, compact features, 5 seeds: ensemble | With odds | home_win | log loss | 0.6280 | 0.6248 | -0.0032 | -0.0080 | 0.0017 | no clear difference |  |
| 8 Optuna, compact features, 5 seeds: ensemble | With odds | margin | MAE | 13.6060 | 13.5323 | -0.0737 | -0.2049 | 0.0574 | no clear difference |  |
| 8 Optuna, compact features, 5 seeds: ensemble | With odds | total | MAE | 10.8516 | 10.7613 | -0.0903 | -0.1642 | -0.0134 | better |  |
| 8 current (Optuna, full features, 1 seed): ensemble | No odds | home_win | log loss | 0.6281 | 0.6281 | -0.0000 | -0.0000 | 0.0000 | no clear difference |  |
| 8 current (Optuna, full features, 1 seed): ensemble | No odds | margin | MAE | 13.5052 | 13.5052 | -0.0000 | -0.0000 | 0.0000 | no clear difference |  |
| 8 current (Optuna, full features, 1 seed): ensemble | No odds | total | MAE | 10.8607 | 10.8607 | -0.0000 | -0.0000 | 0.0000 | no clear difference |  |
| 8 Optuna, full features, 5 seeds: ensemble | No odds | home_win | log loss | 0.6281 | 0.6289 | 0.0008 | -0.0014 | 0.0029 | no clear difference |  |
| 8 Optuna, full features, 5 seeds: ensemble | No odds | margin | MAE | 13.5052 | 13.5284 | 0.0232 | -0.0275 | 0.0753 | no clear difference |  |
| 8 Optuna, full features, 5 seeds: ensemble | No odds | total | MAE | 10.8607 | 10.8291 | -0.0316 | -0.0563 | -0.0069 | better |  |
| 8 fixed settings, full features, 5 seeds: ensemble | No odds | home_win | log loss | 0.6281 | 0.6284 | 0.0003 | -0.0031 | 0.0036 | no clear difference |  |
| 8 fixed settings, full features, 5 seeds: ensemble | No odds | margin | MAE | 13.5052 | 13.5536 | 0.0484 | -0.0136 | 0.1131 | no clear difference |  |
| 8 fixed settings, full features, 5 seeds: ensemble | No odds | total | MAE | 10.8607 | 10.8457 | -0.0150 | -0.0503 | 0.0203 | no clear difference |  |
| 8 fixed settings, compact features, 5 seeds: ensemble | No odds | home_win | log loss | 0.6281 | 0.6279 | -0.0003 | -0.0046 | 0.0041 | no clear difference |  |
| 8 fixed settings, compact features, 5 seeds: ensemble | No odds | margin | MAE | 13.5052 | 13.5366 | 0.0314 | -0.0768 | 0.1373 | no clear difference |  |
| 8 fixed settings, compact features, 5 seeds: ensemble | No odds | total | MAE | 10.8607 | 10.8319 | -0.0288 | -0.0693 | 0.0134 | no clear difference |  |
| 8 Optuna, compact features, 5 seeds: ensemble | No odds | home_win | log loss | 0.6281 | 0.6270 | -0.0012 | -0.0061 | 0.0037 | no clear difference |  |
| 8 Optuna, compact features, 5 seeds: ensemble | No odds | margin | MAE | 13.5052 | 13.5166 | 0.0114 | -0.1057 | 0.1266 | no clear difference |  |
| 8 Optuna, compact features, 5 seeds: ensemble | No odds | total | MAE | 10.8607 | 10.7917 | -0.0690 | -0.1344 | 0.0010 | no clear difference |  |

## Stability: the same variant rerun with different randomness (win model)

Run 2 changes only the randomness: the Optuna sampler seed for the current setup, or a different set of 5 bagging seeds for the fixed settings.

| model | LightGBM variant | win log loss, run 1 | win log loss, run 2 | change | mean abs prob change |
|---|---|---|---|---|---|
| With odds | current (Optuna, full features, 1 seed) | 0.6397 | 0.6394 | -0.0004 | 0.0311 |
| With odds | fixed settings, full features, 5 seeds | 0.6336 | 0.6326 | -0.0011 | 0.0057 |
| With odds | fixed settings, compact features, 5 seeds | 0.6297 | 0.6304 | 0.0006 | 0.0047 |
| No odds | current (Optuna, full features, 1 seed) | 0.6375 | 0.6349 | -0.0026 | 0.0299 |
| No odds | fixed settings, full features, 5 seeds | 0.6370 | 0.6365 | -0.0006 | 0.0056 |
| No odds | fixed settings, compact features, 5 seeds | 0.6344 | 0.6341 | -0.0004 | 0.0041 |
