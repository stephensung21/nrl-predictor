# Team total rating (2023–2025 backtest)

`team_total`: a ridge regression of each match's total since 2009 on a total tendency per team (attack plus defence), refitted weekly on earlier games with the team margin rating's settings (two-year half-life). Added to the linear totals model (which also puts it in LightGBM's compact set) or to LightGBM only, and run through the full pipeline backtest. `diff` is new minus current (negative = better), with a paired bootstrap 95% interval. Correlation of `team_total` with the actual total over the backtest games: 0.173.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 12 team total in linear totals (and LightGBM): linear | With odds | home_win | log loss | 0.6243 | 0.6243 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 12 team total in linear totals (and LightGBM): linear | With odds | margin | MAE | 13.5866 | 13.5866 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 12 team total in linear totals (and LightGBM): linear | With odds | total | MAE | 10.7185 | 10.7348 | 0.0163 | -0.0432 | 0.0755 | no clear difference |  |
| 12 team total in linear totals (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6243 | -0.0002 | -0.0012 | 0.0008 | no clear difference |  |
| 12 team total in linear totals (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.5106 | -0.0042 | -0.0141 | 0.0054 | no clear difference |  |
| 12 team total in linear totals (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.7775 | 0.0001 | -0.0539 | 0.0547 | no clear difference |  |
| 12 team total in linear totals (and LightGBM): linear | No odds | home_win | log loss | 0.6275 | 0.6275 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 12 team total in linear totals (and LightGBM): linear | No odds | margin | MAE | 13.6034 | 13.6034 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 12 team total in linear totals (and LightGBM): linear | No odds | total | MAE | 10.8072 | 10.8429 | 0.0356 | -0.0538 | 0.1253 | no clear difference |  |
| 12 team total in linear totals (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6271 | -0.0008 | -0.0020 | 0.0003 | no clear difference |  |
| 12 team total in linear totals (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.5315 | -0.0050 | -0.0180 | 0.0080 | no clear difference |  |
| 12 team total in linear totals (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8409 | 0.0090 | -0.0510 | 0.0682 | no clear difference |  |
| 12 team total in LightGBM only: linear | With odds | home_win | log loss | 0.6243 | 0.6243 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 12 team total in LightGBM only: linear | With odds | margin | MAE | 13.5866 | 13.5866 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 12 team total in LightGBM only: linear | With odds | total | MAE | 10.7185 | 10.7185 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 12 team total in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6243 | -0.0002 | -0.0011 | 0.0007 | no clear difference |  |
| 12 team total in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5055 | -0.0094 | -0.0200 | 0.0011 | no clear difference |  |
| 12 team total in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7590 | -0.0183 | -0.0546 | 0.0196 | no clear difference |  |
| 12 team total in LightGBM only: linear | No odds | home_win | log loss | 0.6275 | 0.6275 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 12 team total in LightGBM only: linear | No odds | margin | MAE | 13.6034 | 13.6034 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 12 team total in LightGBM only: linear | No odds | total | MAE | 10.8072 | 10.8072 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 12 team total in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6275 | -0.0004 | -0.0014 | 0.0007 | no clear difference |  |
| 12 team total in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5301 | -0.0065 | -0.0194 | 0.0066 | no clear difference |  |
| 12 team total in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8149 | -0.0170 | -0.0561 | 0.0218 | no clear difference |  |
