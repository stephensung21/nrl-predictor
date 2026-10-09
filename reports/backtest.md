# Backtest 2023–2025

**Main models:** the ensemble (average of linear and LightGBM) for both variants, with odds and no odds.

Training seasons start in 2021. For each season, the whole development procedure (fixed linear feature sets, tuning of the linear models and LightGBM, Platt calibration) is rerun on earlier seasons only, then the season is predicted. Win-probability metrics are log loss (lower is better); the market benchmark is the Odds Portal average price, since closing odds are missing for most of 2024 and all of 2025.

Caveat: the RAPM settings (penalty 300, 90-day half-life) were chosen on 2022–2024 CV, so the 2023 and 2024 results are slightly optimistic for the RAPM features. The grid was flat, so the effect should be small.

## Pooled over 2023–2025 (631 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 631 | 0.6243 | 0.2173 | 0.6466 | 13.5866 | 10.7185 | 8.5863 |
| With odds: lightgbm | 631 | 0.6297 | 0.2195 | 0.6418 | 13.5679 | 10.9094 | 8.6358 |
| With odds: ensemble | 631 | 0.6245 | 0.2175 | 0.6387 | 13.5148 | 10.7773 | 8.5746 |
| No odds: linear | 631 | 0.6275 | 0.2187 | 0.6292 | 13.6034 | 10.8072 | 8.6633 |
| No odds: lightgbm | 631 | 0.6344 | 0.2213 | 0.6513 | 13.5800 | 10.9292 | 8.6960 |
| No odds: ensemble | 631 | 0.6279 | 0.2188 | 0.6339 | 13.5366 | 10.8319 | 8.6466 |
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
| With odds: ensemble vs market average | 631 | 0.0041 | -0.0092 | 0.0177 | 0.2672 |
| With odds: ensemble vs market opening | 631 | -0.0086 | -0.0203 | 0.0033 | 0.9221 |
| With odds: ensemble vs Elo | 631 | -0.0134 | -0.0266 | -0.0003 | 0.9769 |
| No odds: linear vs market average | 631 | 0.0072 | -0.0086 | 0.0227 | 0.1809 |
| No odds: linear vs market opening | 631 | -0.0055 | -0.0203 | 0.0094 | 0.7626 |
| No odds: linear vs Elo | 631 | -0.0104 | -0.0215 | 0.0013 | 0.9596 |
| No odds: ensemble vs market average | 631 | 0.0075 | -0.0092 | 0.0244 | 0.1861 |
| No odds: ensemble vs market opening | 631 | -0.0052 | -0.0208 | 0.0105 | 0.7300 |
| No odds: ensemble vs Elo | 631 | -0.0100 | -0.0218 | 0.0023 | 0.9472 |

## 2023 (207 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 207 | 0.5944 | 0.2040 | 0.6908 | 13.2912 | 10.4293 | 8.3167 |
| With odds: lightgbm | 207 | 0.6187 | 0.2138 | 0.6715 | 13.5591 | 10.4772 | 8.3861 |
| With odds: ensemble | 207 | 0.6028 | 0.2077 | 0.6667 | 13.3625 | 10.4466 | 8.3271 |
| No odds: linear | 207 | 0.6036 | 0.2081 | 0.6715 | 13.4189 | 10.5214 | 8.4314 |
| No odds: lightgbm | 207 | 0.6285 | 0.2178 | 0.6473 | 13.6007 | 10.5123 | 8.5050 |
| No odds: ensemble | 207 | 0.6115 | 0.2114 | 0.6522 | 13.4261 | 10.5115 | 8.4529 |
| Benchmark: home team | 207 | 0.6846 | 0.2457 | 0.5652 | 14.9282 | 10.5423 | 9.0777 |
| Benchmark: Elo only | 207 | 0.6184 | 0.2140 | 0.6667 | - | - | - |
| Benchmark: market opening | 207 | 0.6016 | 0.2068 | 0.6957 | 13.3357 | 10.5048 | 8.2814 |
| Benchmark: market closing (p_avg) | 207 | 0.5757 | 0.1956 | 0.7005 | - | - | - |

