# Robust margin and total training (2023–2025 backtest)

Margin and total models trained with capped targets (margin ±40, total ±25 around the training average), Huber loss, or median (quantile) regression, against the current ridge on raw targets. Penalties are tuned per backtest year on earlier seasons by CV MAE. `home_win` is the margin-blended win probability, which changes through the margin prediction. `diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 7 ridge, capped targets | With odds | margin | MAE | 13.5894 | 13.5583 | -0.0311 | -0.0634 | 0.0007 | no clear difference |  |
| 7 ridge, capped targets | With odds | total | MAE | 10.7321 | 10.7339 | 0.0018 | -0.0131 | 0.0165 | no clear difference |  |
| 7 ridge, capped targets | With odds | home_win | log loss | 0.6243 | 0.6240 | -0.0004 | -0.0011 | 0.0003 | no clear difference |  |
| 7 Huber | With odds | margin | MAE | 13.5894 | 13.5614 | -0.0280 | -0.0781 | 0.0193 | no clear difference |  |
| 7 Huber | With odds | total | MAE | 10.7321 | 10.7285 | -0.0036 | -0.0540 | 0.0460 | no clear difference |  |
| 7 Huber | With odds | home_win | log loss | 0.6243 | 0.6244 | 0.0000 | -0.0011 | 0.0011 | no clear difference |  |
| 7 median (quantile) regression | With odds | margin | MAE | 13.5894 | 13.6325 | 0.0431 | -0.0358 | 0.1206 | no clear difference |  |
| 7 median (quantile) regression | With odds | total | MAE | 10.7321 | 10.7366 | 0.0045 | -0.0711 | 0.0769 | no clear difference |  |
| 7 median (quantile) regression | With odds | home_win | log loss | 0.6243 | 0.6245 | 0.0002 | -0.0015 | 0.0020 | no clear difference |  |
| 7 ridge, capped targets | No odds | margin | MAE | 13.6112 | 13.5773 | -0.0339 | -0.0639 | -0.0044 | better |  |
| 7 ridge, capped targets | No odds | total | MAE | 10.7977 | 10.8013 | 0.0036 | -0.0055 | 0.0130 | no clear difference |  |
| 7 ridge, capped targets | No odds | home_win | log loss | 0.6279 | 0.6274 | -0.0005 | -0.0012 | 0.0001 | no clear difference |  |
| 7 Huber | No odds | margin | MAE | 13.6112 | 13.6448 | 0.0336 | -0.0133 | 0.0795 | no clear difference |  |
| 7 Huber | No odds | total | MAE | 10.7977 | 10.8338 | 0.0361 | -0.0218 | 0.0946 | no clear difference |  |
| 7 Huber | No odds | home_win | log loss | 0.6279 | 0.6285 | 0.0006 | -0.0005 | 0.0017 | no clear difference |  |
| 7 median (quantile) regression | No odds | margin | MAE | 13.6112 | 13.6027 | -0.0085 | -0.0888 | 0.0741 | no clear difference |  |
| 7 median (quantile) regression | No odds | total | MAE | 10.7977 | 10.9117 | 0.1139 | 0.0069 | 0.2297 | worse |  |
| 7 median (quantile) regression | No odds | home_win | log loss | 0.6279 | 0.6284 | 0.0005 | -0.0014 | 0.0024 | no clear difference |  |
