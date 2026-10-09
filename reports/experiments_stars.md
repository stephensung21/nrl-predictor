# Star players (2023–2025 backtest)

Each group is added to the linear models for the listed targets (which also puts it in LightGBM's compact set), or to LightGBM only, and run through the full pipeline backtest. Results are for the main ensembles. `diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

- **stats-based stars:** `diff_stars_named`, `diff_stars_out` (linear: home_win, margin)
- **impact-based (RAPM) stars:** `diff_rapm_stars_named`, `diff_rapm_stars_out` (linear: home_win, margin)

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 16 stats-based stars in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6256 | 0.0011 | -0.0011 | 0.0034 | no clear difference |  |
| 16 stats-based stars in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.5575 | 0.0427 | -0.0159 | 0.1006 | no clear difference |  |
| 16 stats-based stars in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.7760 | -0.0013 | -0.0108 | 0.0078 | no clear difference |  |
| 16 stats-based stars in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6296 | 0.0017 | -0.0007 | 0.0042 | no clear difference |  |
| 16 stats-based stars in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.5686 | 0.0320 | -0.0364 | 0.0976 | no clear difference |  |
| 16 stats-based stars in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8406 | 0.0087 | -0.0026 | 0.0199 | no clear difference |  |
| 16 stats-based stars in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6247 | 0.0002 | -0.0003 | 0.0007 | no clear difference |  |
| 16 stats-based stars in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5219 | 0.0070 | -0.0051 | 0.0197 | no clear difference |  |
| 16 stats-based stars in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7768 | -0.0006 | -0.0122 | 0.0110 | no clear difference |  |
| 16 stats-based stars in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6281 | 0.0002 | -0.0004 | 0.0008 | no clear difference |  |
| 16 stats-based stars in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5313 | -0.0053 | -0.0194 | 0.0090 | no clear difference |  |
| 16 stats-based stars in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8301 | -0.0018 | -0.0065 | 0.0030 | no clear difference |  |
| 16 impact-based (RAPM) stars in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6228 | -0.0017 | -0.0038 | 0.0004 | no clear difference |  |
| 16 impact-based (RAPM) stars in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.4716 | -0.0432 | -0.0967 | 0.0129 | no clear difference |  |
| 16 impact-based (RAPM) stars in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.7783 | 0.0010 | -0.0206 | 0.0230 | no clear difference |  |
| 16 impact-based (RAPM) stars in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6268 | -0.0011 | -0.0037 | 0.0015 | no clear difference |  |
| 16 impact-based (RAPM) stars in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.4992 | -0.0373 | -0.1031 | 0.0291 | no clear difference |  |
| 16 impact-based (RAPM) stars in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8311 | -0.0008 | -0.0097 | 0.0079 | no clear difference |  |
| 16 impact-based (RAPM) stars in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6243 | -0.0002 | -0.0010 | 0.0006 | no clear difference |  |
| 16 impact-based (RAPM) stars in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5104 | -0.0044 | -0.0292 | 0.0194 | no clear difference |  |
| 16 impact-based (RAPM) stars in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7782 | 0.0008 | -0.0070 | 0.0090 | no clear difference |  |
| 16 impact-based (RAPM) stars in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6277 | -0.0002 | -0.0011 | 0.0008 | no clear difference |  |
| 16 impact-based (RAPM) stars in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5345 | -0.0021 | -0.0325 | 0.0281 | no clear difference |  |
| 16 impact-based (RAPM) stars in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8311 | -0.0008 | -0.0052 | 0.0036 | no clear difference |  |
