# Backtest 2023–2025

Training seasons start in 2021. For each season, the whole development procedure (fixed linear feature sets, tuning of the linear models and LightGBM, Platt calibration) is rerun on earlier seasons only, then the season is predicted. Win-probability metrics are log loss (lower is better); the market benchmark is the Odds Portal average price, since closing odds are missing for most of 2024 and all of 2025.

Caveat: the RAPM settings (penalty 300, 90-day half-life) were chosen on 2022–2024 CV, so the 2023 and 2024 results are slightly optimistic for the RAPM features. The grid was flat, so the effect should be small.

## Pooled over 2023–2025 (631 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 631 | 0.6332 | 0.2204 | 0.6434 | 13.6112 | 10.8947 | 8.6975 |
| Model B: lightgbm | 631 | 0.6369 | 0.2226 | 0.6498 | 13.8795 | 11.0083 | 8.7539 |
| Model B: ensemble | 631 | 0.6313 | 0.2201 | 0.6418 | 13.6089 | 10.9363 | 8.6852 |
| Model A: linear | 631 | 0.6306 | 0.2193 | 0.6418 | 13.5894 | 10.8185 | 8.6266 |
| Model A: lightgbm | 631 | 0.6334 | 0.2207 | 0.6387 | 13.7989 | 10.9691 | 8.7265 |
| Model A: ensemble | 631 | 0.6284 | 0.2188 | 0.6371 | 13.5479 | 10.8827 | 8.6397 |
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
| Model B: ensemble vs market average | 631 | 0.0110 | -0.0065 | 0.0287 | 0.1082 |
| Model B: ensemble vs market opening | 631 | -0.0017 | -0.0198 | 0.0168 | 0.5705 |
| Model B: ensemble vs Elo | 631 | -0.0066 | -0.0214 | 0.0087 | 0.8037 |
| Model A: linear vs market average | 631 | 0.0102 | -0.0043 | 0.0252 | 0.0886 |
| Model A: linear vs market opening | 631 | -0.0025 | -0.0169 | 0.0128 | 0.6249 |
| Model A: linear vs Elo | 631 | -0.0073 | -0.0244 | 0.0100 | 0.7990 |
| Model A: ensemble vs market average | 631 | 0.0080 | -0.0068 | 0.0233 | 0.1447 |
| Model A: ensemble vs market opening | 631 | -0.0047 | -0.0196 | 0.0107 | 0.7208 |
| Model A: ensemble vs Elo | 631 | -0.0095 | -0.0260 | 0.0072 | 0.8677 |

## 2023 (207 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 207 | 0.6122 | 0.2102 | 0.6763 | 13.4306 | 10.5296 | 8.4308 |
| Model B: lightgbm | 207 | 0.6203 | 0.2135 | 0.6860 | 13.7132 | 10.5393 | 8.4568 |
| Model B: ensemble | 207 | 0.6114 | 0.2103 | 0.6715 | 13.3632 | 10.5227 | 8.4043 |
| Model A: linear | 207 | 0.6037 | 0.2066 | 0.6812 | 13.2976 | 10.4851 | 8.3068 |
| Model A: lightgbm | 207 | 0.6211 | 0.2140 | 0.6667 | 13.6642 | 10.6016 | 8.4565 |
| Model A: ensemble | 207 | 0.6074 | 0.2089 | 0.6715 | 13.3080 | 10.5350 | 8.3411 |
| Benchmark: home team | 207 | 0.6846 | 0.2457 | 0.5652 | 14.9359 | 10.5400 | 9.0753 |
| Benchmark: Elo only | 207 | 0.6184 | 0.2140 | 0.6667 | - | - | - |
| Benchmark: market opening | 207 | 0.6016 | 0.2068 | 0.6957 | 13.3357 | 10.5048 | 8.2814 |
| Benchmark: market closing (p_avg) | 207 | 0.5757 | 0.1956 | 0.7005 | - | - | - |

