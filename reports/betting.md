# Betting simulation, 2023–2025 backtest

Flat 1-unit bets at the **opening** prices whenever probability × odds − 1 exceeds the minimum edge, using out-of-sample backtest predictions (each season predicted from earlier seasons only), using the main models: the ensemble (average of linear and LightGBM) for both variants. The with-odds models use the opening odds as inputs; the no-odds models use no odds. `linear (no rain flag)` totals don't use the wet-conditions flag, which is only known near kickoff (linear only: LightGBM would need retraining without it).

CLV is the move to the closing price or line in the bet's favour: head to head in implied probability (2023 and part of 2024, where closing prices are reliable), line and total in points (line: 2023 and part of 2024; total: all seasons).

Caveats: draws were excluded from the backtest; the line-up features use the named 17, which may come out after the opening price; and the backtest has informed many modelling decisions, so these results are optimistic. Thresholds are all shown, not chosen.

| model | market | min edge | bets | won | profit (units) | ROI | ROI ci_low | ROI ci_high | P(ROI > 0) | CLV bets | CLV mean | CLV positive | CLV negative | ROI at closing price | ROI 2023 | ROI 2024 | ROI 2025 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| With odds ensemble | head to head | 0% | 440 | 0.6250 | 43.0660 | 0.0979 | 0.0093 | 0.1882 | 0.9841 | 203 | 0.0402 | 0.6749 | 0.3153 | -0.0466 | 0.0019 | 0.1131 | 0.1939 |
| With odds ensemble | head to head | 2% | 365 | 0.6219 | 40.5930 | 0.1112 | 0.0120 | 0.2118 | 0.9859 | 176 | 0.0473 | 0.6932 | 0.2955 | -0.0416 | 0.0305 | 0.1319 | 0.1904 |
| With odds ensemble | head to head | 5% | 267 | 0.5955 | 28.5830 | 0.1071 | -0.0133 | 0.2274 | 0.9598 | 143 | 0.0527 | 0.7063 | 0.2797 | -0.0893 | -0.0028 | 0.1526 | 0.2345 |
| With odds ensemble | head to head | 10% | 145 | 0.5448 | 15.1020 | 0.1042 | -0.0738 | 0.2850 | 0.8670 | 81 | 0.0712 | 0.7531 | 0.2346 | -0.2006 | -0.0720 | 0.1998 | 0.2818 |
| With odds ensemble | line | 0% | 386 | 0.5492 | 18.0510 | 0.0468 | -0.0481 | 0.1415 | 0.8341 | 182 | 2.2143 | 0.6648 | 0.2253 | -0.0033 | -0.0184 | 0.0393 | 0.1328 |
| With odds ensemble | line | 2% | 321 | 0.5358 | 6.7690 | 0.0211 | -0.0820 | 0.1245 | 0.6559 | 156 | 2.4551 | 0.7051 | 0.2051 | -0.0449 | -0.0299 | 0.0154 | 0.0936 |
| With odds ensemble | line | 5% | 207 | 0.5411 | 6.3430 | 0.0306 | -0.0977 | 0.1600 | 0.6843 | 109 | 3 | 0.7615 | 0.1835 | -0.0181 | -0.0225 | 0.1057 | 0.0222 |
| With odds ensemble | line | 10% | 94 | 0.6064 | 14.6990 | 0.1564 | -0.0295 | 0.3406 | 0.9405 | 57 | 3.5789 | 0.7895 | 0.1404 | 0.0694 | 0.0653 | 0.2303 | 0.2375 |
| With odds ensemble | total | 0% | 432 | 0.5463 | 13.7280 | 0.0318 | -0.0560 | 0.1193 | 0.7584 | 432 | 0.2500 | 0.3287 | 0.2407 | 0.0373 | 0.0713 | -0.0050 | 0.0367 |
| With odds ensemble | total | 2% | 362 | 0.5387 | 5.7260 | 0.0158 | -0.0795 | 0.1145 | 0.6377 | 362 | 0.2569 | 0.3370 | 0.2486 | 0.0237 | -0.0348 | 0.0188 | 0.0589 |
| With odds ensemble | total | 5% | 278 | 0.5324 | 1.0240 | 0.0037 | -0.1060 | 0.1123 | 0.5262 | 278 | 0.2410 | 0.3309 | 0.2590 | 0.0128 | -0.0838 | 0.0005 | 0.0853 |
| With odds ensemble | total | 10% | 158 | 0.5696 | 11.3400 | 0.0718 | -0.0711 | 0.2158 | 0.8410 | 158 | 0.1709 | 0.3101 | 0.2532 | 0.0850 | -0.0469 | 0.0934 | 0.1162 |
| No odds ensemble | head to head | 0% | 484 | 0.5702 | 44.2060 | 0.0913 | -0.0061 | 0.1908 | 0.9667 | 220 | 0.0403 | 0.6682 | 0.3182 | -0.0658 | 0.0041 | 0.0809 | 0.1960 |
| No odds ensemble | head to head | 2% | 428 | 0.5701 | 42.8130 | 0.1000 | -0.0034 | 0.2076 | 0.9707 | 196 | 0.0440 | 0.6786 | 0.3061 | -0.0881 | -0.0230 | 0.1218 | 0.2134 |
| No odds ensemble | head to head | 5% | 332 | 0.5452 | 39.3570 | 0.1185 | -0.0066 | 0.2427 | 0.9672 | 152 | 0.0565 | 0.7303 | 0.2500 | -0.1150 | -0.0019 | 0.0864 | 0.2859 |
| No odds ensemble | head to head | 10% | 252 | 0.5238 | 34.4940 | 0.1369 | -0.0138 | 0.2895 | 0.9625 | 116 | 0.0626 | 0.7414 | 0.2414 | -0.1205 | 0.0072 | 0.1290 | 0.2832 |
| No odds ensemble | line | 0% | 472 | 0.5381 | 11.7730 | 0.0249 | -0.0613 | 0.1122 | 0.7177 | 213 | 2.0047 | 0.6526 | 0.2300 | -0.0228 | -0.0170 | 0.0108 | 0.0856 |
| No odds ensemble | line | 2% | 410 | 0.5537 | 22.4130 | 0.0547 | -0.0374 | 0.1473 | 0.8814 | 190 | 1.9737 | 0.6474 | 0.2316 | -0.0066 | -0.0121 | 0.0579 | 0.1285 |
| No odds ensemble | line | 5% | 326 | 0.5644 | 24.2250 | 0.0743 | -0.0296 | 0.1753 | 0.9208 | 150 | 2.4867 | 0.6933 | 0.2000 | -0.0077 | -0.0464 | 0.1423 | 0.1356 |
| No odds ensemble | line | 10% | 223 | 0.5471 | 8.9630 | 0.0402 | -0.0878 | 0.1623 | 0.7255 | 109 | 3.0642 | 0.7523 | 0.1743 | -0.0194 | -0.0008 | 0.0275 | 0.1045 |
| No odds ensemble | total | 0% | 504 | 0.5417 | 11.2640 | 0.0223 | -0.0594 | 0.1040 | 0.7069 | 504 | 0.1607 | 0.2837 | 0.2619 | 0.0285 | 0.0362 | 0.0112 | 0.0206 |
| No odds ensemble | total | 2% | 452 | 0.5398 | 8.2740 | 0.0183 | -0.0691 | 0.1036 | 0.6570 | 452 | 0.1836 | 0.2920 | 0.2544 | 0.0245 | 0.0110 | 0.0063 | 0.0390 |
| No odds ensemble | total | 5% | 387 | 0.5401 | 6.9340 | 0.0179 | -0.0753 | 0.1123 | 0.6416 | 387 | 0.1137 | 0.2946 | 0.2687 | 0.0245 | 0.0048 | -0.0116 | 0.0681 |
| No odds ensemble | total | 10% | 289 | 0.5606 | 16.1640 | 0.0559 | -0.0505 | 0.1617 | 0.8426 | 289 | 0.0761 | 0.2872 | 0.2768 | 0.0648 | 0.0559 | 0.0140 | 0.1144 |
| With odds linear (no rain flag) | total | 0% | 399 | 0.5263 | -1.9840 | -0.0050 | -0.0991 | 0.0889 | 0.4550 | 399 | 0.0852 | 0.3208 | 0.2607 | 0.0013 | -0.0323 | 0.0484 | -0.0419 |
| With odds linear (no rain flag) | total | 2% | 341 | 0.5396 | 6.8140 | 0.0200 | -0.0801 | 0.1197 | 0.6529 | 341 | 0.0733 | 0.3167 | 0.2698 | 0.0258 | -0.0230 | 0.0542 | 0.0323 |
| With odds linear (no rain flag) | total | 5% | 227 | 0.5419 | 5.4840 | 0.0242 | -0.1003 | 0.1471 | 0.6408 | 227 | 0.1057 | 0.3128 | 0.2731 | 0.0328 | -0.0435 | 0.0734 | 0.0338 |
| With odds linear (no rain flag) | total | 10% | 109 | 0.5596 | 6.1300 | 0.0562 | -0.1186 | 0.2300 | 0.7422 | 109 | 0.0275 | 0.3211 | 0.2936 | 0.0702 | -0.0442 | 0.0986 | 0.1333 |
| No odds linear (no rain flag) | total | 0% | 526 | 0.5380 | 8.5140 | 0.0162 | -0.0632 | 0.0963 | 0.6631 | 526 | 0.0875 | 0.2681 | 0.2700 | 0.0316 | 0.0205 | -0.0143 | 0.0464 |
| No odds linear (no rain flag) | total | 2% | 459 | 0.5359 | 5.2940 | 0.0115 | -0.0760 | 0.0964 | 0.6046 | 459 | 0.1198 | 0.2745 | 0.2636 | 0.0280 | -0.0047 | -0.0612 | 0.1121 |
| No odds linear (no rain flag) | total | 5% | 390 | 0.5231 | -5.1160 | -0.0131 | -0.1051 | 0.0800 | 0.4017 | 390 | -0.0051 | 0.2641 | 0.2769 | -0.0057 | -0.0050 | -0.0426 | 0.0156 |
| No odds linear (no rain flag) | total | 10% | 275 | 0.5491 | 9.7540 | 0.0355 | -0.0749 | 0.1468 | 0.7462 | 275 | -0.0582 | 0.2545 | 0.2873 | 0.0453 | 0.0686 | 0.0137 | 0.0376 |
