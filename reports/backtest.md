# Backtest 2023–2025

**Main models:** the ensemble (average of linear and LightGBM) for both variants, with odds and no odds.

Training seasons start in 2021. For each season, the whole development procedure (fixed linear feature sets, tuning of the linear models and LightGBM, Platt calibration) is rerun on earlier seasons only, then the season is predicted. Win-probability metrics are log loss (lower is better); the market benchmark is the Odds Portal average price, since closing odds are missing for most of 2024 and all of 2025.

Caveat: the RAPM settings (penalty 300, 90-day half-life) were chosen on 2022–2024 CV, so the 2023 and 2024 results are slightly optimistic for the RAPM features. The grid was flat, so the effect should be small.

## Pooled over 2023–2025 (631 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 631 | 0.6243 | 0.2173 | 0.6466 | 13.5894 | 10.7321 | 8.5878 |
| With odds: lightgbm | 631 | 0.6340 | 0.2208 | 0.6355 | 13.8625 | 10.9526 | 8.7636 |
| With odds: ensemble | 631 | 0.6251 | 0.2175 | 0.6371 | 13.5854 | 10.8008 | 8.6271 |
| No odds: linear | 631 | 0.6279 | 0.2188 | 0.6307 | 13.6112 | 10.7977 | 8.6607 |
| No odds: lightgbm | 631 | 0.6405 | 0.2234 | 0.6355 | 13.8433 | 10.9555 | 8.7786 |
| No odds: ensemble | 631 | 0.6302 | 0.2196 | 0.6260 | 13.6051 | 10.8358 | 8.6747 |
| Benchmark: home team | 631 | 0.6833 | 0.2451 | 0.5705 | 14.7512 | 10.9813 | 9.1924 |
| Benchmark: Elo only | 631 | 0.6379 | 0.2233 | 0.6292 | - | - | - |
| Benchmark: market opening | 631 | 0.6331 | 0.2214 | 0.6434 | 13.6616 | 10.8439 | 8.6414 |
| Benchmark: market closing (p_avg) | 631 | 0.6204 | 0.2154 | 0.6513 | - | 10.7187 | - |

## Paired bootstrap, pooled (log-loss difference; negative = model better)

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| With odds: linear vs market average | 631 | 0.0040 | -0.0078 | 0.0160 | 0.2540 |
| With odds: linear vs market opening | 631 | -0.0087 | -0.0189 | 0.0018 | 0.9479 |
| With odds: linear vs Elo | 631 | -0.0136 | -0.0269 | -0.0001 | 0.9755 |
| With odds: ensemble vs market average | 631 | 0.0047 | -0.0088 | 0.0184 | 0.2451 |
| With odds: ensemble vs market opening | 631 | -0.0080 | -0.0210 | 0.0053 | 0.8802 |
| With odds: ensemble vs Elo | 631 | -0.0128 | -0.0270 | 0.0015 | 0.9600 |
| No odds: linear vs market average | 631 | 0.0075 | -0.0083 | 0.0231 | 0.1728 |
| No odds: linear vs market opening | 631 | -0.0052 | -0.0202 | 0.0101 | 0.7451 |
| No odds: linear vs Elo | 631 | -0.0100 | -0.0214 | 0.0019 | 0.9506 |
| No odds: ensemble vs market average | 631 | 0.0099 | -0.0066 | 0.0266 | 0.1170 |
| No odds: ensemble vs market opening | 631 | -0.0028 | -0.0193 | 0.0141 | 0.6256 |
| No odds: ensemble vs Elo | 631 | -0.0077 | -0.0205 | 0.0055 | 0.8734 |

## 2023 (207 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 207 | 0.5945 | 0.2040 | 0.6908 | 13.2976 | 10.4204 | 8.3102 |
| With odds: lightgbm | 207 | 0.6195 | 0.2128 | 0.6618 | 13.6621 | 10.6011 | 8.5141 |
| With odds: ensemble | 207 | 0.6007 | 0.2064 | 0.6618 | 13.3132 | 10.5024 | 8.3661 |
| No odds: linear | 207 | 0.6037 | 0.2081 | 0.6715 | 13.4306 | 10.4852 | 8.4179 |
| No odds: lightgbm | 207 | 0.6296 | 0.2172 | 0.6570 | 13.8124 | 10.5698 | 8.5925 |
| No odds: ensemble | 207 | 0.6115 | 0.2110 | 0.6570 | 13.4311 | 10.5154 | 8.4686 |
| Benchmark: home team | 207 | 0.6846 | 0.2457 | 0.5652 | 14.9359 | 10.5400 | 9.0753 |
| Benchmark: Elo only | 207 | 0.6184 | 0.2140 | 0.6667 | - | - | - |
| Benchmark: market opening | 207 | 0.6016 | 0.2068 | 0.6957 | 13.3357 | 10.5048 | 8.2814 |
| Benchmark: market closing (p_avg) | 207 | 0.5757 | 0.1956 | 0.7005 | - | - | - |

