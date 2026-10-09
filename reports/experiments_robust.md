# Robust margin and total training (2023–2025 backtest)

Margin and total models trained with capped targets (margin ±40, total ±25 around the training average), Huber loss, or median (quantile) regression, against the current ridge on raw targets. Penalties are tuned per backtest year on earlier seasons by CV MAE. `home_win` is the margin-blended win probability, which changes through the margin prediction. `diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 7 ridge, capped targets | With odds | margin | MAE | 13.5866 | 13.5574 | -0.0292 | -0.0610 | 0.0025 | no clear difference |  |
| 7 ridge, capped targets | With odds | total | MAE | 10.7185 | 10.7193 | 0.0008 | -0.0150 | 0.0168 | no clear difference |  |
| 7 ridge, capped targets | With odds | home_win | log loss | 0.6243 | 0.6239 | -0.0004 | -0.0011 | 0.0003 | no clear difference |  |
| 7 Huber | With odds | margin | MAE | 13.5866 | 13.5540 | -0.0326 | -0.0842 | 0.0158 | no clear difference |  |
| 7 Huber | With odds | total | MAE | 10.7185 | 10.7289 | 0.0104 | -0.0363 | 0.0557 | no clear difference |  |
| 7 Huber | With odds | home_win | log loss | 0.6243 | 0.6243 | 0.0000 | -0.0011 | 0.0011 | no clear difference |  |
| 7 median (quantile) regression | With odds | margin | MAE | 13.5866 | 13.6241 | 0.0375 | -0.0389 | 0.1107 | no clear difference |  |
| 7 median (quantile) regression | With odds | total | MAE | 10.7185 | 10.7455 | 0.0269 | -0.0386 | 0.0890 | no clear difference |  |
| 7 median (quantile) regression | With odds | home_win | log loss | 0.6243 | 0.6243 | -0.0000 | -0.0018 | 0.0017 | no clear difference |  |
| 7 ridge, capped targets | No odds | margin | MAE | 13.6034 | 13.5714 | -0.0320 | -0.0614 | -0.0033 | better |  |
| 7 ridge, capped targets | No odds | total | MAE | 10.8072 | 10.8108 | 0.0036 | -0.0055 | 0.0130 | no clear difference |  |
| 7 ridge, capped targets | No odds | home_win | log loss | 0.6275 | 0.6271 | -0.0005 | -0.0011 | 0.0002 | no clear difference |  |
| 7 Huber | No odds | margin | MAE | 13.6034 | 13.6334 | 0.0301 | -0.0175 | 0.0763 | no clear difference |  |
| 7 Huber | No odds | total | MAE | 10.8072 | 10.8316 | 0.0244 | -0.0308 | 0.0800 | no clear difference |  |
| 7 Huber | No odds | home_win | log loss | 0.6275 | 0.6281 | 0.0006 | -0.0005 | 0.0017 | no clear difference |  |
| 7 median (quantile) regression | No odds | margin | MAE | 13.6034 | 13.5896 | -0.0138 | -0.0911 | 0.0672 | no clear difference |  |
| 7 median (quantile) regression | No odds | total | MAE | 10.8072 | 10.9017 | 0.0945 | 0.0022 | 0.1896 | worse |  |
| 7 median (quantile) regression | No odds | home_win | log loss | 0.6275 | 0.6279 | 0.0004 | -0.0015 | 0.0023 | no clear difference |  |
