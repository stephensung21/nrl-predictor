# Origin-based star absences (2023–2025 backtest)

Each group is added to the linear models for the listed targets (which also puts it in LightGBM's compact set), or to LightGBM only, and run through the full pipeline backtest. Results are for the main ensembles. `diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

- **S1 Origin stars out (spine / other):** `diff_origin_stars_out_spine`, `diff_origin_stars_out_other` (linear: home_win, margin)
- **S2 Origin or elite-form stars out (spine / other):** `diff_s2_stars_out_spine`, `diff_s2_stars_out_other` (linear: home_win, margin)

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 18 S1 Origin stars out (spine / other) in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6233 | -0.0012 | -0.0025 | 0.0002 | no clear difference |  |
| 18 S1 Origin stars out (spine / other) in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.4905 | -0.0244 | -0.0585 | 0.0111 | no clear difference |  |
| 18 S1 Origin stars out (spine / other) in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.7763 | -0.0011 | -0.0158 | 0.0138 | no clear difference |  |
| 18 S1 Origin stars out (spine / other) in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6271 | -0.0007 | -0.0024 | 0.0010 | no clear difference |  |
| 18 S1 Origin stars out (spine / other) in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.5066 | -0.0300 | -0.0677 | 0.0086 | no clear difference |  |
| 18 S1 Origin stars out (spine / other) in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8331 | 0.0012 | -0.0074 | 0.0098 | no clear difference |  |
| 18 S1 Origin stars out (spine / other) in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6243 | -0.0001 | -0.0007 | 0.0004 | no clear difference |  |
| 18 S1 Origin stars out (spine / other) in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5191 | 0.0043 | -0.0057 | 0.0144 | no clear difference |  |
| 18 S1 Origin stars out (spine / other) in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7769 | -0.0005 | -0.0113 | 0.0104 | no clear difference |  |
| 18 S1 Origin stars out (spine / other) in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6281 | 0.0002 | -0.0004 | 0.0009 | no clear difference |  |
| 18 S1 Origin stars out (spine / other) in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5271 | -0.0095 | -0.0173 | -0.0016 | better |  |
| 18 S1 Origin stars out (spine / other) in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8320 | 0.0000 | -0.0045 | 0.0044 | no clear difference |  |
| 18 S2 Origin or elite-form stars out (spine / other) in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6230 | -0.0015 | -0.0029 | -0.0001 | better |  |
| 18 S2 Origin or elite-form stars out (spine / other) in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.4924 | -0.0224 | -0.0609 | 0.0158 | no clear difference |  |
| 18 S2 Origin or elite-form stars out (spine / other) in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.7696 | -0.0077 | -0.0177 | 0.0022 | no clear difference |  |
| 18 S2 Origin or elite-form stars out (spine / other) in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6266 | -0.0013 | -0.0028 | 0.0003 | no clear difference |  |
| 18 S2 Origin or elite-form stars out (spine / other) in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.5158 | -0.0208 | -0.0602 | 0.0185 | no clear difference |  |
| 18 S2 Origin or elite-form stars out (spine / other) in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8333 | 0.0014 | -0.0081 | 0.0110 | no clear difference |  |
| 18 S2 Origin or elite-form stars out (spine / other) in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6242 | -0.0002 | -0.0008 | 0.0003 | no clear difference |  |
| 18 S2 Origin or elite-form stars out (spine / other) in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5161 | 0.0013 | -0.0067 | 0.0091 | no clear difference |  |
| 18 S2 Origin or elite-form stars out (spine / other) in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7717 | -0.0056 | -0.0162 | 0.0048 | no clear difference |  |
| 18 S2 Origin or elite-form stars out (spine / other) in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6279 | 0.0000 | -0.0006 | 0.0007 | no clear difference |  |
| 18 S2 Origin or elite-form stars out (spine / other) in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5274 | -0.0092 | -0.0173 | -0.0011 | better |  |
| 18 S2 Origin or elite-form stars out (spine / other) in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8304 | -0.0015 | -0.0068 | 0.0035 | no clear difference |  |
