# Betting simulation, 2023–2025 backtest

Flat 1-unit bets at the **opening** prices whenever probability × odds − 1 exceeds the minimum edge, using out-of-sample backtest predictions (each season predicted from earlier seasons only), using the main models: the ensemble (average of linear and LightGBM) for both variants. The with-odds models use the opening odds as inputs; the no-odds models use no odds. `linear (no rain flag)` totals don't use the wet-conditions flag, which is only known near kickoff (linear only: LightGBM would need retraining without it).

CLV is the move to the closing price or line in the bet's favour: head to head in implied probability (2023 and part of 2024, where closing prices are reliable), line and total in points (line: 2023 and part of 2024; total: all seasons).

Caveats: draws were excluded from the backtest; the line-up features use the named 17, which may come out after the opening price; and the backtest has informed many modelling decisions, so these results are optimistic. Thresholds are all shown, not chosen.

| model | market | min edge | bets | won | profit (units) | ROI | ROI ci_low | ROI ci_high | P(ROI > 0) | CLV bets | CLV mean | CLV positive | CLV negative | ROI at closing price | ROI 2023 | ROI 2024 | ROI 2025 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| With odds ensemble | head to head | 0% | 453 | 0.6291 | 38.0240 | 0.0839 | -0.0023 | 0.1705 | 0.9726 | 216 | 0.0451 | 0.6898 | 0.2963 | -0.0658 | 0.0312 | 0.0961 | 0.1354 |
| With odds ensemble | head to head | 2% | 388 | 0.6289 | 42.3110 | 0.1090 | 0.0129 | 0.2072 | 0.9864 | 189 | 0.0496 | 0.7196 | 0.2646 | -0.0338 | 0.0789 | 0.0912 | 0.1725 |
| With odds ensemble | head to head | 5% | 298 | 0.6208 | 45.3910 | 0.1523 | 0.0337 | 0.2715 | 0.9943 | 152 | 0.0564 | 0.7500 | 0.2303 | -0.0574 | 0.0781 | 0.1483 | 0.2675 |
| With odds ensemble | head to head | 10% | 172 | 0.5756 | 32.0820 | 0.1865 | 0.0171 | 0.3568 | 0.9857 | 92 | 0.0750 | 0.8152 | 0.1630 | -0.0533 | 0.1453 | 0.1512 | 0.2920 |
| With odds ensemble | line | 0% | 446 | 0.5404 | 13.0830 | 0.0293 | -0.0583 | 0.1166 | 0.7445 | 214 | 2.0981 | 0.6682 | 0.2243 | -0.0377 | -0.0392 | -0.0071 | 0.1661 |
| With odds ensemble | line | 2% | 369 | 0.5393 | 10.1810 | 0.0276 | -0.0694 | 0.1247 | 0.7155 | 186 | 2.3548 | 0.7043 | 0.1989 | -0.0462 | -0.0315 | 0.0348 | 0.1059 |
| With odds ensemble | line | 5% | 279 | 0.5376 | 6.8570 | 0.0246 | -0.0868 | 0.1395 | 0.6706 | 147 | 2.4966 | 0.7143 | 0.1837 | -0.0152 | 0.0088 | 0.0362 | 0.0314 |
| With odds ensemble | line | 10% | 172 | 0.5523 | 9.0290 | 0.0525 | -0.0927 | 0.1969 | 0.7574 | 97 | 3.4124 | 0.8247 | 0.1134 | 0.0590 | 0.0998 | -0.0474 | 0.2019 |
| With odds ensemble | total | 0% | 444 | 0.5405 | 9.5040 | 0.0214 | -0.0649 | 0.1083 | 0.6821 | 444 | 0.2140 | 0.3108 | 0.2523 | 0.0276 | 0.0414 | -0.0006 | 0.0286 |
| With odds ensemble | total | 2% | 391 | 0.5371 | 5.5040 | 0.0141 | -0.0783 | 0.1076 | 0.6111 | 391 | 0.1918 | 0.3120 | 0.2583 | 0.0215 | -0.0054 | 0.0262 | 0.0177 |
| With odds ensemble | total | 5% | 281 | 0.5445 | 7.5520 | 0.0269 | -0.0875 | 0.1346 | 0.6859 | 281 | 0.2206 | 0.3096 | 0.2562 | 0.0365 | -0.0564 | 0.0201 | 0.1311 |
| With odds ensemble | total | 10% | 173 | 0.5491 | 5.8720 | 0.0339 | -0.1067 | 0.1747 | 0.6890 | 173 | 0.0867 | 0.2890 | 0.2775 | 0.0448 | -0.1141 | 0.0516 | 0.1429 |
| No odds ensemble | head to head | 0% | 484 | 0.5744 | 42.5330 | 0.0879 | -0.0097 | 0.1854 | 0.9598 | 223 | 0.0433 | 0.6861 | 0.3004 | -0.0485 | 0.0173 | 0.0646 | 0.1912 |
| No odds ensemble | head to head | 2% | 434 | 0.5576 | 35.0700 | 0.0808 | -0.0216 | 0.1861 | 0.9368 | 195 | 0.0502 | 0.7128 | 0.2718 | -0.1089 | -0.0115 | 0.0289 | 0.2338 |
| No odds ensemble | head to head | 5% | 350 | 0.5371 | 31.2050 | 0.0892 | -0.0322 | 0.2091 | 0.9242 | 159 | 0.0582 | 0.7484 | 0.2327 | -0.1189 | -0.0054 | 0.0570 | 0.2175 |
| No odds ensemble | head to head | 10% | 250 | 0.5240 | 32.0220 | 0.1281 | -0.0242 | 0.2756 | 0.9532 | 117 | 0.0669 | 0.7607 | 0.2222 | -0.0529 | 0.0774 | 0.1156 | 0.1962 |
| No odds ensemble | line | 0% | 482 | 0.5332 | 7.2860 | 0.0151 | -0.0687 | 0.0990 | 0.6412 | 217 | 2.1336 | 0.6590 | 0.2212 | -0.0588 | -0.0635 | -0.0088 | 0.1257 |
| No odds ensemble | line | 2% | 418 | 0.5526 | 21.4590 | 0.0513 | -0.0393 | 0.1449 | 0.8709 | 190 | 2.3211 | 0.6895 | 0.2000 | -0.0258 | -0.0123 | 0.0078 | 0.1692 |
| No odds ensemble | line | 5% | 354 | 0.5593 | 22.7470 | 0.0643 | -0.0337 | 0.1625 | 0.8994 | 166 | 2.5904 | 0.7289 | 0.1747 | -0.0116 | -0.0074 | 0.0265 | 0.1897 |
| No odds ensemble | line | 10% | 257 | 0.5564 | 15.1550 | 0.0590 | -0.0589 | 0.1761 | 0.8283 | 129 | 2.6279 | 0.7209 | 0.1860 | 0.0047 | 0.0317 | 0.0283 | 0.1304 |
| No odds ensemble | total | 0% | 510 | 0.5451 | 14.2640 | 0.0280 | -0.0529 | 0.1088 | 0.7482 | 510 | 0.2020 | 0.2980 | 0.2490 | 0.0357 | 0.0288 | 0.0154 | 0.0410 |
| No odds ensemble | total | 2% | 466 | 0.5408 | 9.2140 | 0.0198 | -0.0660 | 0.1043 | 0.6743 | 466 | 0.1695 | 0.2897 | 0.2532 | 0.0258 | -0.0096 | 0.0184 | 0.0486 |
| No odds ensemble | total | 5% | 396 | 0.5404 | 7.2240 | 0.0182 | -0.0730 | 0.1135 | 0.6515 | 396 | 0.1086 | 0.2828 | 0.2727 | 0.0245 | 0.0246 | -0.0208 | 0.0622 |
| No odds ensemble | total | 10% | 287 | 0.5436 | 6.6620 | 0.0232 | -0.0873 | 0.1336 | 0.6628 | 287 | 0.1080 | 0.2753 | 0.2718 | 0.0324 | -0.0446 | 0.0279 | 0.0665 |
| With odds linear (no rain flag) | total | 0% | 407 | 0.5356 | 4.7360 | 0.0116 | -0.0799 | 0.1018 | 0.5922 | 407 | 0.0909 | 0.3096 | 0.2678 | 0.0184 | -0.0197 | 0.0497 | 0.0039 |
| With odds linear (no rain flag) | total | 2% | 345 | 0.5391 | 6.5040 | 0.0189 | -0.0839 | 0.1174 | 0.6337 | 345 | 0.0522 | 0.3043 | 0.2754 | 0.0263 | -0.0060 | 0.0480 | 0.0074 |
| With odds linear (no rain flag) | total | 5% | 228 | 0.5482 | 8.0740 | 0.0354 | -0.0880 | 0.1538 | 0.7210 | 228 | 0.0526 | 0.2895 | 0.2851 | 0.0453 | -0.0446 | 0.0556 | 0.1131 |
| With odds linear (no rain flag) | total | 10% | 112 | 0.5446 | 3.0500 | 0.0272 | -0.1562 | 0.1971 | 0.6118 | 112 | -0.0982 | 0.2768 | 0.3214 | 0.0415 | -0.1077 | 0.0618 | 0.1168 |
| No odds linear (no rain flag) | total | 0% | 513 | 0.5439 | 13.6440 | 0.0266 | -0.0533 | 0.1090 | 0.7442 | 513 | 0.1131 | 0.2729 | 0.2651 | 0.0421 | 0.0362 | -0.0181 | 0.0652 |
| No odds linear (no rain flag) | total | 2% | 451 | 0.5410 | 9.4240 | 0.0209 | -0.0638 | 0.1067 | 0.6738 | 451 | 0.1242 | 0.2749 | 0.2661 | 0.0379 | -0.0036 | -0.0210 | 0.0915 |
| No odds linear (no rain flag) | total | 5% | 392 | 0.5204 | -7.2860 | -0.0186 | -0.1129 | 0.0714 | 0.3477 | 392 | -0.0179 | 0.2602 | 0.2806 | -0.0103 | -0.0130 | -0.0363 | -0.0026 |
| No odds linear (no rain flag) | total | 10% | 268 | 0.5485 | 9.0920 | 0.0339 | -0.0793 | 0.1467 | 0.7206 | 268 | -0.0597 | 0.2537 | 0.2948 | 0.0437 | 0.0434 | 0.0258 | 0.0369 |
