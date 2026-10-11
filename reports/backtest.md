# Backtest 2023–2025

**Main models:** the ensemble (average of linear and LightGBM) for both variants, with odds and no odds.

Training seasons start in 2021. For each season, the whole development procedure (fixed linear feature sets, tuning of the linear models and LightGBM, Platt calibration) is rerun on earlier seasons only, then the season is predicted. Win-probability metrics are log loss (lower is better); the market benchmark is the Odds Portal average price, since closing odds are missing for most of 2024 and all of 2025.

Caveat: the RAPM settings (penalty 300, 90-day half-life) were chosen on 2022–2024 CV, so the 2023 and 2024 results are slightly optimistic for the RAPM features. The grid was flat, so the effect should be small.

## Pooled over 2023–2025 (631 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 631 | 0.6209 | 0.2155 | 0.6466 | 13.5340 | 10.7185 | 8.5461 |
| With odds: lightgbm | 631 | 0.6258 | 0.2177 | 0.6466 | 13.5344 | 10.8919 | 8.6215 |
| With odds: ensemble | 631 | 0.6209 | 0.2157 | 0.6529 | 13.4774 | 10.7765 | 8.5521 |
| No odds: linear | 631 | 0.6261 | 0.2177 | 0.6403 | 13.5628 | 10.8072 | 8.6400 |
| No odds: lightgbm | 631 | 0.6306 | 0.2197 | 0.6513 | 13.5579 | 10.9301 | 8.6810 |
| No odds: ensemble | 631 | 0.6255 | 0.2176 | 0.6482 | 13.5058 | 10.8346 | 8.6267 |
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
| With odds: ensemble vs market average | 631 | 0.0005 | -0.0126 | 0.0140 | 0.4557 |
| With odds: ensemble vs market opening | 631 | -0.0122 | -0.0239 | -0.0004 | 0.9782 |
| With odds: ensemble vs Elo | 631 | -0.0170 | -0.0295 | -0.0043 | 0.9956 |
| No odds: linear vs market average | 631 | 0.0058 | -0.0097 | 0.0211 | 0.2290 |
| No odds: linear vs market opening | 631 | -0.0069 | -0.0224 | 0.0086 | 0.8054 |
| No odds: linear vs Elo | 631 | -0.0118 | -0.0236 | 0.0004 | 0.9705 |
| No odds: ensemble vs market average | 631 | 0.0051 | -0.0114 | 0.0219 | 0.2670 |
| No odds: ensemble vs market opening | 631 | -0.0076 | -0.0234 | 0.0086 | 0.8168 |
| No odds: ensemble vs Elo | 631 | -0.0124 | -0.0243 | -0.0002 | 0.9766 |

## 2023 (207 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 207 | 0.5931 | 0.2032 | 0.7053 | 13.2626 | 10.4293 | 8.2987 |
| With odds: lightgbm | 207 | 0.6118 | 0.2108 | 0.6715 | 13.4872 | 10.4672 | 8.3406 |
| With odds: ensemble | 207 | 0.5990 | 0.2059 | 0.6860 | 13.3139 | 10.4429 | 8.2968 |
| No odds: linear | 207 | 0.6030 | 0.2075 | 0.6908 | 13.3778 | 10.5214 | 8.4039 |
| No odds: lightgbm | 207 | 0.6205 | 0.2143 | 0.6618 | 13.5225 | 10.5248 | 8.4702 |
| No odds: ensemble | 207 | 0.6079 | 0.2096 | 0.6715 | 13.3670 | 10.5229 | 8.4157 |
| Benchmark: home team | 207 | 0.6846 | 0.2457 | 0.5652 | 14.9282 | 10.5423 | 9.0777 |
| Benchmark: Elo only | 207 | 0.6184 | 0.2140 | 0.6667 | - | - | - |
| Benchmark: market opening | 207 | 0.6016 | 0.2068 | 0.6957 | 13.3357 | 10.5048 | 8.2814 |
| Benchmark: market closing (p_avg) | 207 | 0.5757 | 0.1956 | 0.7005 | - | - | - |

