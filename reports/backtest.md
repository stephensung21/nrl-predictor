# Backtest 2023–2025

**Main models:** the ensemble (average of linear and LightGBM) for both variants, with odds and no odds.

Training seasons start in 2021. For each season, the whole development procedure (fixed linear feature sets, tuning of the linear models and LightGBM, Platt calibration) is rerun on earlier seasons only, then the season is predicted. Win-probability metrics are log loss (lower is better); the market benchmark is the Odds Portal average price, since closing odds are missing for most of 2024 and all of 2025.

Caveat: the RAPM settings (penalty 300, 90-day half-life) were chosen on 2022–2024 CV, so the 2023 and 2024 results are slightly optimistic for the RAPM features. The grid was flat, so the effect should be small.

## Pooled over 2023–2025 (631 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 631 | 0.6209 | 0.2155 | 0.6466 | 13.5340 | 10.7185 | 8.5461 |
| With odds: lightgbm | 631 | 0.6287 | 0.2189 | 0.6466 | 13.5620 | 10.9068 | 8.6382 |
| With odds: ensemble | 631 | 0.6220 | 0.2162 | 0.6434 | 13.4944 | 10.7776 | 8.5588 |
| No odds: linear | 631 | 0.6261 | 0.2177 | 0.6403 | 13.5628 | 10.8072 | 8.6400 |
| No odds: lightgbm | 631 | 0.6332 | 0.2208 | 0.6513 | 13.5789 | 10.9343 | 8.6899 |
| No odds: ensemble | 631 | 0.6266 | 0.2181 | 0.6387 | 13.5158 | 10.8333 | 8.6289 |
| Benchmark: home team | 631 | 0.6833 | 0.2451 | 0.5705 | 14.7495 | 10.9819 | 9.1942 |
| Benchmark: Elo only | 631 | 0.6379 | 0.2233 | 0.6292 | - | - | - |
| Benchmark: market opening | 631 | 0.6331 | 0.2214 | 0.6434 | 13.6616 | 10.8439 | 8.6414 |
| Benchmark: market closing (p_avg) | 631 | 0.6204 | 0.2154 | 0.6513 | - | 10.7187 | - |

## Paired bootstrap, pooled (log-loss difference; negative = model better)

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| With odds: linear vs market average | 631 | 0.0005 | -0.0117 | 0.0128 | 0.4639 |
| With odds: linear vs market opening | 631 | -0.0122 | -0.0233 | -0.0010 | 0.9835 |
| With odds: linear vs Elo | 631 | -0.0170 | -0.0298 | -0.0043 | 0.9947 |
| With odds: ensemble vs market average | 631 | 0.0016 | -0.0115 | 0.0152 | 0.3949 |
| With odds: ensemble vs market opening | 631 | -0.0111 | -0.0230 | 0.0008 | 0.9643 |
| With odds: ensemble vs Elo | 631 | -0.0159 | -0.0285 | -0.0032 | 0.9930 |
| No odds: linear vs market average | 631 | 0.0058 | -0.0097 | 0.0211 | 0.2290 |
| No odds: linear vs market opening | 631 | -0.0069 | -0.0224 | 0.0086 | 0.8054 |
| No odds: linear vs Elo | 631 | -0.0118 | -0.0236 | 0.0004 | 0.9705 |
| No odds: ensemble vs market average | 631 | 0.0062 | -0.0103 | 0.0228 | 0.2263 |
| No odds: ensemble vs market opening | 631 | -0.0065 | -0.0222 | 0.0096 | 0.7769 |
| No odds: ensemble vs Elo | 631 | -0.0113 | -0.0234 | 0.0011 | 0.9629 |

## 2023 (207 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 207 | 0.5931 | 0.2032 | 0.7053 | 13.2626 | 10.4293 | 8.2987 |
| With odds: lightgbm | 207 | 0.6186 | 0.2137 | 0.6715 | 13.5608 | 10.4607 | 8.3880 |
| With odds: ensemble | 207 | 0.6017 | 0.2071 | 0.6667 | 13.3513 | 10.4371 | 8.3168 |
| No odds: linear | 207 | 0.6030 | 0.2075 | 0.6908 | 13.3778 | 10.5214 | 8.4039 |
| No odds: lightgbm | 207 | 0.6260 | 0.2169 | 0.6522 | 13.5909 | 10.5153 | 8.4861 |
| No odds: ensemble | 207 | 0.6103 | 0.2107 | 0.6570 | 13.4015 | 10.5094 | 8.4245 |
| Benchmark: home team | 207 | 0.6846 | 0.2457 | 0.5652 | 14.9282 | 10.5423 | 9.0777 |
| Benchmark: Elo only | 207 | 0.6184 | 0.2140 | 0.6667 | - | - | - |
| Benchmark: market opening | 207 | 0.6016 | 0.2068 | 0.6957 | 13.3357 | 10.5048 | 8.2814 |
| Benchmark: market closing (p_avg) | 207 | 0.5757 | 0.1956 | 0.7005 | - | - | - |

