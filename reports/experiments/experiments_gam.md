# GAM and Explainable Boosting Machine (2023–2025 backtest)

Each candidate is backtested as `train.py` does it (tuned on earlier seasons only; win model Platt-calibrated) and compared with the current main model (the ensemble of linear and LightGBM), alone, replacing LightGBM in the ensemble, and as a third ensemble member. GAM: a cubic spline basis per feature (5 knots) followed by penalised logistic / ridge, penalty tuned by CV. EBM: InterpretML's Explainable Boosting Machine with settings fixed in advance (8 outer bags; no interactions, or up to 5). Compact features = LightGBM's 16 (+ opening odds for the with-odds model).

## Scores (log loss for `home_win`, MAE for margin and total)

| model | candidate | target | alone | linear + it | linear + LightGBM + it | current ensemble | linear | LightGBM |
|---|---|---|---|---|---|---|---|---|
| With odds | GAM, linear features | home_win | 0.6253 | 0.6237 | 0.6241 | 0.6245 | 0.6243 | 0.6297 |
| With odds | GAM, linear features | margin | 13.5491 | 13.5522 | 13.5053 | 13.5148 | 13.5866 | 13.5679 |
| With odds | GAM, linear features | total | 10.7203 | 10.7074 | 10.7468 | 10.7773 | 10.7185 | 10.9094 |
| With odds | GAM, compact features | home_win | 0.6365 | 0.6277 | 0.6264 | 0.6245 | 0.6243 | 0.6297 |
| With odds | GAM, compact features | margin | 13.7302 | 13.6099 | 13.5457 | 13.5148 | 13.5866 | 13.5679 |
| With odds | GAM, compact features | total | 10.7451 | 10.7200 | 10.7568 | 10.7773 | 10.7185 | 10.9094 |
| With odds | EBM additive (no interactions), compact features | home_win | 0.6306 | 0.6254 | 0.6252 | 0.6245 | 0.6243 | 0.6297 |
| With odds | EBM additive (no interactions), compact features | margin | 13.6813 | 13.5806 | 13.5222 | 13.5148 | 13.5866 | 13.5679 |
| With odds | EBM additive (no interactions), compact features | total | 10.7668 | 10.7291 | 10.7624 | 10.7773 | 10.7185 | 10.9094 |
| With odds | EBM with 5 interactions, compact features | home_win | 0.6283 | 0.6237 | 0.6238 | 0.6245 | 0.6243 | 0.6297 |
| With odds | EBM with 5 interactions, compact features | margin | 13.6883 | 13.5994 | 13.5266 | 13.5148 | 13.5866 | 13.5679 |
| With odds | EBM with 5 interactions, compact features | total | 10.8096 | 10.7357 | 10.7646 | 10.7773 | 10.7185 | 10.9094 |
| No odds | GAM, linear features | home_win | 0.6290 | 0.6267 | 0.6273 | 0.6279 | 0.6275 | 0.6344 |
| No odds | GAM, linear features | margin | 13.5200 | 13.5374 | 13.5153 | 13.5366 | 13.6034 | 13.5800 |
| No odds | GAM, linear features | total | 10.7917 | 10.7823 | 10.7968 | 10.8319 | 10.8072 | 10.9292 |
| No odds | GAM, compact features | home_win | 0.6382 | 0.6298 | 0.6291 | 0.6279 | 0.6275 | 0.6344 |
| No odds | GAM, compact features | margin | 13.7051 | 13.5903 | 13.5438 | 13.5366 | 13.6034 | 13.5800 |
| No odds | GAM, compact features | total | 10.8143 | 10.7994 | 10.8157 | 10.8319 | 10.8072 | 10.9292 |
| No odds | EBM additive (no interactions), compact features | home_win | 0.6315 | 0.6275 | 0.6278 | 0.6279 | 0.6275 | 0.6344 |
| No odds | EBM additive (no interactions), compact features | margin | 13.7456 | 13.6000 | 13.5455 | 13.5366 | 13.6034 | 13.5800 |
| No odds | EBM additive (no interactions), compact features | total | 10.8111 | 10.7916 | 10.8107 | 10.8319 | 10.8072 | 10.9292 |
| No odds | EBM with 5 interactions, compact features | home_win | 0.6282 | 0.6246 | 0.6252 | 0.6279 | 0.6275 | 0.6344 |
| No odds | EBM with 5 interactions, compact features | margin | 13.7682 | 13.6090 | 13.5502 | 13.5366 | 13.6034 | 13.5800 |
| No odds | EBM with 5 interactions, compact features | total | 10.8523 | 10.7822 | 10.8019 | 10.8319 | 10.8072 | 10.9292 |