## 2024 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 212 | 0.6314 | 0.2196 | 0.6274 | 13.7320 | 10.7261 | 8.6757 |
| With odds: lightgbm | 212 | 0.6220 | 0.2160 | 0.6509 | 13.3943 | 11.0113 | 8.7085 |
| With odds: ensemble | 212 | 0.6248 | 0.2171 | 0.6604 | 13.5053 | 10.8330 | 8.6566 |
| No odds: linear | 212 | 0.6370 | 0.2214 | 0.6085 | 13.7397 | 10.9687 | 8.8458 |
| No odds: lightgbm | 212 | 0.6229 | 0.2161 | 0.6698 | 13.3989 | 11.1450 | 8.7666 |
| No odds: ensemble | 212 | 0.6271 | 0.2177 | 0.6462 | 13.5350 | 11.0028 | 8.7696 |
| Benchmark: home team | 212 | 0.6795 | 0.2432 | 0.5849 | 14.5303 | 11.1772 | 9.3637 |
| Benchmark: Elo only | 212 | 0.6420 | 0.2249 | 0.6226 | - | - | - |
| Benchmark: market opening | 212 | 0.6369 | 0.2235 | 0.6274 | 13.6745 | 10.8255 | 8.7524 |
| Benchmark: market closing (p_avg) | 212 | 0.6360 | 0.2220 | 0.6274 | - | - | - |

## 2025 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 212 | 0.6375 | 0.2234 | 0.6085 | 13.6012 | 10.9934 | 8.6580 |
| With odds: lightgbm | 212 | 0.6434 | 0.2262 | 0.6179 | 13.7207 | 11.1872 | 8.8088 |
| With odds: ensemble | 212 | 0.6384 | 0.2239 | 0.6132 | 13.6092 | 11.0457 | 8.6968 |
| No odds: linear | 212 | 0.6378 | 0.2240 | 0.6226 | 13.5664 | 10.9248 | 8.6648 |
| No odds: lightgbm | 212 | 0.6481 | 0.2285 | 0.6226 | 13.7515 | 11.1110 | 8.8013 |
| No odds: ensemble | 212 | 0.6411 | 0.2255 | 0.6274 | 13.6122 | 10.9708 | 8.6898 |
| Benchmark: home team | 212 | 0.6858 | 0.2463 | 0.5613 | 14.7944 | 11.2158 | 9.1386 |
| Benchmark: Elo only | 212 | 0.6528 | 0.2309 | 0.5991 | - | - | - |
| Benchmark: market opening | 212 | 0.6600 | 0.2335 | 0.6085 | 13.9670 | 11.1934 | 8.8821 |
| Benchmark: market closing (p_avg) | 212 | 0.6484 | 0.2280 | 0.6274 | - | - | - |

## Real closing odds, where reliable (271 games, mostly 2023)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| With odds: linear | 271 | 0.6020 | 0.2072 | 0.6900 | 13.5111 | 10.3499 | 8.3955 |
| With odds: lightgbm | 271 | 0.6119 | 0.2109 | 0.6679 | 13.5796 | 10.3090 | 8.3633 |
| With odds: ensemble | 271 | 0.6039 | 0.2080 | 0.6790 | 13.4962 | 10.3102 | 8.3574 |
| No odds: linear | 271 | 0.6132 | 0.2123 | 0.6568 | 13.6353 | 10.4091 | 8.5219 |
| No odds: lightgbm | 271 | 0.6195 | 0.2140 | 0.6642 | 13.6553 | 10.3569 | 8.5083 |
| No odds: ensemble | 271 | 0.6129 | 0.2119 | 0.6605 | 13.5794 | 10.3711 | 8.4958 |
| Benchmark: home team | 271 | 0.6791 | 0.2430 | 0.5867 | 14.8327 | 10.3918 | 9.0503 |
| Benchmark: Elo only | 271 | 0.6195 | 0.2146 | 0.6642 | - | - | - |
| Benchmark: market opening | 271 | 0.6065 | 0.2090 | 0.6863 | 13.4852 | 10.3376 | 8.3164 |
| Benchmark: market closing (p_close) | 271 | 0.5881 | 0.2012 | 0.6863 | 13.2122 | 10.3192 | 8.2149 |

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| With odds: linear vs market closing | 271 | 0.0139 | -0.0039 | 0.0312 | 0.0614 |
| No odds: linear vs market closing | 271 | 0.0251 | 0.0025 | 0.0474 | 0.0133 |