## 2024 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 212 | 0.6408 | 0.2230 | 0.6274 | 13.7342 | 11.0676 | 8.8808 |
| Model B: lightgbm | 212 | 0.6334 | 0.2217 | 0.6415 | 14.1598 | 11.3394 | 8.9809 |
| Model B: ensemble | 212 | 0.6328 | 0.2206 | 0.6415 | 13.8112 | 11.1728 | 8.8796 |
| Model A: linear | 212 | 0.6370 | 0.2216 | 0.6368 | 13.6994 | 10.8247 | 8.7345 |
| Model A: lightgbm | 212 | 0.6318 | 0.2200 | 0.6368 | 13.8857 | 11.1058 | 8.8537 |
| Model A: ensemble | 212 | 0.6309 | 0.2196 | 0.6415 | 13.6671 | 10.9506 | 8.7468 |
| Benchmark: home team | 212 | 0.6794 | 0.2431 | 0.5849 | 14.5288 | 11.1783 | 9.3620 |
| Benchmark: Elo only | 212 | 0.6420 | 0.2249 | 0.6226 | - | - | - |
| Benchmark: market opening | 212 | 0.6369 | 0.2235 | 0.6274 | 13.6745 | 10.8255 | 8.7524 |
| Benchmark: market closing (p_avg) | 212 | 0.6360 | 0.2220 | 0.6274 | - | - | - |

## 2025 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 212 | 0.6462 | 0.2278 | 0.6274 | 13.6644 | 11.0783 | 8.7746 |
| Model B: lightgbm | 212 | 0.6564 | 0.2323 | 0.6226 | 13.7614 | 11.1351 | 8.8171 |
| Model B: ensemble | 212 | 0.6492 | 0.2291 | 0.6132 | 13.6465 | 11.1038 | 8.7651 |
| Model A: linear | 212 | 0.6503 | 0.2293 | 0.6085 | 13.7643 | 11.1380 | 8.8309 |
| Model A: lightgbm | 212 | 0.6471 | 0.2279 | 0.6132 | 13.8436 | 11.1911 | 8.8628 |
| Model A: ensemble | 212 | 0.6464 | 0.2276 | 0.5991 | 13.6629 | 11.1543 | 8.8240 |
| Benchmark: home team | 212 | 0.6858 | 0.2463 | 0.5613 | 14.7933 | 11.2152 | 9.1371 |
| Benchmark: Elo only | 212 | 0.6528 | 0.2309 | 0.5991 | - | - | - |
| Benchmark: market opening | 212 | 0.6600 | 0.2335 | 0.6085 | 13.9670 | 11.1934 | 8.8821 |
| Benchmark: market closing (p_avg) | 212 | 0.6484 | 0.2280 | 0.6274 | - | - | - |

## Real closing odds, where reliable (271 games, mostly 2023)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 271 | 0.6202 | 0.2143 | 0.6531 | 13.6716 | 10.3631 | 8.5151 |
| Model B: lightgbm | 271 | 0.6237 | 0.2158 | 0.6716 | 13.8727 | 10.3969 | 8.5250 |
| Model B: ensemble | 271 | 0.6175 | 0.2135 | 0.6568 | 13.5826 | 10.3659 | 8.4836 |
| Model A: linear | 271 | 0.6095 | 0.2095 | 0.6753 | 13.5240 | 10.3078 | 8.3764 |
| Model A: lightgbm | 271 | 0.6198 | 0.2137 | 0.6642 | 13.7774 | 10.4354 | 8.4898 |
| Model A: ensemble | 271 | 0.6100 | 0.2102 | 0.6642 | 13.5103 | 10.3623 | 8.3961 |
| Benchmark: home team | 271 | 0.6790 | 0.2429 | 0.5867 | 14.8367 | 10.3892 | 9.0475 |
| Benchmark: Elo only | 271 | 0.6195 | 0.2146 | 0.6642 | - | - | - |
| Benchmark: market opening | 271 | 0.6065 | 0.2090 | 0.6863 | 13.4852 | 10.3376 | 8.3164 |
| Benchmark: market closing (p_close) | 271 | 0.5881 | 0.2012 | 0.6863 | 13.2122 | 10.3192 | 8.2149 |

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| Model B: linear vs market closing | 271 | 0.0321 | 0.0043 | 0.0603 | 0.0115 |
