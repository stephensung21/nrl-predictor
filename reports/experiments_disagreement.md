# Disagreement with the market (item 41)

The main with-odds model (ensemble) against the opening market, on out-of-sample predictions. Disagreement = model log-odds minus opening log-odds (positive = the model rates the home team higher). `toward closing` is how often the closing price moved towards the model (reliable closing prices only). Log loss: lower is better.

## 2023-2025 backtest (631 games)

### By size of disagreement

| disagreement | games | mean |disagreement| (prob. points) | model | market opening | market average | model better than opening | closing games | toward closing |
|---|---|---|---|---|---|---|---|---|
| smallest 50% | 316 | 2.6318 | 0.6165 | 0.6276 | 0.6085 | yes | 113 | 0.5625 |
| 50-80% | 189 | 6.9910 | 0.6384 | 0.6341 | 0.6407 | no | 83 | 0.6585 |
| 80-90% | 63 | 10.3203 | 0.6345 | 0.6634 | 0.6711 | yes | 33 | 0.7500 |
| largest 10% | 63 | 13.8332 | 0.5879 | 0.6270 | 0.5684 | yes | 42 | 0.8571 |

### What drives it (ridge on standardised features, R² = 0.36)

`R² lost` is how much of the disagreement this feature explains on its own share.

| feature | standardised effect | R² without it | R² lost |
|---|---|---|---|
| diff_rapm_defence | -0.1739 | 0.2913 | 0.0679 |
| diff_rapm_vs_usual | 0.0657 | 0.3264 | 0.0328 |
| diff_rookies | 0.0269 | 0.3527 | 0.0065 |
| diff_s2_stars_out_spine | -0.0253 | 0.3535 | 0.0057 |
| team_margin | 0.0419 | 0.3544 | 0.0048 |
| diff_s2_stars_out_other | -0.0229 | 0.3546 | 0.0046 |
| elo_logit | -0.0352 | 0.3580 | 0.0012 |
| diff_rapm_total | 0.0257 | 0.3585 | 0.0008 |
| diff_rest_days | 0.0073 | 0.3587 | 0.0005 |

### The 15 biggest disagreements

| game | model | opening | closing | home won | stars out (home - away) | line-up vs usual (RAPM) |
|---|---|---|---|---|---|---|
| 2025 R26 Bulldogs v Panthers | 0.7123 | 0.3939 | - | 1 | -8 | 2.1061 |
| 2023 R27 Panthers v Cowboys | 0.7947 | 0.5867 | 0.7867 | 1 | 1 | -0.2357 |
| 2023 R22 Panthers v Sharks | 0.8923 | 0.7619 | 0.8530 | 1 | 1 | 0.9835 |
| 2023 R23 Panthers v Storm | 0.8579 | 0.7065 | 0.8078 | 1 | 0 | 0.5315 |
| 2023 R13 Rabbitohs v Raiders | 0.7019 | 0.4893 | 0.5823 | 0 | 2 | -0.5769 |
| 2023 R11 Panthers v Roosters | 0.7980 | 0.6188 | 0.6517 | 1 | 0 | -0.0147 |
| 2023 R6 Panthers v Sea Eagles | 0.8223 | 0.6604 | 0.7400 | 1 | 2 | -0.0135 |
| 2023 R14 Panthers v Dragons | 0.9005 | 0.7945 | 0.8588 | 1 | 0 | 0.0396 |
| 2023 R31 Panthers v Broncos | 0.7603 | 0.5769 | 0.6000 | 1 | 1 | -0.0697 |
| 2025 R2 Raiders v Broncos | 0.4409 | 0.2555 | - | 1 | 0 | -0.2624 |
| 2023 R12 Rabbitohs v Eels | 0.8307 | 0.6818 | 0.7242 | 0 | 1 | 0.1003 |
| 2025 R4 Dolphins v Broncos | 0.3741 | 0.2105 | - | 0 | 0 | -0.2282 |
| 2023 R24 Sharks v Titans | 0.8086 | 0.6548 | 0.7505 | 1 | -1 | -0.1382 |
| 2023 R16 Sharks v Bulldogs | 0.8016 | 0.6475 | 0.8577 | 1 | -1 | -0.1949 |
| 2024 R27 Broncos v Storm | 0.1970 | 0.3494 | - | 0 | 2 | -0.1870 |