## 2024 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 212 | 0.6314 | 0.2196 | 0.6274 | 13.7320 | 10.7261 | 8.6757 |
| With odds: lightgbm | 212 | 0.6236 | 0.2166 | 0.6509 | 13.3983 | 11.0477 | 8.7064 |
| With odds: ensemble | 212 | 0.6254 | 0.2173 | 0.6462 | 13.5074 | 10.8468 | 8.6549 |
| No odds: linear | 212 | 0.6370 | 0.2214 | 0.6085 | 13.7397 | 10.9687 | 8.8458 |
| No odds: lightgbm | 212 | 0.6250 | 0.2169 | 0.6745 | 13.4044 | 11.1880 | 8.7802 |
| No odds: ensemble | 212 | 0.6280 | 0.2180 | 0.6415 | 13.5380 | 11.0183 | 8.7721 |
| Benchmark: home team | 212 | 0.6795 | 0.2432 | 0.5849 | 14.5303 | 11.1772 | 9.3637 |
| Benchmark: Elo only | 212 | 0.6420 | 0.2249 | 0.6226 | - | - | - |
| Benchmark: market opening | 212 | 0.6369 | 0.2235 | 0.6274 | 13.6745 | 10.8255 | 8.7524 |
| Benchmark: market closing (p_avg) | 212 | 0.6360 | 0.2220 | 0.6274 | - | - | - |

## 2025 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 212 | 0.6375 | 0.2234 | 0.6085 | 13.6012 | 10.9934 | 8.6580 |
| With odds: lightgbm | 212 | 0.6437 | 0.2263 | 0.6179 | 13.7269 | 11.2016 | 8.8144 |
| With odds: ensemble | 212 | 0.6385 | 0.2239 | 0.6179 | 13.6211 | 11.0408 | 8.6989 |
| No odds: linear | 212 | 0.6378 | 0.2240 | 0.6226 | 13.5664 | 10.9248 | 8.6648 |
| No odds: lightgbm | 212 | 0.6483 | 0.2286 | 0.6274 | 13.7417 | 11.0896 | 8.7986 |
| No odds: ensemble | 212 | 0.6411 | 0.2254 | 0.6179 | 13.6052 | 10.9645 | 8.6852 |
| Benchmark: home team | 212 | 0.6858 | 0.2463 | 0.5613 | 14.7944 | 11.2158 | 9.1386 |
| Benchmark: Elo only | 212 | 0.6528 | 0.2309 | 0.5991 | - | - | - |
| Benchmark: market opening | 212 | 0.6600 | 0.2335 | 0.6085 | 13.9670 | 11.1934 | 8.8821 |
| Benchmark: market closing (p_avg) | 212 | 0.6484 | 0.2280 | 0.6274 | - | - | - |

## Real closing odds, where reliable (271 games, mostly 2023)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 271 | 0.6020 | 0.2072 | 0.6900 | 13.5111 | 10.3499 | 8.3955 |
| With odds: lightgbm | 271 | 0.6171 | 0.2131 | 0.6716 | 13.6327 | 10.3013 | 8.3959 |
| With odds: ensemble | 271 | 0.6059 | 0.2089 | 0.6642 | 13.5230 | 10.3044 | 8.3707 |
| No odds: linear | 271 | 0.6132 | 0.2123 | 0.6568 | 13.6353 | 10.4091 | 8.5219 |
| No odds: lightgbm | 271 | 0.6239 | 0.2160 | 0.6642 | 13.7046 | 10.3444 | 8.5129 |
| No odds: ensemble | 271 | 0.6147 | 0.2128 | 0.6458 | 13.6050 | 10.3588 | 8.4994 |
| Benchmark: home team | 271 | 0.6791 | 0.2430 | 0.5867 | 14.8327 | 10.3918 | 9.0503 |
| Benchmark: Elo only | 271 | 0.6195 | 0.2146 | 0.6642 | - | - | - |
| Benchmark: market opening | 271 | 0.6065 | 0.2090 | 0.6863 | 13.4852 | 10.3376 | 8.3164 |
| Benchmark: market closing (p_close) | 271 | 0.5881 | 0.2012 | 0.6863 | 13.2122 | 10.3192 | 8.2149 |

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| With odds: linear vs market closing | 271 | 0.0139 | -0.0039 | 0.0312 | 0.0614 |
| No odds: linear vs market closing | 271 | 0.0251 | 0.0025 | 0.0474 | 0.0133 |