## 2024 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 212 | 0.6312 | 0.2200 | 0.6368 | 13.6968 | 10.7261 | 8.6949 |
| With odds: lightgbm | 212 | 0.6238 | 0.2168 | 0.6462 | 13.3955 | 11.0593 | 8.7078 |
| With odds: ensemble | 212 | 0.6254 | 0.2175 | 0.6368 | 13.4833 | 10.8512 | 8.6587 |
| No odds: linear | 212 | 0.6360 | 0.2216 | 0.6038 | 13.7272 | 10.9687 | 8.8558 |
| No odds: lightgbm | 212 | 0.6251 | 0.2170 | 0.6840 | 13.3844 | 11.1593 | 8.7762 |
| No odds: ensemble | 212 | 0.6277 | 0.2182 | 0.6415 | 13.5123 | 11.0079 | 8.7692 |
| Benchmark: home team | 212 | 0.6795 | 0.2432 | 0.5849 | 14.5303 | 11.1772 | 9.3637 |
| Benchmark: Elo only | 212 | 0.6420 | 0.2249 | 0.6226 | - | - | - |
| Benchmark: market opening | 212 | 0.6369 | 0.2235 | 0.6274 | 13.6745 | 10.8255 | 8.7524 |
| Benchmark: market closing (p_avg) | 212 | 0.6360 | 0.2220 | 0.6274 | - | - | - |

## 2025 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 212 | 0.6465 | 0.2277 | 0.6132 | 13.7649 | 10.9934 | 8.7411 |
| With odds: lightgbm | 212 | 0.6465 | 0.2277 | 0.6085 | 13.7489 | 11.1816 | 8.8077 |
| With odds: ensemble | 212 | 0.6448 | 0.2269 | 0.6132 | 13.6950 | 11.0264 | 8.7321 |
| No odds: linear | 212 | 0.6424 | 0.2261 | 0.6132 | 13.6598 | 10.9248 | 8.6972 |
| No odds: lightgbm | 212 | 0.6495 | 0.2291 | 0.6226 | 13.7553 | 11.1060 | 8.8024 |
| No odds: ensemble | 212 | 0.6440 | 0.2268 | 0.6085 | 13.6687 | 10.9688 | 8.7131 |
| Benchmark: home team | 212 | 0.6858 | 0.2463 | 0.5613 | 14.7944 | 11.2158 | 9.1386 |
| Benchmark: Elo only | 212 | 0.6528 | 0.2309 | 0.5991 | - | - | - |
| Benchmark: market opening | 212 | 0.6600 | 0.2335 | 0.6085 | 13.9670 | 11.1934 | 8.8821 |
| Benchmark: market closing (p_avg) | 212 | 0.6484 | 0.2280 | 0.6274 | - | - | - |

## Real closing odds, where reliable (271 games, mostly 2023)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 271 | 0.6034 | 0.2080 | 0.6863 | 13.5200 | 10.3499 | 8.4049 |
| With odds: lightgbm | 271 | 0.6168 | 0.2130 | 0.6679 | 13.6253 | 10.3219 | 8.3942 |
| With odds: ensemble | 271 | 0.6069 | 0.2094 | 0.6642 | 13.5202 | 10.3149 | 8.3769 |
| No odds: linear | 271 | 0.6143 | 0.2130 | 0.6421 | 13.6653 | 10.4091 | 8.5355 |
| No odds: lightgbm | 271 | 0.6256 | 0.2166 | 0.6642 | 13.7039 | 10.3431 | 8.5253 |
| No odds: ensemble | 271 | 0.6159 | 0.2133 | 0.6421 | 13.6146 | 10.3605 | 8.5151 |
| Benchmark: home team | 271 | 0.6791 | 0.2430 | 0.5867 | 14.8327 | 10.3918 | 9.0503 |
| Benchmark: Elo only | 271 | 0.6195 | 0.2146 | 0.6642 | - | - | - |
| Benchmark: market opening | 271 | 0.6065 | 0.2090 | 0.6863 | 13.4852 | 10.3376 | 8.3164 |
| Benchmark: market closing (p_close) | 271 | 0.5881 | 0.2012 | 0.6863 | 13.2122 | 10.3192 | 8.2149 |

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| With odds: linear vs market closing | 271 | 0.0153 | -0.0031 | 0.0337 | 0.0533 |
| No odds: linear vs market closing | 271 | 0.0262 | 0.0039 | 0.0481 | 0.0093 |
