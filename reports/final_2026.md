# Final test (2026)

**Main models:** the ensemble (average of linear and LightGBM) for both variants, with odds and no odds.

Run once, with exactly the backtest procedure: feature sets, tuning and calibration developed on 2021–2025 only, then every 2026 game predicted. Features for each game use only results before it; the models are not refitted during the season. Commit `c43c38e`; settings and the features.csv hash are in `reports/final_2026_run.json`.

## Games with reliable closing odds (197 of 213)

The main benchmark: the market's closing price, line and total.

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 197 | 0.6540 | 0.2296 | 0.6548 | 15.1945 | 10.9255 | 9.3017 |
| With odds: lightgbm | 197 | 0.6459 | 0.2266 | 0.6497 | 15.4396 | 10.9199 | 9.2856 |
| With odds: ensemble | 197 | 0.6478 | 0.2271 | 0.6751 | 15.2697 | 10.8957 | 9.2393 |
| No odds: linear | 197 | 0.6574 | 0.2301 | 0.6345 | 15.5384 | 11.0991 | 9.3337 |
| No odds: lightgbm | 197 | 0.6519 | 0.2293 | 0.6345 | 15.5723 | 11.0922 | 9.2670 |
| No odds: ensemble | 197 | 0.6514 | 0.2287 | 0.6294 | 15.5029 | 11.0735 | 9.2645 |
| Benchmark: home team | 197 | 0.6935 | 0.2502 | 0.5330 | 16.0136 | 11.2287 | 9.8301 |
| Benchmark: Elo only | 197 | 0.6581 | 0.2322 | 0.6244 | - | - | - |
| Benchmark: market opening | 197 | 0.6579 | 0.2318 | 0.6244 | 15.2640 | 11.1294 | 9.3756 |
| Benchmark: market closing (p_close) | 197 | 0.6467 | 0.2261 | 0.6193 | 15.2005 | 11.0635 | 9.3566 |

## All 213 games (closing benchmark = Odds Portal average price, closing total)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 213 | 0.6556 | 0.2304 | 0.6526 | 15.2370 | 11.0074 | 9.3098 |
| With odds: lightgbm | 213 | 0.6520 | 0.2292 | 0.6479 | 15.4896 | 10.9579 | 9.2888 |
| With odds: ensemble | 213 | 0.6516 | 0.2289 | 0.6714 | 15.3195 | 10.9576 | 9.2491 |
| No odds: linear | 213 | 0.6603 | 0.2317 | 0.6338 | 15.5910 | 11.1578 | 9.3523 |
| No odds: lightgbm | 213 | 0.6566 | 0.2314 | 0.6338 | 15.6174 | 11.1193 | 9.2669 |
| No odds: ensemble | 213 | 0.6553 | 0.2306 | 0.6291 | 15.5557 | 11.1181 | 9.2732 |
| Benchmark: home team | 213 | 0.6903 | 0.2486 | 0.5446 | 15.9563 | 11.2162 | 9.8078 |
| Benchmark: Elo only | 213 | 0.6600 | 0.2333 | 0.6244 | - | - | - |
| Benchmark: market opening | 213 | 0.6632 | 0.2342 | 0.6244 | 15.2723 | 11.1526 | 9.3873 |
| Benchmark: market closing (p_avg) | 213 | 0.6530 | 0.2286 | 0.6150 | - | 11.0822 | - |

## Paired bootstrap (log-loss difference; negative = model better)

Against market closing on the 197 reliable games, the others on all 213.

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| With odds: linear vs market closing | 197 | 0.0073 | -0.0139 | 0.0272 | 0.2506 |
| With odds: linear vs market average | 213 | 0.0026 | -0.0180 | 0.0227 | 0.3971 |
| With odds: linear vs market opening | 213 | -0.0076 | -0.0272 | 0.0122 | 0.7697 |
| With odds: linear vs Elo | 213 | -0.0044 | -0.0254 | 0.0165 | 0.6561 |
| With odds: lightgbm vs market closing | 197 | -0.0008 | -0.0262 | 0.0237 | 0.5230 |
| With odds: lightgbm vs market average | 213 | -0.0011 | -0.0263 | 0.0231 | 0.5304 |
| With odds: lightgbm vs market opening | 213 | -0.0112 | -0.0306 | 0.0083 | 0.8708 |
| With odds: lightgbm vs Elo | 213 | -0.0080 | -0.0283 | 0.0125 | 0.7882 |
| With odds: ensemble vs market closing | 197 | 0.0011 | -0.0205 | 0.0214 | 0.4585 |
| With odds: ensemble vs market average | 213 | -0.0014 | -0.0228 | 0.0195 | 0.5473 |
| With odds: ensemble vs market opening | 213 | -0.0116 | -0.0289 | 0.0059 | 0.9008 |
| With odds: ensemble vs Elo | 213 | -0.0084 | -0.0271 | 0.0100 | 0.8130 |
| No odds: linear vs market closing | 197 | 0.0106 | -0.0140 | 0.0346 | 0.1984 |
| No odds: linear vs market average | 213 | 0.0072 | -0.0146 | 0.0298 | 0.2673 |
| No odds: linear vs market opening | 213 | -0.0029 | -0.0259 | 0.0212 | 0.5997 |
| No odds: linear vs Elo | 213 | 0.0003 | -0.0207 | 0.0219 | 0.4937 |
| No odds: lightgbm vs market closing | 197 | 0.0051 | -0.0244 | 0.0341 | 0.3670 |
| No odds: lightgbm vs market average | 213 | 0.0036 | -0.0250 | 0.0312 | 0.4039 |
| No odds: lightgbm vs market opening | 213 | -0.0066 | -0.0303 | 0.0173 | 0.7126 |
| No odds: lightgbm vs Elo | 213 | -0.0034 | -0.0246 | 0.0180 | 0.6325 |
| No odds: ensemble vs market closing | 197 | 0.0047 | -0.0199 | 0.0284 | 0.3568 |
| No odds: ensemble vs market average | 213 | 0.0023 | -0.0211 | 0.0256 | 0.4228 |
| No odds: ensemble vs market opening | 213 | -0.0078 | -0.0284 | 0.0131 | 0.7737 |
| No odds: ensemble vs Elo | 213 | -0.0047 | -0.0230 | 0.0138 | 0.6985 |

## Calibration of the main models

| variant, probability band | games | predicted | actual |
|---|---|---|---|
| With odds (-0.001, 0.35] | 26 | 0.2839 | 0.4231 |
| With odds (0.35, 0.5] | 35 | 0.4251 | 0.1714 |
| With odds (0.5, 0.65] | 79 | 0.5742 | 0.5949 |
| With odds (0.65, 1.0] | 73 | 0.7282 | 0.7123 |
| No odds (-0.001, 0.35] | 33 | 0.2658 | 0.3939 |
| No odds (0.35, 0.5] | 31 | 0.4316 | 0.3226 |
| No odds (0.5, 0.65] | 76 | 0.5809 | 0.5526 |
| No odds (0.65, 1.0] | 73 | 0.7381 | 0.6986 |
