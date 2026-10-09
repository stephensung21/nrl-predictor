# More context features (2023–2025 backtest)

Each group is added to the linear models for the listed targets (which also puts it in LightGBM's compact set), or to LightGBM only, and run through the full pipeline backtest. Results are for the main ensembles. `diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

- **kickoff slot:** `night_game`, `kickoff_thursday`, `kickoff_friday`, `kickoff_sunday` (linear: home_win, margin, total)
- **travel distance and time zones:** `diff_travel_km`, `diff_tz_change` (linear: home_win, margin, total)
- **Origin representatives:** `diff_origin_reps` (linear: home_win, margin)

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 14 kickoff slot in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6287 | 0.0042 | 0.0008 | 0.0077 | worse |  |
| 14 kickoff slot in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.5775 | 0.0627 | -0.0191 | 0.1491 | no clear difference |  |
| 14 kickoff slot in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.8062 | 0.0289 | -0.0174 | 0.0744 | no clear difference |  |
| 14 kickoff slot in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6319 | 0.0040 | 0.0005 | 0.0077 | worse |  |
| 14 kickoff slot in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.5938 | 0.0572 | -0.0282 | 0.1439 | no clear difference |  |
| 14 kickoff slot in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8563 | 0.0244 | -0.0175 | 0.0648 | no clear difference |  |
| 14 kickoff slot in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6250 | 0.0005 | -0.0001 | 0.0012 | no clear difference |  |
| 14 kickoff slot in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5253 | 0.0104 | -0.0048 | 0.0269 | no clear difference |  |
| 14 kickoff slot in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7745 | -0.0028 | -0.0124 | 0.0072 | no clear difference |  |
| 14 kickoff slot in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6284 | 0.0005 | -0.0002 | 0.0012 | no clear difference |  |
| 14 kickoff slot in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5292 | -0.0074 | -0.0206 | 0.0052 | no clear difference |  |
| 14 kickoff slot in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8357 | 0.0038 | -0.0053 | 0.0128 | no clear difference |  |
| 14 travel distance and time zones in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6254 | 0.0009 | -0.0020 | 0.0039 | no clear difference |  |
| 14 travel distance and time zones in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.5938 | 0.0790 | -0.0032 | 0.1646 | no clear difference |  |
| 14 travel distance and time zones in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.7676 | -0.0097 | -0.0454 | 0.0247 | no clear difference |  |
| 14 travel distance and time zones in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6287 | 0.0008 | -0.0030 | 0.0047 | no clear difference |  |
| 14 travel distance and time zones in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.6055 | 0.0690 | -0.0308 | 0.1692 | no clear difference |  |
| 14 travel distance and time zones in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8137 | -0.0182 | -0.0398 | 0.0040 | no clear difference |  |
| 14 travel distance and time zones in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6246 | 0.0001 | -0.0004 | 0.0006 | no clear difference |  |
| 14 travel distance and time zones in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5098 | -0.0051 | -0.0139 | 0.0038 | no clear difference |  |
| 14 travel distance and time zones in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7718 | -0.0056 | -0.0162 | 0.0054 | no clear difference |  |
| 14 travel distance and time zones in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6282 | 0.0004 | -0.0002 | 0.0009 | no clear difference |  |
| 14 travel distance and time zones in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5360 | -0.0005 | -0.0097 | 0.0086 | no clear difference |  |
| 14 travel distance and time zones in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8308 | -0.0011 | -0.0103 | 0.0083 | no clear difference |  |
| 14 Origin representatives in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6249 | 0.0004 | -0.0039 | 0.0047 | no clear difference |  |
| 14 Origin representatives in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.4995 | -0.0153 | -0.0828 | 0.0521 | no clear difference |  |
| 14 Origin representatives in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.7836 | 0.0062 | -0.0118 | 0.0249 | no clear difference |  |
| 14 Origin representatives in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6277 | -0.0002 | -0.0057 | 0.0054 | no clear difference |  |
| 14 Origin representatives in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.4913 | -0.0453 | -0.1427 | 0.0516 | no clear difference |  |
| 14 Origin representatives in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8346 | 0.0027 | -0.0066 | 0.0116 | no clear difference |  |
| 14 Origin representatives in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6250 | 0.0005 | -0.0011 | 0.0022 | no clear difference |  |
| 14 Origin representatives in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5092 | -0.0057 | -0.0272 | 0.0154 | no clear difference |  |
| 14 Origin representatives in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7817 | 0.0044 | -0.0068 | 0.0158 | no clear difference |  |
| 14 Origin representatives in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6277 | -0.0002 | -0.0023 | 0.0019 | no clear difference |  |
| 14 Origin representatives in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5263 | -0.0103 | -0.0395 | 0.0190 | no clear difference |  |
| 14 Origin representatives in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8346 | 0.0026 | -0.0031 | 0.0086 | no clear difference |  |
