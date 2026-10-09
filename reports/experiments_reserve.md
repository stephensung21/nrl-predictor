# Reserve-grade newcomers (2023–2025 backtest)

`diff_reserve_newcomers` (home minus away): for named players with fewer than 10 NRL games, the sum of their reserve-grade (NSW Cup / QLD Cup) rating — fantasy points per 80 minutes relative to their position group, shrunk for few games — using reserve games before the NRL kickoff only. Added to LightGBM's compact set only, or to the linear win and margin models as well (LightGBM's compact set includes every linear feature), and run through the full pipeline backtest. `diff_reserve_rapm_newcomers` (11b) is the same idea using a reserve-grade plus-minus rating (ridge on reserve margins, as the NRL RAPM, one-year half-life) instead of fantasy points. `diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 11 reserve newcomers in LightGBM only: linear | With odds | home_win | log loss | 0.6243 | 0.6243 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11 reserve newcomers in LightGBM only: linear | With odds | margin | MAE | 13.5866 | 13.5866 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11 reserve newcomers in LightGBM only: linear | With odds | total | MAE | 10.7185 | 10.7185 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11 reserve newcomers in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6247 | 0.0002 | -0.0005 | 0.0009 | no clear difference |  |
| 11 reserve newcomers in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.4777 | -0.0371 | -0.0598 | -0.0144 | better |  |
| 11 reserve newcomers in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7720 | -0.0054 | -0.0294 | 0.0182 | no clear difference |  |
| 11 reserve newcomers in LightGBM only: linear | No odds | home_win | log loss | 0.6275 | 0.6275 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11 reserve newcomers in LightGBM only: linear | No odds | margin | MAE | 13.6034 | 13.6034 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11 reserve newcomers in LightGBM only: linear | No odds | total | MAE | 10.8072 | 10.8072 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11 reserve newcomers in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6277 | -0.0002 | -0.0008 | 0.0005 | no clear difference |  |
| 11 reserve newcomers in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5025 | -0.0341 | -0.0589 | -0.0084 | better |  |
| 11 reserve newcomers in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8310 | -0.0010 | -0.0174 | 0.0159 | no clear difference |  |
| 11 reserve newcomers in linear and LightGBM: linear | With odds | home_win | log loss | 0.6243 | 0.6257 | 0.0015 | -0.0011 | 0.0041 | no clear difference |  |
| 11 reserve newcomers in linear and LightGBM: linear | With odds | margin | MAE | 13.5866 | 13.6358 | 0.0492 | -0.0325 | 0.1312 | no clear difference |  |
| 11 reserve newcomers in linear and LightGBM: linear | With odds | total | MAE | 10.7185 | 10.7185 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11 reserve newcomers in linear and LightGBM: ensemble | With odds | home_win | log loss | 0.6245 | 0.6253 | 0.0008 | -0.0008 | 0.0025 | no clear difference |  |
| 11 reserve newcomers in linear and LightGBM: ensemble | With odds | margin | MAE | 13.5148 | 13.4954 | -0.0194 | -0.0772 | 0.0375 | no clear difference |  |
| 11 reserve newcomers in linear and LightGBM: ensemble | With odds | total | MAE | 10.7773 | 10.7729 | -0.0045 | -0.0279 | 0.0182 | no clear difference |  |
| 11 reserve newcomers in linear and LightGBM: linear | No odds | home_win | log loss | 0.6275 | 0.6296 | 0.0021 | -0.0012 | 0.0054 | no clear difference |  |
| 11 reserve newcomers in linear and LightGBM: linear | No odds | margin | MAE | 13.6034 | 13.6691 | 0.0657 | -0.0347 | 0.1683 | no clear difference |  |
| 11 reserve newcomers in linear and LightGBM: linear | No odds | total | MAE | 10.8072 | 10.8072 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11 reserve newcomers in linear and LightGBM: ensemble | No odds | home_win | log loss | 0.6279 | 0.6286 | 0.0007 | -0.0013 | 0.0028 | no clear difference |  |
| 11 reserve newcomers in linear and LightGBM: ensemble | No odds | margin | MAE | 13.5366 | 13.5154 | -0.0212 | -0.0884 | 0.0471 | no clear difference |  |
| 11 reserve newcomers in linear and LightGBM: ensemble | No odds | total | MAE | 10.8319 | 10.8397 | 0.0078 | -0.0085 | 0.0236 | no clear difference |  |
| 11b reserve plus-minus newcomers in LightGBM only: linear | With odds | home_win | log loss | 0.6243 | 0.6243 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11b reserve plus-minus newcomers in LightGBM only: linear | With odds | margin | MAE | 13.5866 | 13.5866 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11b reserve plus-minus newcomers in LightGBM only: linear | With odds | total | MAE | 10.7185 | 10.7185 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11b reserve plus-minus newcomers in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6246 | 0.0002 | -0.0007 | 0.0010 | no clear difference |  |
| 11b reserve plus-minus newcomers in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5046 | -0.0102 | -0.0228 | 0.0027 | no clear difference |  |
| 11b reserve plus-minus newcomers in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7694 | -0.0079 | -0.0313 | 0.0158 | no clear difference |  |
| 11b reserve plus-minus newcomers in LightGBM only: linear | No odds | home_win | log loss | 0.6275 | 0.6275 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11b reserve plus-minus newcomers in LightGBM only: linear | No odds | margin | MAE | 13.6034 | 13.6034 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11b reserve plus-minus newcomers in LightGBM only: linear | No odds | total | MAE | 10.8072 | 10.8072 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11b reserve plus-minus newcomers in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6280 | 0.0001 | -0.0007 | 0.0010 | no clear difference |  |
| 11b reserve plus-minus newcomers in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5255 | -0.0111 | -0.0268 | 0.0047 | no clear difference |  |
| 11b reserve plus-minus newcomers in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8357 | 0.0038 | -0.0125 | 0.0208 | no clear difference |  |
| 11b reserve plus-minus newcomers in linear and LightGBM: linear | With odds | home_win | log loss | 0.6243 | 0.6246 | 0.0003 | -0.0006 | 0.0012 | no clear difference |  |
| 11b reserve plus-minus newcomers in linear and LightGBM: linear | With odds | margin | MAE | 13.5866 | 13.5901 | 0.0035 | -0.0050 | 0.0123 | no clear difference |  |
| 11b reserve plus-minus newcomers in linear and LightGBM: linear | With odds | total | MAE | 10.7185 | 10.7185 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11b reserve plus-minus newcomers in linear and LightGBM: ensemble | With odds | home_win | log loss | 0.6245 | 0.6248 | 0.0003 | -0.0008 | 0.0014 | no clear difference |  |
| 11b reserve plus-minus newcomers in linear and LightGBM: ensemble | With odds | margin | MAE | 13.5148 | 13.5094 | -0.0054 | -0.0178 | 0.0067 | no clear difference |  |
| 11b reserve plus-minus newcomers in linear and LightGBM: ensemble | With odds | total | MAE | 10.7773 | 10.7711 | -0.0062 | -0.0340 | 0.0219 | no clear difference |  |
| 11b reserve plus-minus newcomers in linear and LightGBM: linear | No odds | home_win | log loss | 0.6275 | 0.6277 | 0.0001 | -0.0012 | 0.0014 | no clear difference |  |
| 11b reserve plus-minus newcomers in linear and LightGBM: linear | No odds | margin | MAE | 13.6034 | 13.5862 | -0.0172 | -0.0474 | 0.0129 | no clear difference |  |
| 11b reserve plus-minus newcomers in linear and LightGBM: linear | No odds | total | MAE | 10.8072 | 10.8072 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 11b reserve plus-minus newcomers in linear and LightGBM: ensemble | No odds | home_win | log loss | 0.6279 | 0.6277 | -0.0002 | -0.0015 | 0.0012 | no clear difference |  |
| 11b reserve plus-minus newcomers in linear and LightGBM: ensemble | No odds | margin | MAE | 13.5366 | 13.5237 | -0.0128 | -0.0355 | 0.0095 | no clear difference |  |
| 11b reserve plus-minus newcomers in linear and LightGBM: ensemble | No odds | total | MAE | 10.8319 | 10.8327 | 0.0008 | -0.0185 | 0.0202 | no clear difference |  |
