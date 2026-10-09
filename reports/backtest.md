# Backtest 2023–2025

For each season, the whole development procedure (forward selection, tuning of the linear models and LightGBM, Platt calibration) is rerun on earlier seasons only, then the season is predicted. Win-probability metrics are log loss (lower is better); the market benchmark is the Odds Portal average price, since closing odds are missing for most of 2024 and all of 2025.

Caveat: the RAPM settings (penalty 300, 90-day half-life) were chosen on 2022–2024 CV, so the 2023 and 2024 results are slightly optimistic for the RAPM features. The grid was flat, so the effect should be small.

## Pooled over 2023–2025 (631 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 631 | 0.6445 | 0.2233 | 0.6434 | 13.8473 | 11.0501 | 8.7887 |
| Model B: lightgbm | 631 | 0.6398 | 0.2241 | 0.6292 | 13.7045 | 10.9951 | 8.7588 |
| Model B: ensemble | 631 | 0.6347 | 0.2215 | 0.6323 | 13.6781 | 11.0088 | 8.7339 |
| Model A: linear | 631 | 0.6394 | 0.2212 | 0.6387 | 13.7825 | 10.9276 | 8.7007 |
| Model A: lightgbm | 631 | 0.6330 | 0.2206 | 0.6498 | 13.7079 | 10.9803 | 8.7682 |
| Model A: ensemble | 631 | 0.6301 | 0.2191 | 0.6355 | 13.6549 | 10.9209 | 8.6953 |
| Benchmark: home team | 631 | 0.6833 | 0.2451 | 0.5705 | 14.7514 | 10.9869 | 9.1957 |
| Benchmark: Elo only | 631 | 0.6379 | 0.2233 | 0.6292 | - | - | - |
| Benchmark: market opening | 631 | 0.6331 | 0.2214 | 0.6434 | 13.6616 | 10.8439 | 8.6414 |
| Benchmark: market closing (p_avg) | 631 | 0.6204 | 0.2154 | 0.6513 | - | 10.7187 | - |

## Paired bootstrap, pooled (log-loss difference; negative = model better)

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| Model B: linear vs market average | 631 | 0.0241 | 0.0032 | 0.0457 | 0.0134 |
| Model B: linear vs market opening | 631 | 0.0114 | -0.0108 | 0.0348 | 0.1649 |
| Model B: linear vs Elo | 631 | 0.0066 | -0.0135 | 0.0278 | 0.2685 |
| Model B: ensemble vs market average | 631 | 0.0144 | -0.0044 | 0.0331 | 0.0649 |
| Model B: ensemble vs market opening | 631 | 0.0017 | -0.0179 | 0.0217 | 0.4306 |
| Model B: ensemble vs Elo | 631 | -0.0032 | -0.0200 | 0.0140 | 0.6404 |
| Model A: linear vs market average | 631 | 0.0190 | 0.0013 | 0.0369 | 0.0180 |
| Model A: linear vs market opening | 631 | 0.0063 | -0.0128 | 0.0260 | 0.2671 |
| Model A: linear vs Elo | 631 | 0.0015 | -0.0200 | 0.0234 | 0.4501 |
| Model A: ensemble vs market average | 631 | 0.0098 | -0.0050 | 0.0248 | 0.1018 |
| Model A: ensemble vs market opening | 631 | -0.0029 | -0.0192 | 0.0138 | 0.6382 |
| Model A: ensemble vs Elo | 631 | -0.0078 | -0.0262 | 0.0106 | 0.7985 |

## 2023 (207 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 207 | 0.6238 | 0.2121 | 0.7005 | 13.7634 | 10.6582 | 8.5030 |
| Model B: lightgbm | 207 | 0.6180 | 0.2149 | 0.6618 | 13.5229 | 10.5597 | 8.4578 |
| Model B: ensemble | 207 | 0.6110 | 0.2109 | 0.6812 | 13.5141 | 10.5902 | 8.4274 |
| Model A: linear | 207 | 0.6137 | 0.2081 | 0.6957 | 13.5815 | 10.5604 | 8.3523 |
| Model A: lightgbm | 207 | 0.5987 | 0.2060 | 0.6908 | 13.4719 | 10.6112 | 8.4868 |
| Model A: ensemble | 207 | 0.5965 | 0.2048 | 0.6812 | 13.3775 | 10.5446 | 8.3659 |
| Benchmark: home team | 207 | 0.6848 | 0.2458 | 0.5652 | 14.9379 | 10.5603 | 9.0835 |
| Benchmark: Elo only | 207 | 0.6184 | 0.2140 | 0.6667 | - | - | - |
| Benchmark: market opening | 207 | 0.6016 | 0.2068 | 0.6957 | 13.3357 | 10.5048 | 8.2814 |
| Benchmark: market closing (p_avg) | 207 | 0.5757 | 0.1956 | 0.7005 | - | - | - |

## 2024 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 212 | 0.6652 | 0.2310 | 0.6132 | 14.2068 | 11.2543 | 9.1035 |
| Model B: lightgbm | 212 | 0.6487 | 0.2267 | 0.6368 | 13.7609 | 11.2103 | 8.9740 |
| Model B: ensemble | 212 | 0.6483 | 0.2263 | 0.6274 | 13.9038 | 11.2185 | 9.0123 |
| Model A: linear | 212 | 0.6539 | 0.2266 | 0.6132 | 14.1636 | 10.9293 | 8.9260 |
| Model A: lightgbm | 212 | 0.6421 | 0.2232 | 0.6415 | 13.7345 | 10.9669 | 8.8527 |
| Model A: ensemble | 212 | 0.6427 | 0.2230 | 0.6132 | 13.9026 | 10.9105 | 8.8637 |
| Benchmark: home team | 212 | 0.6791 | 0.2430 | 0.5849 | 14.5282 | 11.1679 | 9.3635 |
| Benchmark: Elo only | 212 | 0.6420 | 0.2249 | 0.6226 | - | - | - |
| Benchmark: market opening | 212 | 0.6369 | 0.2235 | 0.6274 | 13.6745 | 10.8255 | 8.7524 |
| Benchmark: market closing (p_avg) | 212 | 0.6360 | 0.2220 | 0.6274 | - | - | - |

