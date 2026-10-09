# Backtest 2023–2025

**Main models:** the ensemble (average of linear and LightGBM) for both variants, with odds and no odds.

Training seasons start in 2021. For each season, the whole development procedure (fixed linear feature sets, tuning of the linear models and LightGBM, Platt calibration) is rerun on earlier seasons only, then the season is predicted. Win-probability metrics are log loss (lower is better); the market benchmark is the Odds Portal average price, since closing odds are missing for most of 2024 and all of 2025.

Caveat: the RAPM settings (penalty 300, 90-day half-life) were chosen on 2022–2024 CV, so the 2023 and 2024 results are slightly optimistic for the RAPM features. The grid was flat, so the effect should be small.

## Pooled over 2023–2025 (631 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 631 | 0.6243 | 0.2173 | 0.6466 | 13.5866 | 10.7185 | 8.5863 |
| With odds: lightgbm | 631 | 0.6397 | 0.2228 | 0.6418 | 13.8344 | 11.0725 | 8.7711 |
| With odds: ensemble | 631 | 0.6280 | 0.2186 | 0.6323 | 13.6060 | 10.8516 | 8.6267 |
| No odds: linear | 631 | 0.6275 | 0.2187 | 0.6292 | 13.6034 | 10.8072 | 8.6633 |
| No odds: lightgbm | 631 | 0.6375 | 0.2221 | 0.6513 | 13.6713 | 11.0076 | 8.7187 |
| No odds: ensemble | 631 | 0.6281 | 0.2188 | 0.6323 | 13.5052 | 10.8607 | 8.6501 |
| Benchmark: home team | 631 | 0.6833 | 0.2451 | 0.5705 | 14.7495 | 10.9819 | 9.1942 |
| Benchmark: Elo only | 631 | 0.6379 | 0.2233 | 0.6292 | - | - | - |
| Benchmark: market opening | 631 | 0.6331 | 0.2214 | 0.6434 | 13.6616 | 10.8439 | 8.6414 |
| Benchmark: market closing (p_avg) | 631 | 0.6204 | 0.2154 | 0.6513 | - | 10.7187 | - |

## Paired bootstrap, pooled (log-loss difference; negative = model better)

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| With odds: linear vs market average | 631 | 0.0039 | -0.0078 | 0.0158 | 0.2559 |
| With odds: linear vs market opening | 631 | -0.0088 | -0.0188 | 0.0015 | 0.9514 |
| With odds: linear vs Elo | 631 | -0.0136 | -0.0270 | -0.0002 | 0.9773 |
| With odds: ensemble vs market average | 631 | 0.0076 | -0.0056 | 0.0213 | 0.1285 |
| With odds: ensemble vs market opening | 631 | -0.0051 | -0.0177 | 0.0082 | 0.7747 |
| With odds: ensemble vs Elo | 631 | -0.0099 | -0.0243 | 0.0046 | 0.9118 |
| No odds: linear vs market average | 631 | 0.0072 | -0.0086 | 0.0227 | 0.1809 |
| No odds: linear vs market opening | 631 | -0.0055 | -0.0203 | 0.0094 | 0.7626 |
| No odds: linear vs Elo | 631 | -0.0104 | -0.0215 | 0.0013 | 0.9596 |
| No odds: ensemble vs market average | 631 | 0.0078 | -0.0090 | 0.0247 | 0.1794 |
| No odds: ensemble vs market opening | 631 | -0.0049 | -0.0213 | 0.0120 | 0.7092 |
| No odds: ensemble vs Elo | 631 | -0.0098 | -0.0228 | 0.0039 | 0.9239 |

## 2023 (207 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 207 | 0.5944 | 0.2040 | 0.6908 | 13.2912 | 10.4293 | 8.3167 |
| With odds: lightgbm | 207 | 0.6262 | 0.2156 | 0.6667 | 13.5820 | 10.8552 | 8.4754 |
| With odds: ensemble | 207 | 0.6049 | 0.2082 | 0.6570 | 13.2941 | 10.6256 | 8.3549 |
| No odds: linear | 207 | 0.6036 | 0.2081 | 0.6715 | 13.4189 | 10.5214 | 8.4314 |
| No odds: lightgbm | 207 | 0.6330 | 0.2176 | 0.6908 | 13.4186 | 10.5624 | 8.3989 |
| No odds: ensemble | 207 | 0.6118 | 0.2109 | 0.6667 | 13.2279 | 10.5412 | 8.3883 |
| Benchmark: home team | 207 | 0.6846 | 0.2457 | 0.5652 | 14.9282 | 10.5423 | 9.0777 |
| Benchmark: Elo only | 207 | 0.6184 | 0.2140 | 0.6667 | - | - | - |
| Benchmark: market opening | 207 | 0.6016 | 0.2068 | 0.6957 | 13.3357 | 10.5048 | 8.2814 |
| Benchmark: market closing (p_avg) | 207 | 0.5757 | 0.1956 | 0.7005 | - | - | - |