## 2026 final test (213 games)

### By size of disagreement

| disagreement | games | mean |disagreement| (prob. points) | model | market opening | market average | model better than opening | closing games | toward closing |
|---|---|---|---|---|---|---|---|---|
| smallest 50% | 107 | 1.8609 | 0.6639 | 0.6656 | 0.6611 | yes | 99 | 0.4845 |
| 50-80% | 63 | 5.6581 | 0.6637 | 0.6908 | 0.6874 | yes | 56 | 0.6923 |
| 80-90% | 21 | 9.5821 | 0.6713 | 0.6933 | 0.6860 | yes | 20 | 0.7000 |
| largest 10% | 22 | 13.3235 | 0.5387 | 0.5440 | 0.4840 | yes | 22 | 0.8182 |

### What drives it (ridge on standardised features, R² = 0.36)

`R² lost` is how much of the disagreement this feature explains on its own share.

| feature | standardised effect | R² without it | R² lost |
|---|---|---|---|
| diff_rapm_vs_usual | 0.1177 | 0.2262 | 0.1312 |
| elo_logit | -0.1981 | 0.3165 | 0.0409 |
| diff_rapm_defence | -0.1201 | 0.3305 | 0.0270 |
| diff_s2_stars_out_other | -0.0422 | 0.3382 | 0.0193 |
| team_margin | 0.0678 | 0.3392 | 0.0182 |
| diff_rapm_total | 0.0734 | 0.3514 | 0.0061 |
| diff_s2_stars_out_spine | -0.0181 | 0.3539 | 0.0036 |
| diff_rookies | 0.0160 | 0.3546 | 0.0029 |
| diff_rest_days | 0.0120 | 0.3556 | 0.0018 |

### The 15 biggest disagreements

| game | model | opening | closing | home won | stars out (home - away) | line-up vs usual (RAPM) |
|---|---|---|---|---|---|---|
| 2026 R27 Panthers v Wests Tigers | 0.8383 | 0.6744 | 0.8642 | 1 | 0 | -0.1103 |
| 2026 R27 Rabbitohs v Roosters | 0.7147 | 0.5225 | 0.8541 | 1 | -6 | 1.4622 |
| 2026 R27 Sharks v Storm | 0.4417 | 0.6219 | 0.2842 | 0 | 1 | -0.6422 |
| 2026 R8 Dragons v Roosters | 0.2575 | 0.1459 | 0.1896 | 0 | 1 | 0.2666 |
| 2026 R11 Panthers v Dragons | 0.8518 | 0.9210 | 0.8996 | 1 | 0 | -0.1326 |
| 2026 R4 Sea Eagles v Roosters | 0.4881 | 0.3256 | 0.3525 | 0 | 1 | -0.0062 |
| 2026 R7 Eels v Bulldogs | 0.4418 | 0.2873 | 0.2265 | 1 | -2 | -0.0616 |
| 2026 R11 Titans v Knights | 0.4514 | 0.3000 | 0.3166 | 0 | 0 | -0.1356 |
| 2026 R10 Sea Eagles v Broncos | 0.6044 | 0.4503 | 0.4868 | 1 | 0 | 0.0540 |
| 2026 R27 Dragons v Eels | 0.3344 | 0.4788 | 0.4051 | 1 | 2 | -0.1796 |
| 2026 R10 Dragons v Knights | 0.4749 | 0.3310 | 0.2888 | 0 | 0 | 0.2470 |
| 2026 R19 Roosters v Eels | 0.6754 | 0.7913 | 0.7430 | 1 | 4 | -0.4017 |
| 2026 R12 Sea Eagles v Titans | 0.6206 | 0.7485 | 0.7430 | 1 | -1 | -0.6127 |
| 2026 R5 Titans v Broncos | 0.3263 | 0.2105 | 0.2322 | 0 | 0 | 0.0085 |
| 2026 R26 Sea Eagles v Dragons | 0.7871 | 0.6782 | 0.7158 | 1 | 1 | 0.5161 |
