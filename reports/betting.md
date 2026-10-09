# Betting simulation, 2023–2025 backtest

Flat 1-unit bets at the **opening** prices whenever probability × odds − 1 exceeds the minimum edge, using out-of-sample backtest predictions (each season predicted from earlier seasons only), using the main models: the ensemble (average of linear and LightGBM) for both variants. The with-odds models use the opening odds as inputs; the no-odds models use no odds. `linear (no rain flag)` totals don't use the wet-conditions flag, which is only known near kickoff (linear only: LightGBM would need retraining without it).

CLV is the move to the closing price or line in the bet's favour: head to head in implied probability (2023 and part of 2024, where closing prices are reliable), line and total in points (line: 2023 and part of 2024; total: all seasons).

Caveats: draws were excluded from the backtest; the line-up features use the named 17, which may come out after the opening price; and the backtest has informed many modelling decisions, so these results are optimistic. Thresholds are all shown, not chosen.

| model | market | min edge | bets | won | profit (units) | ROI | ROI ci_low | ROI ci_high | P(ROI > 0) | CLV bets | CLV mean | CLV positive | CLV negative | ROI at closing price | ROI 2023 | ROI 2024 | ROI 2025 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| With odds ensemble | head to head | 0% | 458 | 0.6114 | 32.1910 | 0.0703 | -0.0182 | 0.1600 | 0.9397 | 219 | 0.0474 | 0.6986 | 0.2877 | -0.0505 | 0.0449 | 0.0453 | 0.1299 |
| With odds ensemble | head to head | 2% | 382 | 0.6126 | 31.0210 | 0.0812 | -0.0161 | 0.1799 | 0.9513 | 191 | 0.0513 | 0.7330 | 0.2513 | -0.0536 | 0.0218 | 0.1269 | 0.1063 |
| With odds ensemble | head to head | 5% | 285 | 0.6035 | 31.5180 | 0.1106 | -0.0063 | 0.2266 | 0.9676 | 145 | 0.0593 | 0.7517 | 0.2276 | -0.0662 | 0.0330 | 0.1450 | 0.1748 |
| With odds ensemble | head to head | 10% | 161 | 0.5466 | 14.2220 | 0.0883 | -0.0818 | 0.2622 | 0.8417 | 86 | 0.0731 | 0.8023 | 0.1628 | -0.1120 | 0.0317 | 0.1233 | 0.1270 |
| With odds ensemble | line | 0% | 439 | 0.5216 | -3.0290 | -0.0069 | -0.0950 | 0.0803 | 0.4360 | 212 | 2.1038 | 0.6462 | 0.2311 | -0.1088 | -0.0867 | -0.0551 | 0.1624 |
| With odds ensemble | line | 2% | 364 | 0.5357 | 7.3210 | 0.0201 | -0.0798 | 0.1176 | 0.6536 | 176 | 2.3466 | 0.6875 | 0.2045 | -0.0238 | 0.0040 | -0.0558 | 0.1479 |
| With odds ensemble | line | 5% | 292 | 0.5377 | 7.1210 | 0.0244 | -0.0852 | 0.1329 | 0.6657 | 146 | 2.7397 | 0.7466 | 0.1712 | 0.0065 | 0.0501 | -0.0319 | 0.0768 |
| With odds ensemble | line | 10% | 176 | 0.5568 | 11.0330 | 0.0627 | -0.0770 | 0.2037 | 0.8046 | 90 | 3.7222 | 0.8444 | 0.0778 | 0.0800 | 0.1185 | 0.0088 | 0.0929 |
| With odds ensemble | total | 0% | 440 | 0.5341 | 3.6280 | 0.0082 | -0.0799 | 0.0948 | 0.5685 | 440 | 0.2455 | 0.3250 | 0.2364 | 0.0163 | -0.0104 | 0.0010 | 0.0373 |
| With odds ensemble | total | 2% | 382 | 0.5340 | 2.7580 | 0.0072 | -0.0884 | 0.0981 | 0.5534 | 382 | 0.2984 | 0.3246 | 0.2304 | 0.0161 | -0.0449 | 0.0241 | 0.0395 |
| With odds ensemble | total | 5% | 309 | 0.5243 | -3.5420 | -0.0115 | -0.1151 | 0.0917 | 0.4219 | 309 | 0.2557 | 0.3236 | 0.2492 | -0.0029 | -0.1200 | 0.0109 | 0.0636 |
| With odds ensemble | total | 10% | 189 | 0.5450 | 4.7420 | 0.0251 | -0.1061 | 0.1571 | 0.6472 | 189 | 0.1640 | 0.3069 | 0.2646 | 0.0362 | -0.1998 | 0.0516 | 0.1571 |
| No odds ensemble | head to head | 0% | 489 | 0.5685 | 42.4330 | 0.0868 | -0.0094 | 0.1826 | 0.9617 | 222 | 0.0441 | 0.6937 | 0.2928 | -0.1066 | -0.0447 | 0.0763 | 0.2424 |
| No odds ensemble | head to head | 2% | 427 | 0.5691 | 46.4400 | 0.1088 | 0.0031 | 0.2153 | 0.9790 | 197 | 0.0498 | 0.7157 | 0.2690 | -0.1122 | -0.0350 | 0.1362 | 0.2384 |
| No odds ensemble | head to head | 5% | 356 | 0.5562 | 44.8570 | 0.1260 | 0.0086 | 0.2463 | 0.9820 | 164 | 0.0536 | 0.7195 | 0.2622 | -0.0809 | -0.0046 | 0.1631 | 0.2324 |
| No odds ensemble | head to head | 10% | 259 | 0.5097 | 24.4120 | 0.0943 | -0.0498 | 0.2419 | 0.8967 | 126 | 0.0604 | 0.7540 | 0.2222 | -0.1028 | 0.0092 | 0.0829 | 0.2121 |
| No odds ensemble | line | 0% | 473 | 0.5391 | 12.7750 | 0.0270 | -0.0582 | 0.1106 | 0.7205 | 219 | 2.1735 | 0.6804 | 0.2100 | 0.0023 | 0.0140 | -0.0018 | 0.0735 |
| No odds ensemble | line | 2% | 415 | 0.5566 | 25.0130 | 0.0603 | -0.0304 | 0.1501 | 0.9080 | 198 | 2.3788 | 0.6919 | 0.1970 | 0.0037 | 0.0143 | 0.0430 | 0.1343 |
| No odds ensemble | line | 5% | 341 | 0.5601 | 22.8190 | 0.0669 | -0.0341 | 0.1673 | 0.9014 | 159 | 2.7170 | 0.7296 | 0.1698 | 0.0074 | 0.0192 | 0.0513 | 0.1364 |
| No odds ensemble | line | 10% | 250 | 0.5760 | 24.1430 | 0.0966 | -0.0197 | 0.2137 | 0.9456 | 122 | 3 | 0.7623 | 0.1557 | 0.0627 | 0.0977 | 0.0843 | 0.1097 |
| No odds ensemble | total | 0% | 511 | 0.5440 | 13.6440 | 0.0267 | -0.0543 | 0.1078 | 0.7461 | 511 | 0.2035 | 0.2877 | 0.2505 | 0.0417 | 0.0380 | 0.0156 | 0.0282 |
| No odds ensemble | total | 2% | 466 | 0.5343 | 3.6940 | 0.0079 | -0.0781 | 0.0928 | 0.5787 | 466 | 0.1867 | 0.2811 | 0.2532 | 0.0245 | -0.0372 | 0.0038 | 0.0554 |
| No odds ensemble | total | 5% | 396 | 0.5429 | 9.5440 | 0.0241 | -0.0663 | 0.1174 | 0.7046 | 396 | 0.0657 | 0.2677 | 0.2727 | 0.0309 | 0.0032 | 0.0118 | 0.0619 |
| No odds ensemble | total | 10% | 295 | 0.5390 | 4.8120 | 0.0163 | -0.0909 | 0.1218 | 0.6127 | 295 | 0.0475 | 0.2644 | 0.2881 | 0.0245 | 0.0524 | -0.0102 | 0.0218 |
| With odds linear (no rain flag) | total | 0% | 399 | 0.5263 | -1.9840 | -0.0050 | -0.0991 | 0.0889 | 0.4550 | 399 | 0.0852 | 0.3208 | 0.2607 | 0.0013 | -0.0323 | 0.0484 | -0.0419 |
| With odds linear (no rain flag) | total | 2% | 341 | 0.5396 | 6.8140 | 0.0200 | -0.0801 | 0.1197 | 0.6529 | 341 | 0.0733 | 0.3167 | 0.2698 | 0.0258 | -0.0230 | 0.0542 | 0.0323 |
| With odds linear (no rain flag) | total | 5% | 227 | 0.5419 | 5.4840 | 0.0242 | -0.1003 | 0.1471 | 0.6408 | 227 | 0.1057 | 0.3128 | 0.2731 | 0.0328 | -0.0435 | 0.0734 | 0.0338 |
| With odds linear (no rain flag) | total | 10% | 109 | 0.5596 | 6.1300 | 0.0562 | -0.1186 | 0.2300 | 0.7422 | 109 | 0.0275 | 0.3211 | 0.2936 | 0.0702 | -0.0442 | 0.0986 | 0.1333 |
| No odds linear (no rain flag) | total | 0% | 526 | 0.5380 | 8.5140 | 0.0162 | -0.0632 | 0.0963 | 0.6631 | 526 | 0.0875 | 0.2681 | 0.2700 | 0.0316 | 0.0205 | -0.0143 | 0.0464 |
| No odds linear (no rain flag) | total | 2% | 459 | 0.5359 | 5.2940 | 0.0115 | -0.0760 | 0.0964 | 0.6046 | 459 | 0.1198 | 0.2745 | 0.2636 | 0.0280 | -0.0047 | -0.0612 | 0.1121 |
| No odds linear (no rain flag) | total | 5% | 390 | 0.5231 | -5.1160 | -0.0131 | -0.1051 | 0.0800 | 0.4017 | 390 | -0.0051 | 0.2641 | 0.2769 | -0.0057 | -0.0050 | -0.0426 | 0.0156 |
| No odds linear (no rain flag) | total | 10% | 275 | 0.5491 | 9.7540 | 0.0355 | -0.0749 | 0.1468 | 0.7462 | 275 | -0.0582 | 0.2545 | 0.2873 | 0.0453 | 0.0686 | 0.0137 | 0.0376 |