## Against the current ensemble (paired bootstrap; negative = better)

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 9 GAM, linear features: alone | With odds | home_win | log loss | 0.6245 | 0.6253 | 0.0009 | -0.0051 | 0.0069 | no clear difference |  |
| 9 GAM, linear features: linear + it (replaces LightGBM) | With odds | home_win | log loss | 0.6245 | 0.6237 | -0.0008 | -0.0051 | 0.0036 | no clear difference |  |
| 9 GAM, linear features: linear + LightGBM + it | With odds | home_win | log loss | 0.6245 | 0.6241 | -0.0004 | -0.0023 | 0.0016 | no clear difference |  |
| 9 GAM, linear features: alone | With odds | margin | MAE | 13.5148 | 13.5491 | 0.0343 | -0.0995 | 0.1718 | no clear difference |  |
| 9 GAM, linear features: linear + it (replaces LightGBM) | With odds | margin | MAE | 13.5148 | 13.5522 | 0.0373 | -0.0769 | 0.1564 | no clear difference |  |
| 9 GAM, linear features: linear + LightGBM + it | With odds | margin | MAE | 13.5148 | 13.5053 | -0.0095 | -0.0546 | 0.0366 | no clear difference |  |
| 9 GAM, linear features: alone | With odds | total | MAE | 10.7773 | 10.7203 | -0.0570 | -0.1475 | 0.0313 | no clear difference |  |
| 9 GAM, linear features: linear + it (replaces LightGBM) | With odds | total | MAE | 10.7773 | 10.7074 | -0.0699 | -0.1599 | 0.0169 | no clear difference |  |
| 9 GAM, linear features: linear + LightGBM + it | With odds | total | MAE | 10.7773 | 10.7468 | -0.0305 | -0.0681 | 0.0033 | no clear difference |  |
| 9 GAM, compact features: alone | With odds | home_win | log loss | 0.6245 | 0.6365 | 0.0120 | 0.0016 | 0.0227 | worse |  |
| 9 GAM, compact features: linear + it (replaces LightGBM) | With odds | home_win | log loss | 0.6245 | 0.6277 | 0.0032 | -0.0029 | 0.0092 | no clear difference |  |
| 9 GAM, compact features: linear + LightGBM + it | With odds | home_win | log loss | 0.6245 | 0.6264 | 0.0019 | -0.0015 | 0.0053 | no clear difference |  |
| 9 GAM, compact features: alone | With odds | margin | MAE | 13.5148 | 13.7302 | 0.2154 | 0.0172 | 0.4146 | worse |  |
| 9 GAM, compact features: linear + it (replaces LightGBM) | With odds | margin | MAE | 13.5148 | 13.6099 | 0.0951 | -0.0305 | 0.2224 | no clear difference |  |
| 9 GAM, compact features: linear + LightGBM + it | With odds | margin | MAE | 13.5148 | 13.5457 | 0.0309 | -0.0393 | 0.1004 | no clear difference |  |
| 9 GAM, compact features: alone | With odds | total | MAE | 10.7773 | 10.7451 | -0.0322 | -0.1292 | 0.0606 | no clear difference |  |
| 9 GAM, compact features: linear + it (replaces LightGBM) | With odds | total | MAE | 10.7773 | 10.7200 | -0.0573 | -0.1227 | 0.0076 | no clear difference |  |
| 9 GAM, compact features: linear + LightGBM + it | With odds | total | MAE | 10.7773 | 10.7568 | -0.0205 | -0.0524 | 0.0109 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: alone | With odds | home_win | log loss | 0.6245 | 0.6306 | 0.0061 | -0.0026 | 0.0144 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: linear + it (replaces LightGBM) | With odds | home_win | log loss | 0.6245 | 0.6254 | 0.0009 | -0.0043 | 0.0058 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: linear + LightGBM + it | With odds | home_win | log loss | 0.6245 | 0.6252 | 0.0007 | -0.0022 | 0.0036 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: alone | With odds | margin | MAE | 13.5148 | 13.6813 | 0.1665 | -0.0783 | 0.4097 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: linear + it (replaces LightGBM) | With odds | margin | MAE | 13.5148 | 13.5806 | 0.0658 | -0.0795 | 0.2073 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: linear + LightGBM + it | With odds | margin | MAE | 13.5148 | 13.5222 | 0.0073 | -0.0773 | 0.0898 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: alone | With odds | total | MAE | 10.7773 | 10.7668 | -0.0105 | -0.1103 | 0.0898 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: linear + it (replaces LightGBM) | With odds | total | MAE | 10.7773 | 10.7291 | -0.0483 | -0.1223 | 0.0280 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: linear + LightGBM + it | With odds | total | MAE | 10.7773 | 10.7624 | -0.0149 | -0.0482 | 0.0191 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: alone | With odds | home_win | log loss | 0.6245 | 0.6283 | 0.0038 | -0.0065 | 0.0138 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: linear + it (replaces LightGBM) | With odds | home_win | log loss | 0.6245 | 0.6237 | -0.0008 | -0.0070 | 0.0051 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: linear + LightGBM + it | With odds | home_win | log loss | 0.6245 | 0.6238 | -0.0006 | -0.0042 | 0.0028 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: alone | With odds | margin | MAE | 13.5148 | 13.6883 | 0.1735 | -0.1043 | 0.4459 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: linear + it (replaces LightGBM) | With odds | margin | MAE | 13.5148 | 13.5994 | 0.0845 | -0.0788 | 0.2416 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: linear + LightGBM + it | With odds | margin | MAE | 13.5148 | 13.5266 | 0.0118 | -0.0829 | 0.1033 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: alone | With odds | total | MAE | 10.7773 | 10.8096 | 0.0322 | -0.0997 | 0.1657 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: linear + it (replaces LightGBM) | With odds | total | MAE | 10.7773 | 10.7357 | -0.0417 | -0.1220 | 0.0441 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: linear + LightGBM + it | With odds | total | MAE | 10.7773 | 10.7646 | -0.0127 | -0.0585 | 0.0324 | no clear difference |  |
| 9 GAM, linear features: alone | No odds | home_win | log loss | 0.6279 | 0.6290 | 0.0011 | -0.0060 | 0.0082 | no clear difference |  |
| 9 GAM, linear features: linear + it (replaces LightGBM) | No odds | home_win | log loss | 0.6279 | 0.6267 | -0.0012 | -0.0059 | 0.0035 | no clear difference |  |
| 9 GAM, linear features: linear + LightGBM + it | No odds | home_win | log loss | 0.6279 | 0.6273 | -0.0005 | -0.0028 | 0.0017 | no clear difference |  |
| 9 GAM, linear features: alone | No odds | margin | MAE | 13.5366 | 13.5200 | -0.0166 | -0.1332 | 0.1018 | no clear difference |  |
| 9 GAM, linear features: linear + it (replaces LightGBM) | No odds | margin | MAE | 13.5366 | 13.5374 | 0.0008 | -0.0996 | 0.1031 | no clear difference |  |
| 9 GAM, linear features: linear + LightGBM + it | No odds | margin | MAE | 13.5366 | 13.5153 | -0.0212 | -0.0619 | 0.0197 | no clear difference |  |
| 9 GAM, linear features: alone | No odds | total | MAE | 10.8319 | 10.7917 | -0.0402 | -0.1417 | 0.0623 | no clear difference |  |
| 9 GAM, linear features: linear + it (replaces LightGBM) | No odds | total | MAE | 10.8319 | 10.7823 | -0.0497 | -0.1484 | 0.0452 | no clear difference |  |
| 9 GAM, linear features: linear + LightGBM + it | No odds | total | MAE | 10.8319 | 10.7968 | -0.0351 | -0.0815 | 0.0060 | no clear difference |  |
| 9 GAM, compact features: alone | No odds | home_win | log loss | 0.6279 | 0.6382 | 0.0103 | -0.0005 | 0.0210 | no clear difference |  |
| 9 GAM, compact features: linear + it (replaces LightGBM) | No odds | home_win | log loss | 0.6279 | 0.6298 | 0.0019 | -0.0045 | 0.0081 | no clear difference |  |
| 9 GAM, compact features: linear + LightGBM + it | No odds | home_win | log loss | 0.6279 | 0.6291 | 0.0012 | -0.0023 | 0.0047 | no clear difference |  |
| 9 GAM, compact features: alone | No odds | margin | MAE | 13.5366 | 13.7051 | 0.1686 | -0.0454 | 0.3739 | no clear difference |  |
| 9 GAM, compact features: linear + it (replaces LightGBM) | No odds | margin | MAE | 13.5366 | 13.5903 | 0.0538 | -0.0707 | 0.1785 | no clear difference |  |
| 9 GAM, compact features: linear + LightGBM + it | No odds | margin | MAE | 13.5366 | 13.5438 | 0.0072 | -0.0664 | 0.0788 | no clear difference |  |
| 9 GAM, compact features: alone | No odds | total | MAE | 10.8319 | 10.8143 | -0.0177 | -0.0987 | 0.0627 | no clear difference |  |
| 9 GAM, compact features: linear + it (replaces LightGBM) | No odds | total | MAE | 10.8319 | 10.7994 | -0.0326 | -0.0953 | 0.0288 | no clear difference |  |
| 9 GAM, compact features: linear + LightGBM + it | No odds | total | MAE | 10.8319 | 10.8157 | -0.0162 | -0.0435 | 0.0103 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: alone | No odds | home_win | log loss | 0.6279 | 0.6315 | 0.0036 | -0.0046 | 0.0117 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: linear + it (replaces LightGBM) | No odds | home_win | log loss | 0.6279 | 0.6275 | -0.0004 | -0.0057 | 0.0049 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: linear + LightGBM + it | No odds | home_win | log loss | 0.6279 | 0.6278 | -0.0001 | -0.0029 | 0.0027 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: alone | No odds | margin | MAE | 13.5366 | 13.7456 | 0.2090 | -0.0606 | 0.4700 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: linear + it (replaces LightGBM) | No odds | margin | MAE | 13.5366 | 13.6000 | 0.0635 | -0.0881 | 0.2134 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: linear + LightGBM + it | No odds | margin | MAE | 13.5366 | 13.5455 | 0.0089 | -0.0840 | 0.0983 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: alone | No odds | total | MAE | 10.8319 | 10.8111 | -0.0209 | -0.1105 | 0.0726 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: linear + it (replaces LightGBM) | No odds | total | MAE | 10.8319 | 10.7916 | -0.0403 | -0.1039 | 0.0264 | no clear difference |  |
| 9 EBM additive (no interactions), compact features: linear + LightGBM + it | No odds | total | MAE | 10.8319 | 10.8107 | -0.0212 | -0.0518 | 0.0107 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: alone | No odds | home_win | log loss | 0.6279 | 0.6282 | 0.0003 | -0.0113 | 0.0127 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: linear + it (replaces LightGBM) | No odds | home_win | log loss | 0.6279 | 0.6246 | -0.0033 | -0.0103 | 0.0040 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: linear + LightGBM + it | No odds | home_win | log loss | 0.6279 | 0.6252 | -0.0027 | -0.0066 | 0.0014 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: alone | No odds | margin | MAE | 13.5366 | 13.7682 | 0.2316 | -0.0471 | 0.5034 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: linear + it (replaces LightGBM) | No odds | margin | MAE | 13.5366 | 13.6090 | 0.0725 | -0.0863 | 0.2249 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: linear + LightGBM + it | No odds | margin | MAE | 13.5366 | 13.5502 | 0.0136 | -0.0832 | 0.1066 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: alone | No odds | total | MAE | 10.8319 | 10.8523 | 0.0204 | -0.1355 | 0.1784 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: linear + it (replaces LightGBM) | No odds | total | MAE | 10.8319 | 10.7822 | -0.0497 | -0.1346 | 0.0400 | no clear difference |  |
| 9 EBM with 5 interactions, compact features: linear + LightGBM + it | No odds | total | MAE | 10.8319 | 10.8019 | -0.0301 | -0.0819 | 0.0245 | no clear difference |  |