## 2024 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 212 | 0.6312 | 0.2200 | 0.6368 | 13.6968 | 10.7261 | 8.6949 |
| With odds: lightgbm | 212 | 0.6372 | 0.2212 | 0.6462 | 14.1806 | 11.1399 | 9.0127 |
| With odds: ensemble | 212 | 0.6299 | 0.2188 | 0.6415 | 13.8505 | 10.8786 | 8.7754 |
| No odds: linear | 212 | 0.6360 | 0.2216 | 0.6038 | 13.7272 | 10.9687 | 8.8558 |
| No odds: lightgbm | 212 | 0.6255 | 0.2175 | 0.6462 | 13.6108 | 11.2102 | 8.8831 |
| No odds: ensemble | 212 | 0.6259 | 0.2176 | 0.6274 | 13.5643 | 11.0279 | 8.8133 |
| Benchmark: home team | 212 | 0.6795 | 0.2432 | 0.5849 | 14.5303 | 11.1772 | 9.3637 |
| Benchmark: Elo only | 212 | 0.6420 | 0.2249 | 0.6226 | - | - | - |
| Benchmark: market opening | 212 | 0.6369 | 0.2235 | 0.6274 | 13.6745 | 10.8255 | 8.7524 |
| Benchmark: market closing (p_avg) | 212 | 0.6360 | 0.2220 | 0.6274 | - | - | - |

## 2025 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 212 | 0.6465 | 0.2277 | 0.6132 | 13.7649 | 10.9934 | 8.7411 |
| With odds: lightgbm | 212 | 0.6555 | 0.2315 | 0.6132 | 13.7348 | 11.2171 | 8.8183 |
| With odds: ensemble | 212 | 0.6486 | 0.2286 | 0.5991 | 13.6660 | 11.0452 | 8.7433 |
| No odds: linear | 212 | 0.6424 | 0.2261 | 0.6132 | 13.6598 | 10.9248 | 8.6972 |
| No odds: lightgbm | 212 | 0.6540 | 0.2311 | 0.6179 | 13.9785 | 11.2396 | 8.8667 |
| No odds: ensemble | 212 | 0.6463 | 0.2278 | 0.6038 | 13.7168 | 11.0055 | 8.7424 |
| Benchmark: home team | 212 | 0.6858 | 0.2463 | 0.5613 | 14.7944 | 11.2158 | 9.1386 |
| Benchmark: Elo only | 212 | 0.6528 | 0.2309 | 0.5991 | - | - | - |
| Benchmark: market opening | 212 | 0.6600 | 0.2335 | 0.6085 | 13.9670 | 11.1934 | 8.8821 |
| Benchmark: market closing (p_avg) | 212 | 0.6484 | 0.2280 | 0.6274 | - | - | - |

## Real closing odds, where reliable (271 games, mostly 2023)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 271 | 0.6034 | 0.2080 | 0.6863 | 13.5200 | 10.3499 | 8.4049 |
| With odds: lightgbm | 271 | 0.6236 | 0.2148 | 0.6716 | 13.8191 | 10.6388 | 8.5611 |
| With odds: ensemble | 271 | 0.6083 | 0.2097 | 0.6568 | 13.5554 | 10.4666 | 8.4413 |
| No odds: linear | 271 | 0.6143 | 0.2130 | 0.6421 | 13.6653 | 10.4091 | 8.5355 |
| No odds: lightgbm | 271 | 0.6288 | 0.2168 | 0.6790 | 13.5586 | 10.3599 | 8.4604 |
| No odds: ensemble | 271 | 0.6155 | 0.2129 | 0.6568 | 13.4483 | 10.3685 | 8.4729 |
| Benchmark: home team | 271 | 0.6791 | 0.2430 | 0.5867 | 14.8327 | 10.3918 | 9.0503 |
| Benchmark: Elo only | 271 | 0.6195 | 0.2146 | 0.6642 | - | - | - |
| Benchmark: market opening | 271 | 0.6065 | 0.2090 | 0.6863 | 13.4852 | 10.3376 | 8.3164 |
| Benchmark: market closing (p_close) | 271 | 0.5881 | 0.2012 | 0.6863 | 13.2122 | 10.3192 | 8.2149 |

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| With odds: linear vs market closing | 271 | 0.0153 | -0.0031 | 0.0337 | 0.0533 |
| No odds: linear vs market closing | 271 | 0.0262 | 0.0039 | 0.0481 | 0.0093 |