## 2024 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 212 | 0.6313 | 0.2200 | 0.6368 | 13.6994 | 10.7676 | 8.7037 |
| With odds: lightgbm | 212 | 0.6321 | 0.2201 | 0.6368 | 14.1182 | 11.0008 | 8.9085 |
| With odds: ensemble | 212 | 0.6285 | 0.2187 | 0.6368 | 13.7509 | 10.8475 | 8.7471 |
| No odds: linear | 212 | 0.6369 | 0.2217 | 0.6085 | 13.7342 | 10.9709 | 8.8589 |
| No odds: lightgbm | 212 | 0.6349 | 0.2211 | 0.6415 | 13.9669 | 11.1891 | 8.9337 |
| No odds: ensemble | 212 | 0.6324 | 0.2199 | 0.6321 | 13.7547 | 11.0402 | 8.8482 |
| Benchmark: home team | 212 | 0.6794 | 0.2431 | 0.5849 | 14.5288 | 11.1783 | 9.3620 |
| Benchmark: Elo only | 212 | 0.6420 | 0.2249 | 0.6226 | - | - | - |
| Benchmark: market opening | 212 | 0.6369 | 0.2235 | 0.6274 | 13.6745 | 10.8255 | 8.7524 |
| Benchmark: market closing (p_avg) | 212 | 0.6360 | 0.2220 | 0.6274 | - | - | - |

## 2025 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 212 | 0.6465 | 0.2277 | 0.6132 | 13.7643 | 11.0010 | 8.7431 |
| With odds: lightgbm | 212 | 0.6502 | 0.2293 | 0.6085 | 13.8024 | 11.2476 | 8.8623 |
| With odds: ensemble | 212 | 0.6454 | 0.2272 | 0.6132 | 13.6857 | 11.0453 | 8.7619 |
| No odds: linear | 212 | 0.6424 | 0.2261 | 0.6132 | 13.6644 | 10.9297 | 8.6997 |
| No odds: lightgbm | 212 | 0.6568 | 0.2318 | 0.6085 | 13.7498 | 11.0987 | 8.8052 |
| No odds: ensemble | 212 | 0.6463 | 0.2276 | 0.5896 | 13.6253 | 10.9443 | 8.7025 |
| Benchmark: home team | 212 | 0.6858 | 0.2463 | 0.5613 | 14.7933 | 11.2152 | 9.1371 |
| Benchmark: Elo only | 212 | 0.6528 | 0.2309 | 0.5991 | - | - | - |
| Benchmark: market opening | 212 | 0.6600 | 0.2335 | 0.6085 | 13.9670 | 11.1934 | 8.8821 |
| Benchmark: market closing (p_avg) | 212 | 0.6484 | 0.2280 | 0.6274 | - | - | - |

## Real closing odds, where reliable (271 games, mostly 2023)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 271 | 0.6035 | 0.2080 | 0.6863 | 13.5240 | 10.3204 | 8.3973 |
| With odds: lightgbm | 271 | 0.6213 | 0.2141 | 0.6605 | 13.8202 | 10.4033 | 8.5602 |
| With odds: ensemble | 271 | 0.6068 | 0.2092 | 0.6605 | 13.5342 | 10.3411 | 8.4324 |
| No odds: linear | 271 | 0.6139 | 0.2129 | 0.6458 | 13.6716 | 10.3798 | 8.5235 |
| No odds: lightgbm | 271 | 0.6283 | 0.2172 | 0.6605 | 13.9348 | 10.4326 | 8.6484 |
| No odds: ensemble | 271 | 0.6165 | 0.2134 | 0.6568 | 13.6336 | 10.3884 | 8.5547 |
| Benchmark: home team | 271 | 0.6790 | 0.2429 | 0.5867 | 14.8367 | 10.3892 | 9.0475 |
| Benchmark: Elo only | 271 | 0.6195 | 0.2146 | 0.6642 | - | - | - |
| Benchmark: market opening | 271 | 0.6065 | 0.2090 | 0.6863 | 13.4852 | 10.3376 | 8.3164 |
| Benchmark: market closing (p_close) | 271 | 0.5881 | 0.2012 | 0.6863 | 13.2122 | 10.3192 | 8.2149 |

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| With odds: linear vs market closing | 271 | 0.0154 | -0.0031 | 0.0338 | 0.0527 |
| No odds: linear vs market closing | 271 | 0.0258 | 0.0034 | 0.0479 | 0.0109 |
