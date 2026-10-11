# Correlation audit leads (2023–2025 backtest)

Each group is added to the linear models for the listed targets (which also puts it in LightGBM's compact set), or to LightGBM only, and run through the full pipeline backtest. Results are for the main ensembles. `diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

- **rookies:** `diff_rookies` (linear: home_win, margin)
- **impact-based (RAPM) stars out:** `diff_rapm_stars_out` (linear: home_win, margin)
- **Origin spine stars out:** `diff_origin_stars_out_spine` (linear: home_win, margin)

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 46 rookies in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6220 | 0.6212 | -0.0008 | -0.0021 | 0.0005 | no clear difference |  |
| 46 rookies in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.4944 | 13.4485 | -0.0459 | -0.0859 | -0.0055 | better |  |
| 46 rookies in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7776 | 10.7768 | -0.0008 | -0.0082 | 0.0065 | no clear difference |  |
| 46 rookies in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6266 | 0.6254 | -0.0011 | -0.0030 | 0.0008 | no clear difference |  |
| 46 rookies in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5158 | 13.4703 | -0.0455 | -0.1008 | 0.0104 | no clear difference |  |
| 46 rookies in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8333 | 10.8303 | -0.0030 | -0.0090 | 0.0031 | no clear difference |  |
| 46 rookies in LightGBM only: ensemble | With odds | home_win | log loss | 0.6220 | 0.6220 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 46 rookies in LightGBM only: ensemble | With odds | margin | MAE | 13.4944 | 13.4944 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 46 rookies in LightGBM only: ensemble | With odds | total | MAE | 10.7776 | 10.7776 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 46 rookies in LightGBM only: ensemble | No odds | home_win | log loss | 0.6266 | 0.6266 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 46 rookies in LightGBM only: ensemble | No odds | margin | MAE | 13.5158 | 13.5158 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 46 rookies in LightGBM only: ensemble | No odds | total | MAE | 10.8333 | 10.8333 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 46 impact-based (RAPM) stars out in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6220 | 0.6209 | -0.0011 | -0.0024 | 0.0003 | no clear difference |  |
| 46 impact-based (RAPM) stars out in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.4944 | 13.4656 | -0.0288 | -0.0553 | -0.0021 | better |  |
| 46 impact-based (RAPM) stars out in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7776 | 10.7823 | 0.0047 | -0.0074 | 0.0167 | no clear difference |  |
| 46 impact-based (RAPM) stars out in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6266 | 0.6253 | -0.0013 | -0.0029 | 0.0004 | no clear difference |  |
| 46 impact-based (RAPM) stars out in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5158 | 13.4708 | -0.0450 | -0.0823 | -0.0083 | better |  |
| 46 impact-based (RAPM) stars out in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8333 | 10.8336 | 0.0003 | -0.0046 | 0.0052 | no clear difference |  |
| 46 impact-based (RAPM) stars out in LightGBM only: ensemble | With odds | home_win | log loss | 0.6220 | 0.6220 | -0.0001 | -0.0006 | 0.0005 | no clear difference |  |
| 46 impact-based (RAPM) stars out in LightGBM only: ensemble | With odds | margin | MAE | 13.4944 | 13.4922 | -0.0022 | -0.0127 | 0.0084 | no clear difference |  |
| 46 impact-based (RAPM) stars out in LightGBM only: ensemble | With odds | total | MAE | 10.7776 | 10.7779 | 0.0003 | -0.0093 | 0.0101 | no clear difference |  |
| 46 impact-based (RAPM) stars out in LightGBM only: ensemble | No odds | home_win | log loss | 0.6266 | 0.6266 | 0.0000 | -0.0004 | 0.0004 | no clear difference |  |
| 46 impact-based (RAPM) stars out in LightGBM only: ensemble | No odds | margin | MAE | 13.5158 | 13.5142 | -0.0016 | -0.0109 | 0.0074 | no clear difference |  |
| 46 impact-based (RAPM) stars out in LightGBM only: ensemble | No odds | total | MAE | 10.8333 | 10.8268 | -0.0065 | -0.0120 | -0.0007 | better |  |
| 46 Origin spine stars out in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6220 | 0.6216 | -0.0004 | -0.0010 | 0.0003 | no clear difference |  |
| 46 Origin spine stars out in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.4944 | 13.4902 | -0.0042 | -0.0174 | 0.0093 | no clear difference |  |
| 46 Origin spine stars out in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7776 | 10.7835 | 0.0059 | -0.0070 | 0.0189 | no clear difference |  |
| 46 Origin spine stars out in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6266 | 0.6266 | -0.0000 | -0.0007 | 0.0007 | no clear difference |  |
| 46 Origin spine stars out in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5158 | 13.5106 | -0.0052 | -0.0230 | 0.0122 | no clear difference |  |
| 46 Origin spine stars out in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8333 | 10.8335 | 0.0002 | -0.0045 | 0.0048 | no clear difference |  |
| 46 Origin spine stars out in LightGBM only: ensemble | With odds | home_win | log loss | 0.6220 | 0.6219 | -0.0001 | -0.0006 | 0.0004 | no clear difference |  |
| 46 Origin spine stars out in LightGBM only: ensemble | With odds | margin | MAE | 13.4944 | 13.4921 | -0.0023 | -0.0128 | 0.0082 | no clear difference |  |
| 46 Origin spine stars out in LightGBM only: ensemble | With odds | total | MAE | 10.7776 | 10.7782 | 0.0006 | -0.0080 | 0.0095 | no clear difference |  |
| 46 Origin spine stars out in LightGBM only: ensemble | No odds | home_win | log loss | 0.6266 | 0.6266 | 0.0000 | -0.0004 | 0.0004 | no clear difference |  |
| 46 Origin spine stars out in LightGBM only: ensemble | No odds | margin | MAE | 13.5158 | 13.5141 | -0.0017 | -0.0111 | 0.0074 | no clear difference |  |
| 46 Origin spine stars out in LightGBM only: ensemble | No odds | total | MAE | 10.8333 | 10.8274 | -0.0059 | -0.0111 | -0.0008 | better |  |
