# Key-position star absences (2023–2025 backtest)

Each group is added to the linear models for the listed targets (which also puts it in LightGBM's compact set), or to LightGBM only, and run through the full pipeline backtest. Results are for the main ensembles. `diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

- **V1 key absences by position:** `diff_missq_fullback`, `diff_missq_halfback`, `diff_missq_five_eighth`, `diff_missq_hooker` (linear: home_win, margin)
- **V2 combined star-absence score:** `diff_key_absence` (linear: home_win, margin)
- **V3 key stars out (top 20%):** `diff_key_star_out` (linear: home_win, margin)
- **V4 impact-based (with/without) stars out:** `diff_impact_out` (linear: home_win, margin)

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 17 V1 key absences by position in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6233 | -0.0012 | -0.0036 | 0.0013 | no clear difference |  |
| 17 V1 key absences by position in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.5048 | -0.0101 | -0.0482 | 0.0304 | no clear difference |  |
| 17 V1 key absences by position in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.7803 | 0.0030 | -0.0104 | 0.0171 | no clear difference |  |
| 17 V1 key absences by position in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6260 | -0.0019 | -0.0050 | 0.0013 | no clear difference |  |
| 17 V1 key absences by position in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.5287 | -0.0078 | -0.0580 | 0.0435 | no clear difference |  |
| 17 V1 key absences by position in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8363 | 0.0044 | -0.0041 | 0.0131 | no clear difference |  |
| 17 V1 key absences by position in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6241 | -0.0003 | -0.0011 | 0.0004 | no clear difference |  |
| 17 V1 key absences by position in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5148 | -0.0000 | -0.0094 | 0.0094 | no clear difference |  |
| 17 V1 key absences by position in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7763 | -0.0010 | -0.0138 | 0.0118 | no clear difference |  |
| 17 V1 key absences by position in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6273 | -0.0006 | -0.0015 | 0.0004 | no clear difference |  |
| 17 V1 key absences by position in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5271 | -0.0094 | -0.0188 | -0.0003 | better |  |
| 17 V1 key absences by position in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8405 | 0.0086 | -0.0027 | 0.0199 | no clear difference |  |
| 17 V2 combined star-absence score in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6239 | -0.0006 | -0.0025 | 0.0012 | no clear difference |  |
| 17 V2 combined star-absence score in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.5071 | -0.0077 | -0.0353 | 0.0192 | no clear difference |  |
| 17 V2 combined star-absence score in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.7750 | -0.0024 | -0.0201 | 0.0156 | no clear difference |  |
| 17 V2 combined star-absence score in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6265 | -0.0014 | -0.0041 | 0.0012 | no clear difference |  |
| 17 V2 combined star-absence score in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.5176 | -0.0189 | -0.0643 | 0.0267 | no clear difference |  |
| 17 V2 combined star-absence score in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8267 | -0.0052 | -0.0181 | 0.0078 | no clear difference |  |
| 17 V2 combined star-absence score in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6238 | -0.0007 | -0.0019 | 0.0005 | no clear difference |  |
| 17 V2 combined star-absence score in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5015 | -0.0133 | -0.0267 | 0.0001 | no clear difference |  |
| 17 V2 combined star-absence score in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7739 | -0.0034 | -0.0221 | 0.0153 | no clear difference |  |
| 17 V2 combined star-absence score in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6270 | -0.0009 | -0.0023 | 0.0005 | no clear difference |  |
| 17 V2 combined star-absence score in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5262 | -0.0104 | -0.0275 | 0.0062 | no clear difference |  |
| 17 V2 combined star-absence score in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8373 | 0.0053 | -0.0033 | 0.0137 | no clear difference |  |
| 17 V3 key stars out (top 20%) in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6244 | -0.0001 | -0.0009 | 0.0007 | no clear difference |  |
| 17 V3 key stars out (top 20%) in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.5121 | -0.0028 | -0.0185 | 0.0131 | no clear difference |  |
| 17 V3 key stars out (top 20%) in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.7779 | 0.0006 | -0.0173 | 0.0188 | no clear difference |  |
| 17 V3 key stars out (top 20%) in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6274 | -0.0004 | -0.0015 | 0.0006 | no clear difference |  |
| 17 V3 key stars out (top 20%) in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.5249 | -0.0117 | -0.0318 | 0.0096 | no clear difference |  |
| 17 V3 key stars out (top 20%) in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8361 | 0.0042 | -0.0059 | 0.0140 | no clear difference |  |
| 17 V3 key stars out (top 20%) in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6247 | 0.0002 | -0.0002 | 0.0007 | no clear difference |  |
| 17 V3 key stars out (top 20%) in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5081 | -0.0067 | -0.0164 | 0.0028 | no clear difference |  |
| 17 V3 key stars out (top 20%) in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7772 | -0.0002 | -0.0049 | 0.0048 | no clear difference |  |
| 17 V3 key stars out (top 20%) in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6276 | -0.0002 | -0.0006 | 0.0001 | no clear difference |  |
| 17 V3 key stars out (top 20%) in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5351 | -0.0014 | -0.0103 | 0.0077 | no clear difference |  |
| 17 V3 key stars out (top 20%) in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8351 | 0.0032 | -0.0025 | 0.0093 | no clear difference |  |
| 17 V4 impact-based (with/without) stars out in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6247 | 0.0002 | -0.0013 | 0.0017 | no clear difference |  |
| 17 V4 impact-based (with/without) stars out in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.5130 | -0.0019 | -0.0342 | 0.0317 | no clear difference |  |
| 17 V4 impact-based (with/without) stars out in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.7784 | 0.0011 | -0.0206 | 0.0232 | no clear difference |  |
| 17 V4 impact-based (with/without) stars out in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6282 | 0.0004 | -0.0012 | 0.0020 | no clear difference |  |
| 17 V4 impact-based (with/without) stars out in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.5426 | 0.0061 | -0.0360 | 0.0452 | no clear difference |  |
| 17 V4 impact-based (with/without) stars out in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8341 | 0.0022 | -0.0129 | 0.0179 | no clear difference |  |
| 17 V4 impact-based (with/without) stars out in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6247 | 0.0003 | -0.0008 | 0.0014 | no clear difference |  |
| 17 V4 impact-based (with/without) stars out in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5078 | -0.0070 | -0.0278 | 0.0147 | no clear difference |  |
| 17 V4 impact-based (with/without) stars out in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7799 | 0.0025 | -0.0289 | 0.0336 | no clear difference |  |
| 17 V4 impact-based (with/without) stars out in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6281 | 0.0002 | -0.0008 | 0.0011 | no clear difference |  |
| 17 V4 impact-based (with/without) stars out in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5412 | 0.0046 | -0.0205 | 0.0301 | no clear difference |  |
| 17 V4 impact-based (with/without) stars out in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8371 | 0.0052 | -0.0068 | 0.0170 | no clear difference |  |
