# Backtest 2023–2025

Training seasons start in 2021. For each season, the whole development procedure (fixed linear feature sets, tuning of the linear models and LightGBM, Platt calibration) is rerun on earlier seasons only, then the season is predicted. Win-probability metrics are log loss (lower is better); the market benchmark is the Odds Portal average price, since closing odds are missing for most of 2024 and all of 2025.

Caveat: the RAPM settings (penalty 300, 90-day half-life) were chosen on 2022–2024 CV, so the 2023 and 2024 results are slightly optimistic for the RAPM features. The grid was flat, so the effect should be small.

## Pooled over 2023–2025 (631 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 631 | 0.6332 | 0.2204 | 0.6434 | 13.6112 | 10.7977 | 8.6607 |
| Model B: lightgbm | 631 | 0.6364 | 0.2224 | 0.6498 | 13.9299 | 10.9543 | 8.7547 |
| Model B: ensemble | 631 | 0.6311 | 0.2200 | 0.6418 | 13.6330 | 10.8483 | 8.6620 |
| Model A: linear | 631 | 0.6306 | 0.2193 | 0.6418 | 13.5894 | 10.7321 | 8.5878 |
| Model A: lightgbm | 631 | 0.6334 | 0.2206 | 0.6466 | 13.8575 | 10.9489 | 8.7116 |
| Model A: ensemble | 631 | 0.6283 | 0.2187 | 0.6403 | 13.5753 | 10.7976 | 8.6020 |
| Benchmark: home team | 631 | 0.6833 | 0.2451 | 0.5705 | 14.7512 | 10.9813 | 9.1924 |
| Benchmark: Elo only | 631 | 0.6379 | 0.2233 | 0.6292 | - | - | - |
| Benchmark: market opening | 631 | 0.6331 | 0.2214 | 0.6434 | 13.6616 | 10.8439 | 8.6414 |
| Benchmark: market closing (p_avg) | 631 | 0.6204 | 0.2154 | 0.6513 | - | 10.7187 | - |

## Paired bootstrap, pooled (log-loss difference; negative = model better)

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| Model B: linear vs market average | 631 | 0.0129 | -0.0049 | 0.0311 | 0.0809 |
| Model B: linear vs market opening | 631 | 0.0002 | -0.0181 | 0.0188 | 0.4944 |
| Model B: linear vs Elo | 631 | -0.0047 | -0.0196 | 0.0108 | 0.7313 |
| Model B: ensemble vs market average | 631 | 0.0108 | -0.0067 | 0.0285 | 0.1139 |
| Model B: ensemble vs market opening | 631 | -0.0019 | -0.0200 | 0.0165 | 0.5768 |
| Model B: ensemble vs Elo | 631 | -0.0068 | -0.0216 | 0.0085 | 0.8112 |
| Model A: linear vs market average | 631 | 0.0102 | -0.0043 | 0.0252 | 0.0886 |
| Model A: linear vs market opening | 631 | -0.0025 | -0.0169 | 0.0128 | 0.6249 |
| Model A: linear vs Elo | 631 | -0.0073 | -0.0244 | 0.0100 | 0.7990 |
| Model A: ensemble vs market average | 631 | 0.0080 | -0.0069 | 0.0231 | 0.1454 |
| Model A: ensemble vs market opening | 631 | -0.0047 | -0.0196 | 0.0105 | 0.7275 |
| Model A: ensemble vs Elo | 631 | -0.0096 | -0.0261 | 0.0069 | 0.8724 |

## 2023 (207 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 207 | 0.6122 | 0.2102 | 0.6763 | 13.4306 | 10.4852 | 8.4179 |
| Model B: lightgbm | 207 | 0.6203 | 0.2135 | 0.6860 | 13.7132 | 10.5825 | 8.4689 |
| Model B: ensemble | 207 | 0.6114 | 0.2103 | 0.6715 | 13.3632 | 10.5199 | 8.4047 |
| Model A: linear | 207 | 0.6037 | 0.2066 | 0.6812 | 13.2976 | 10.4204 | 8.3102 |
| Model A: lightgbm | 207 | 0.6211 | 0.2140 | 0.6667 | 13.6642 | 10.6016 | 8.4565 |
| Model A: ensemble | 207 | 0.6074 | 0.2089 | 0.6715 | 13.3080 | 10.5022 | 8.3432 |
| Benchmark: home team | 207 | 0.6846 | 0.2457 | 0.5652 | 14.9359 | 10.5400 | 9.0753 |
| Benchmark: Elo only | 207 | 0.6184 | 0.2140 | 0.6667 | - | - | - |
| Benchmark: market opening | 207 | 0.6016 | 0.2068 | 0.6957 | 13.3357 | 10.5048 | 8.2814 |
| Benchmark: market closing (p_avg) | 207 | 0.5757 | 0.1956 | 0.7005 | - | - | - |

