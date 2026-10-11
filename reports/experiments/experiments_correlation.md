# Correlation audit (2021–2025)

Which inputs overlap, and whether any feature lines up with what the main models still get wrong. Nothing is refitted, so this is a screen, not a test: a lead here still has to improve the backtest before it is adopted. 2026 is not used.

## A. Overlap between the linear models' inputs

Variance inflation factor (VIF) of each input within each linear model, on the 2021–2025 rows: 1 means the input is unrelated to the model's other inputs, above 5 means it is largely explained by them and its coefficient alone is hard to read. Ridge and logistic penalties keep the predictions stable either way.

| feature | home_win, No odds | home_win, With odds | margin, No odds | margin, With odds | total, No odds | total, With odds |
|---|---|---|---|---|---|---|
| bluebet | - | 1.25 | - | 1.25 | - | - |
| diff_rapm_defence | 5.35 | 5.37 | 5.28 | 5.31 | - | - |
| diff_rapm_total | 9.83 | 11.03 | 9.40 | 10.44 | - | - |
| diff_rapm_vs_usual | 1.38 | 1.39 | 1.35 | 1.37 | - | - |
| diff_s2_stars_out_other | 1.19 | 1.20 | 1.19 | 1.20 | - | - |
| diff_s2_stars_out_spine | 1.13 | 1.14 | 1.10 | 1.11 | - | - |
| elo_logit | 12.59 | 13.93 | 5.99 | 8.06 | - | - |
| open_line | - | 70.80 | - | 70.78 | - | 68.09 |
| open_logit | - | 70.48 | - | 70.32 | - | 68.10 |
| open_logit_bluebet | - | 1.47 | - | 1.47 | - | - |
| open_total | - | 1.20 | - | 1.20 | - | 1.15 |
| origin_period | - | - | - | - | 1.00 | 1.01 |
| rapm_points | - | - | - | - | 1.00 | 1.14 |
| team_margin | 4.18 | 4.26 | - | - | - | - |
| wet_conditions | - | - | - | - | 1.00 | 1.00 |

Correlations between the inputs:

|  | bluebet | diff_rapm_defence | diff_rapm_total | diff_rapm_vs_usual | diff_s2_stars_out_other | diff_s2_stars_out_spine | elo_logit | open_line | open_logit | open_logit_bluebet | open_total | team_margin | origin_period | rapm_points | wet_conditions |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bluebet | 1 | 0.01 | -0.01 | 0.00 | 0.03 | 0.01 | -0.00 | 0.01 | -0.03 | 0.18 | 0.40 | 0.02 | 0.06 | -0.01 | 0.25 |
| diff_rapm_defence | 0.01 | 1 | -0.90 | 0.23 | -0.18 | -0.15 | -0.82 | 0.78 | -0.78 | -0.39 | 0.02 | -0.60 | 0.03 | 0.02 | 0.01 |
| diff_rapm_total | -0.01 | -0.90 | 1 | -0.27 | 0.20 | 0.16 | 0.90 | -0.88 | 0.88 | 0.44 | -0.00 | 0.68 | -0.04 | -0.02 | -0.00 |
| diff_rapm_vs_usual | 0.00 | 0.23 | -0.27 | 1 | -0.37 | -0.27 | -0.37 | 0.26 | -0.27 | -0.07 | 0.02 | -0.28 | -0.02 | -0.02 | -0.03 |
| diff_s2_stars_out_other | 0.03 | -0.18 | 0.20 | -0.37 | 1 | 0.10 | 0.27 | -0.21 | 0.21 | 0.08 | -0.02 | 0.22 | 0.03 | 0.01 | -0.01 |
| diff_s2_stars_out_spine | 0.01 | -0.15 | 0.16 | -0.27 | 0.10 | 1 | 0.21 | -0.16 | 0.16 | 0.02 | 0.02 | 0.25 | 0.01 | 0.00 | 0.02 |
| elo_logit | -0.00 | -0.82 | 0.90 | -0.37 | 0.27 | 0.21 | 1 | -0.89 | 0.89 | 0.44 | -0.01 | 0.85 | -0.03 | 0.00 | -0.01 |
| open_line | 0.01 | 0.78 | -0.88 | 0.26 | -0.21 | -0.16 | -0.89 | 1 | -0.99 | -0.52 | 0.00 | -0.75 | 0.04 | -0.01 | 0.02 |
| open_logit | -0.03 | -0.78 | 0.88 | -0.27 | 0.21 | 0.16 | 0.89 | -0.99 | 1 | 0.51 | -0.01 | 0.76 | -0.04 | -0.00 | -0.02 |
| open_logit_bluebet | 0.18 | -0.39 | 0.44 | -0.07 | 0.08 | 0.02 | 0.44 | -0.52 | 0.51 | 1 | 0.10 | 0.39 | 0.03 | -0.01 | 0.04 |
| open_total | 0.40 | 0.02 | -0.00 | 0.02 | -0.02 | 0.02 | -0.01 | 0.00 | -0.01 | 0.10 | 1 | -0.00 | 0.09 | 0.35 | 0.02 |
| team_margin | 0.02 | -0.60 | 0.68 | -0.28 | 0.22 | 0.25 | 0.85 | -0.75 | 0.76 | 0.39 | -0.00 | 1 | -0.02 | 0.00 | -0.02 |
| origin_period | 0.06 | 0.03 | -0.04 | -0.02 | 0.03 | 0.01 | -0.03 | 0.04 | -0.04 | 0.03 | 0.09 | -0.02 | 1 | 0.04 | 0.03 |
| rapm_points | -0.01 | 0.02 | -0.02 | -0.02 | 0.01 | 0.00 | 0.00 | -0.01 | -0.00 | -0.01 | 0.35 | 0.00 | 0.04 | 1 | -0.02 |
| wet_conditions | 0.25 | 0.01 | -0.00 | -0.03 | -0.01 | 0.02 | -0.01 | 0.02 | -0.02 | 0.04 | 0.02 | -0.02 | 0.03 | -0.02 | 1 |

