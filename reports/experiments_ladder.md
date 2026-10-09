# Ladder position and motivation (2023–2025 backtest)

Each group is added to the linear models for the listed targets (which also puts it in LightGBM's compact set), or to LightGBM only, and run through the full pipeline backtest. Results are for the main ensembles. `diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

- **ladder position and contention:** `diff_ladder_pos`, `diff_out_of_contention` (linear: home_win, margin, total)

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 15 ladder position and contention in linear (and LightGBM): ensemble | With odds | home_win | log loss | 0.6245 | 0.6241 | -0.0003 | -0.0017 | 0.0010 | no clear difference |  |
| 15 ladder position and contention in linear (and LightGBM): ensemble | With odds | margin | MAE | 13.5148 | 13.5054 | -0.0095 | -0.0418 | 0.0241 | no clear difference |  |
| 15 ladder position and contention in linear (and LightGBM): ensemble | With odds | total | MAE | 10.7773 | 10.7876 | 0.0102 | -0.0172 | 0.0378 | no clear difference |  |
| 15 ladder position and contention in linear (and LightGBM): ensemble | No odds | home_win | log loss | 0.6279 | 0.6279 | 0.0000 | -0.0018 | 0.0018 | no clear difference |  |
| 15 ladder position and contention in linear (and LightGBM): ensemble | No odds | margin | MAE | 13.5366 | 13.5112 | -0.0254 | -0.0686 | 0.0192 | no clear difference |  |
| 15 ladder position and contention in linear (and LightGBM): ensemble | No odds | total | MAE | 10.8319 | 10.8413 | 0.0094 | -0.0042 | 0.0239 | no clear difference |  |
| 15 ladder position and contention in LightGBM only: ensemble | With odds | home_win | log loss | 0.6245 | 0.6247 | 0.0002 | -0.0003 | 0.0007 | no clear difference |  |
| 15 ladder position and contention in LightGBM only: ensemble | With odds | margin | MAE | 13.5148 | 13.5082 | -0.0067 | -0.0161 | 0.0027 | no clear difference |  |
| 15 ladder position and contention in LightGBM only: ensemble | With odds | total | MAE | 10.7773 | 10.7775 | 0.0002 | -0.0057 | 0.0063 | no clear difference |  |
| 15 ladder position and contention in LightGBM only: ensemble | No odds | home_win | log loss | 0.6279 | 0.6280 | 0.0001 | -0.0004 | 0.0006 | no clear difference |  |
| 15 ladder position and contention in LightGBM only: ensemble | No odds | margin | MAE | 13.5366 | 13.5344 | -0.0022 | -0.0107 | 0.0067 | no clear difference |  |
| 15 ladder position and contention in LightGBM only: ensemble | No odds | total | MAE | 10.8319 | 10.8342 | 0.0022 | -0.0035 | 0.0082 | no clear difference |  |