## 2024 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 212 | 0.6408 | 0.2230 | 0.6274 | 13.7342 | 10.9709 | 8.8589 |
| Model B: lightgbm | 212 | 0.6334 | 0.2217 | 0.6415 | 14.1598 | 11.3354 | 8.9700 |
| Model B: ensemble | 212 | 0.6328 | 0.2206 | 0.6415 | 13.8112 | 11.1040 | 8.8628 |
| Model A: linear | 212 | 0.6370 | 0.2216 | 0.6368 | 13.6994 | 10.7676 | 8.7037 |
| Model A: lightgbm | 212 | 0.6318 | 0.2200 | 0.6368 | 14.0692 | 11.0252 | 8.8478 |
| Model A: ensemble | 212 | 0.6309 | 0.2196 | 0.6415 | 13.7345 | 10.8337 | 8.7157 |
| Benchmark: home team | 212 | 0.6794 | 0.2431 | 0.5849 | 14.5288 | 11.1783 | 9.3620 |
| Benchmark: Elo only | 212 | 0.6420 | 0.2249 | 0.6226 | - | - | - |
| Benchmark: market opening | 212 | 0.6369 | 0.2235 | 0.6274 | 13.6745 | 10.8255 | 8.7524 |
| Benchmark: market closing (p_avg) | 212 | 0.6360 | 0.2220 | 0.6274 | - | - | - |

## 2025 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 212 | 0.6462 | 0.2278 | 0.6274 | 13.6644 | 10.9297 | 8.6997 |
| Model B: lightgbm | 212 | 0.6551 | 0.2319 | 0.6226 | 13.9115 | 10.9362 | 8.8184 |
| Model B: ensemble | 212 | 0.6486 | 0.2290 | 0.6132 | 13.7181 | 10.9133 | 8.7124 |
| Model A: linear | 212 | 0.6503 | 0.2293 | 0.6085 | 13.7643 | 11.0010 | 8.7431 |
| Model A: lightgbm | 212 | 0.6470 | 0.2277 | 0.6368 | 13.8345 | 11.2118 | 8.8246 |
| Model A: ensemble | 212 | 0.6462 | 0.2274 | 0.6085 | 13.6770 | 11.0501 | 8.7409 |
| Benchmark: home team | 212 | 0.6858 | 0.2463 | 0.5613 | 14.7933 | 11.2152 | 9.1371 |
| Benchmark: Elo only | 212 | 0.6528 | 0.2309 | 0.5991 | - | - | - |
| Benchmark: market opening | 212 | 0.6600 | 0.2335 | 0.6085 | 13.9670 | 11.1934 | 8.8821 |
| Benchmark: market closing (p_avg) | 212 | 0.6484 | 0.2280 | 0.6274 | - | - | - |

## Real closing odds, where reliable (271 games, mostly 2023)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 271 | 0.6202 | 0.2143 | 0.6531 | 13.6716 | 10.3798 | 8.5235 |
| Model B: lightgbm | 271 | 0.6240 | 0.2159 | 0.6716 | 13.8677 | 10.4600 | 8.5451 |
| Model B: ensemble | 271 | 0.6177 | 0.2136 | 0.6568 | 13.5802 | 10.3980 | 8.4978 |
| Model A: linear | 271 | 0.6095 | 0.2095 | 0.6753 | 13.5240 | 10.3204 | 8.3973 |
| Model A: lightgbm | 271 | 0.6195 | 0.2136 | 0.6642 | 13.8470 | 10.4122 | 8.5062 |
| Model A: ensemble | 271 | 0.6099 | 0.2102 | 0.6642 | 13.5461 | 10.3430 | 8.4115 |
| Benchmark: home team | 271 | 0.6790 | 0.2429 | 0.5867 | 14.8367 | 10.3892 | 9.0475 |
| Benchmark: Elo only | 271 | 0.6195 | 0.2146 | 0.6642 | - | - | - |
| Benchmark: market opening | 271 | 0.6065 | 0.2090 | 0.6863 | 13.4852 | 10.3376 | 8.3164 |
| Benchmark: market closing (p_close) | 271 | 0.5881 | 0.2012 | 0.6863 | 13.2122 | 10.3192 | 8.2149 |

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| Model B: linear vs market closing | 271 | 0.0321 | 0.0043 | 0.0603 | 0.0115 |