## B. Near-duplicate features (|r| ≥ 0.8, all candidates)

| feature | other | r |
|---|---|---|
| open_logit | open_line | -0.99 |
| diff_missing_usual | diff_missing_usual_rating | 0.94 |
| elo_logit | diff_rapm_total | 0.90 |
| diff_rapm_total | diff_rapm_defence | -0.90 |
| elo_logit | open_logit | 0.89 |
| elo_logit | open_line | -0.89 |
| diff_rapm_total | diff_rapm_attack | 0.89 |
| diff_form_points_for | diff_rapm_attack | 0.88 |
| diff_rapm_total | open_line | -0.88 |
| diff_rapm_total | open_logit | 0.88 |
| diff_rest_days | diff_after_bye | 0.88 |
| diff_form_points_against | diff_rapm_defence | 0.87 |
| elo_logit | team_margin | 0.85 |
| diff_s2_stars_out_spine | diff_origin_stars_out_spine | 0.83 |
| diff_form_completion_rate | diff_form_errors | -0.82 |
| elo_logit | diff_rapm_defence | -0.82 |
| diff_s2_stars_out_other | diff_origin_stars_out_other | 0.82 |

## C. Correlation with the main models' errors (2023–2025 backtest)

Error = outcome − the ensemble's out-of-sample prediction (for the win, outcome − probability, which is what the log loss would follow if the feature were added). 79 features × 3 targets × 2 variants, less the odds for the no-odds models (left out on purpose) = 459 tests: 38 have p < 0.05, against about 23 expected by chance alone. `q` is the Benjamini–Hochberg false discovery rate over all of them. `in model` says whether the target's linear model already uses the feature, LightGBM only, or neither.

**Leads** (q < 0.1 and the same sign in all 3 seasons): `diff_rookies` (No odds, margin, r = -0.138), `team_total` (No odds, total, r = +0.133), `diff_rapm_stars_out` (No odds, home_win, r = -0.132), `diff_rookies` (With odds, margin, r = -0.130), `diff_rapm_stars_out` (No odds, margin, r = -0.130).

Strongest five per model and target, among features the linear model doesn't use:

| model | target | feature | in model | r outcome | r error | p | q | seasons same sign | r 2023 | r 2024 | r 2025 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| No odds | home_win | diff_rapm_stars_out | experimental | 0.026 | -0.132 | 0.001 | 0.099 | 3 | -0.216 | -0.113 | -0.083 |
| No odds | home_win | diff_origin_stars_out_spine | experimental | -0.088 | -0.103 | 0.009 | 0.359 | 3 | -0.147 | -0.028 | -0.138 |
| No odds | home_win | diff_missq_fullback | experimental | -0.091 | -0.092 | 0.021 | 0.490 | 3 | -0.119 | -0.098 | -0.069 |
| No odds | home_win | diff_spine_vs_usual | unused | 0.106 | 0.087 | 0.028 | 0.490 | 2 | 0.118 | -0.017 | 0.160 |
| No odds | home_win | diff_rapm_missing | LightGBM only | 0.162 | -0.084 | 0.034 | 0.493 | 3 | -0.093 | -0.088 | -0.069 |
| With odds | home_win | diff_rapm_stars_out | experimental | 0.026 | -0.121 | 0.002 | 0.183 | 3 | -0.201 | -0.115 | -0.062 |
| With odds | home_win | diff_origin_stars_out_spine | experimental | -0.088 | -0.098 | 0.014 | 0.411 | 3 | -0.137 | -0.025 | -0.136 |
| With odds | home_win | diff_spine_vs_usual | unused | 0.106 | 0.087 | 0.028 | 0.490 | 2 | 0.116 | -0.011 | 0.155 |
| With odds | home_win | diff_missq_fullback | experimental | -0.091 | -0.085 | 0.034 | 0.493 | 3 | -0.097 | -0.094 | -0.067 |
| With odds | home_win | diff_rapm_missing | LightGBM only | 0.162 | -0.072 | 0.072 | 0.647 | 3 | -0.081 | -0.087 | -0.042 |
| No odds | margin | diff_rookies | LightGBM only | -0.206 | -0.138 | 0.001 | 0.099 | 3 | -0.122 | -0.078 | -0.208 |
| No odds | margin | diff_rapm_stars_out | experimental | 0.041 | -0.130 | 0.001 | 0.099 | 3 | -0.163 | -0.050 | -0.176 |
| No odds | margin | diff_origin_stars_out_spine | experimental | -0.096 | -0.113 | 0.004 | 0.229 | 3 | -0.181 | -0.060 | -0.102 |
| No odds | margin | diff_form_possession_pct | unused | 0.109 | -0.102 | 0.010 | 0.361 | 3 | -0.129 | -0.114 | -0.063 |
| No odds | margin | diff_ladder_pos | experimental | -0.231 | 0.092 | 0.021 | 0.490 | 3 | 0.066 | 0.142 | 0.065 |
| With odds | margin | diff_rookies | LightGBM only | -0.206 | -0.130 | 0.001 | 0.099 | 3 | -0.119 | -0.069 | -0.197 |
| With odds | margin | diff_rapm_stars_out | experimental | 0.041 | -0.116 | 0.004 | 0.229 | 3 | -0.140 | -0.051 | -0.158 |
| With odds | margin | diff_origin_stars_out_spine | experimental | -0.096 | -0.110 | 0.006 | 0.244 | 3 | -0.169 | -0.058 | -0.105 |
| With odds | margin | diff_form_possession_pct | unused | 0.109 | -0.082 | 0.040 | 0.525 | 3 | -0.102 | -0.092 | -0.053 |
| With odds | margin | diff_missing_usual_rating | unused | -0.127 | -0.078 | 0.051 | 0.595 | 2 | -0.062 | 0.018 | -0.172 |
| No odds | total | team_total | experimental | 0.173 | 0.133 | 0.001 | 0.099 | 3 | 0.028 | 0.169 | 0.187 |
| No odds | total | night_game | experimental | -0.090 | -0.086 | 0.030 | 0.490 | 3 | -0.089 | -0.025 | -0.145 |
| No odds | total | diff_origin_out | unused | 0.086 | 0.082 | 0.039 | 0.523 | 3 | 0.057 | 0.097 | 0.100 |
| No odds | total | diff_after_bye | unused | 0.076 | 0.077 | 0.052 | 0.595 | 3 | 0.083 | 0.019 | 0.139 |
| No odds | total | diff_missing_usual_rating | unused | -0.076 | -0.073 | 0.067 | 0.644 | 2 | 0.004 | -0.045 | -0.156 |
| With odds | total | team_total | experimental | 0.173 | 0.094 | 0.018 | 0.479 | 2 | -0.018 | 0.129 | 0.153 |
| With odds | total | diff_origin_out | unused | 0.086 | 0.083 | 0.037 | 0.516 | 3 | 0.056 | 0.101 | 0.102 |
| With odds | total | diff_after_bye | unused | 0.076 | 0.080 | 0.044 | 0.549 | 3 | 0.091 | 0.022 | 0.134 |
| With odds | total | diff_rest_days | LightGBM only | 0.070 | 0.075 | 0.059 | 0.614 | 3 | 0.099 | 0.014 | 0.121 |
| With odds | total | diff_missing_usual_rating | unused | -0.076 | -0.072 | 0.073 | 0.647 | 2 | 0.006 | -0.043 | -0.152 |

### Related to the result, but already explained

Features outside the linear model that are most related to the outcome, with how much of that is left in the errors. A large drop means the current inputs already carry the same information.

| model | target | feature | in model | r outcome | r error |
|---|---|---|---|---|---|
| No odds | margin | team_margin | LightGBM only | 0.309 | -0.001 |
| With odds | margin | diff_form_points_against | unused | -0.290 | 0.016 |
| With odds | margin | diff_rapm_attack | LightGBM only | 0.272 | -0.031 |
| With odds | margin | diff_rapm_stars_named | experimental | 0.275 | -0.043 |
| With odds | margin | diff_rating_total | unused | 0.214 | 0.018 |
| No odds | margin | diff_rating_spine | unused | 0.206 | 0.031 |
| With odds | margin | diff_origin_reps | experimental | 0.212 | 0.044 |
| With odds | margin | diff_ladder_pos | experimental | -0.231 | 0.075 |
| With odds | margin | diff_form_tackle_breaks | unused | 0.156 | -0.006 |
| With odds | margin | diff_form_points_for | unused | 0.195 | -0.048 |