## 2025 (212 games)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 212 | 0.6441 | 0.2264 | 0.6179 | 13.5697 | 11.2285 | 8.7527 |
| Model B: lightgbm | 212 | 0.6523 | 0.2306 | 0.5896 | 13.8254 | 11.2049 | 8.8376 |
| Model B: ensemble | 212 | 0.6443 | 0.2270 | 0.5896 | 13.6126 | 11.2078 | 8.7548 |
| Model A: linear | 212 | 0.6499 | 0.2287 | 0.6085 | 13.5977 | 11.2845 | 8.8158 |
| Model A: lightgbm | 212 | 0.6575 | 0.2322 | 0.6179 | 13.9116 | 11.3542 | 8.9585 |
| Model A: ensemble | 212 | 0.6504 | 0.2291 | 0.6132 | 13.6779 | 11.2989 | 8.8485 |
| Benchmark: home team | 212 | 0.6860 | 0.2464 | 0.5613 | 14.7926 | 11.2223 | 9.1374 |
| Benchmark: Elo only | 212 | 0.6528 | 0.2309 | 0.5991 | - | - | - |
| Benchmark: market opening | 212 | 0.6600 | 0.2335 | 0.6085 | 13.9670 | 11.1934 | 8.8821 |
| Benchmark: market closing (p_avg) | 212 | 0.6484 | 0.2280 | 0.6274 | - | - | - |

## Real closing odds, where reliable (271 games, mostly 2023)

| model | games | log_loss | brier | accuracy | margin_mae | total_mae | score_mae |
|---|---|---|---|---|---|---|---|
| Model B: linear | 271 | 0.6347 | 0.2184 | 0.6716 | 13.9855 | 10.4479 | 8.6021 |
| Model B: lightgbm | 271 | 0.6248 | 0.2178 | 0.6531 | 13.7392 | 10.3992 | 8.5675 |
| Model B: ensemble | 271 | 0.6204 | 0.2155 | 0.6568 | 13.7629 | 10.4050 | 8.5365 |
| Model A: linear | 271 | 0.6200 | 0.2119 | 0.6679 | 13.8171 | 10.3593 | 8.4274 |
| Model A: lightgbm | 271 | 0.6041 | 0.2081 | 0.6827 | 13.6325 | 10.4209 | 8.5379 |
| Model A: ensemble | 271 | 0.6036 | 0.2078 | 0.6605 | 13.6078 | 10.3511 | 8.4327 |
| Benchmark: home team | 271 | 0.6787 | 0.2428 | 0.5867 | 14.8374 | 10.4130 | 9.0558 |
| Benchmark: Elo only | 271 | 0.6195 | 0.2146 | 0.6642 | - | - | - |
| Benchmark: market opening | 271 | 0.6065 | 0.2090 | 0.6863 | 13.4852 | 10.3376 | 8.3164 |
| Benchmark: market closing (p_close) | 271 | 0.5881 | 0.2012 | 0.6863 | 13.2122 | 10.3192 | 8.2149 |

| comparison | games | mean_diff | ci_low | ci_high | p_model_better |
|---|---|---|---|---|---|
| Model B: linear vs market closing | 271 | 0.0466 | 0.0114 | 0.0850 | 0.0041 |

## Feature selection stability, `home_win` (1 = selected for that season)

| feature | 2023 | 2024 | 2025 |
|---|---|---|---|
| elo_logit | 1 | 1 | 1 |
| home_travel | 1 | 0 | 0 |
| neutral | 0 | 1 | 0 |
| away_at_ground | 0 | 1 | 0 |
| origin_period | 1 | 0 | 0 |
| diff_rating_total | 1 | 0 | 0 |
| diff_spine_vs_usual | 0 | 1 | 0 |
| diff_rookies | 0 | 0 | 1 |
| diff_missing_usual | 1 | 0 | 0 |
| diff_ins_backs | 1 | 0 | 0 |
| diff_kicker_changed | 1 | 1 | 0 |
| diff_rapm_total | 1 | 1 | 1 |
| diff_rapm_vs_usual | 0 | 1 | 1 |
| diff_rapm_defence | 1 | 1 | 1 |

| season | home_win | total |
|---|---|---|
| 2023 | 1. diff_rapm_total, 2. home_travel, 3. diff_ins_backs, 4. diff_kicker_changed, 5. diff_rapm_defence, 6. elo_logit, 7. diff_rating_total, 8. origin_period, 9. diff_missing_usual | 1. away_travel, 2. diff_origin_out, 3. diff_form_errors, 4. diff_rating_forwards, 5. diff_ins_forwards, 6. diff_form_all_run_metres |
| 2024 | 1. diff_rapm_total, 2. neutral, 3. diff_spine_vs_usual, 4. diff_rapm_defence, 5. elo_logit, 6. diff_rapm_vs_usual, 7. diff_kicker_changed, 8. away_at_ground | 1. diff_form_post_contact_metres, 2. origin_period, 3. neutral, 4. diff_form_missed_tackles, 5. diff_ins_forwards |
| 2025 | 1. diff_rapm_total, 2. elo_logit, 3. diff_rapm_vs_usual, 4. diff_rapm_defence, 5. diff_rookies | 1. origin_period |
