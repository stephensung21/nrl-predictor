# Betting simulation, 2023–2025 backtest

Flat 1-unit bets at the **opening** prices whenever probability × odds − 1 exceeds the minimum edge, using out-of-sample backtest predictions (each season predicted from earlier seasons only), using the main models: the ensemble (average of linear and LightGBM) for both variants. The with-odds models use the opening odds as inputs; the no-odds models use no odds. `linear (no rain flag)` totals don't use the wet-conditions flag, which is only known near kickoff (linear only: LightGBM would need retraining without it).

CLV is the move to the closing price or line in the bet's favour: head to head in implied probability (2023 and part of 2024, where closing prices are reliable), line and total in points (line: 2023 and part of 2024; total: all seasons).

Caveats: draws were excluded from the backtest; the line-up features use the named 17, which may come out after the opening price; and the backtest has informed many modelling decisions, so these results are optimistic. Thresholds are all shown, not chosen.

| model | market | min edge | bets | won | profit (units) | ROI | ROI ci_low | ROI ci_high | P(ROI > 0) | CLV bets | CLV mean | CLV positive | CLV negative | ROI at closing price | ROI 2023 | ROI 2024 | ROI 2025 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| With odds ensemble | head to head | 0% | 442 | 0.6086 | 55.8160 | 0.1263 | 0.0304 | 0.2246 | 0.9941 | 208 | 0.0439 | 0.6875 | 0.3029 | -0.0350 | 0.0389 | 0.1016 | 0.2592 |
| With odds ensemble | head to head | 2% | 372 | 0.6075 | 59.5530 | 0.1601 | 0.0514 | 0.2708 | 0.9979 | 180 | 0.0483 | 0.7056 | 0.2833 | -0.0389 | 0.0252 | 0.1339 | 0.3642 |
| With odds ensemble | head to head | 5% | 281 | 0.5623 | 42.5900 | 0.1516 | 0.0144 | 0.2905 | 0.9842 | 139 | 0.0585 | 0.7338 | 0.2518 | -0.1296 | -0.0191 | 0.1652 | 0.3544 |
| With odds ensemble | head to head | 10% | 170 | 0.5353 | 31.6520 | 0.1862 | -0.0019 | 0.3821 | 0.9740 | 86 | 0.0701 | 0.7674 | 0.2209 | -0.2135 | -0.0840 | 0.1426 | 0.5596 |
| With odds ensemble | line | 0% | 407 | 0.5455 | 16.4010 | 0.0403 | -0.0527 | 0.1340 | 0.8036 | 184 | 2.5217 | 0.7228 | 0.1739 | -0.0341 | -0.0387 | 0.0403 | 0.1235 |
| With odds ensemble | line | 2% | 336 | 0.5625 | 24.4890 | 0.0729 | -0.0247 | 0.1733 | 0.9201 | 156 | 2.6346 | 0.7244 | 0.1731 | 0.0026 | 0.0119 | 0.0292 | 0.1868 |
| With odds ensemble | line | 5% | 229 | 0.5502 | 10.9230 | 0.0477 | -0.0767 | 0.1726 | 0.7761 | 112 | 3.1250 | 0.7500 | 0.1518 | -0.0293 | -0.0139 | 0.0148 | 0.1601 |
| With odds ensemble | line | 10% | 116 | 0.6121 | 19.1690 | 0.1652 | -0.0005 | 0.3299 | 0.9742 | 68 | 3.4706 | 0.7941 | 0.1618 | 0.0956 | 0.0480 | 0.2843 | 0.2214 |
| With odds ensemble | total | 0% | 436 | 0.5550 | 21.3980 | 0.0491 | -0.0384 | 0.1352 | 0.8652 | 436 | 0.1858 | 0.3326 | 0.2408 | 0.0541 | 0.1041 | 0.0123 | 0.0363 |
| With odds ensemble | total | 2% | 360 | 0.5472 | 11.7080 | 0.0325 | -0.0630 | 0.1273 | 0.7515 | 360 | 0.2417 | 0.3417 | 0.2472 | 0.0406 | 0.0296 | 0.0149 | 0.0595 |
| With odds ensemble | total | 5% | 281 | 0.5338 | 1.9340 | 0.0069 | -0.1026 | 0.1153 | 0.5534 | 281 | 0.2776 | 0.3416 | 0.2527 | 0.0155 | -0.0711 | 0.0081 | 0.0705 |
| With odds ensemble | total | 10% | 159 | 0.5723 | 12.2320 | 0.0769 | -0.0673 | 0.2186 | 0.8500 | 159 | 0.2327 | 0.3208 | 0.2327 | 0.0895 | -0.1066 | 0.1225 | 0.1242 |
| No odds ensemble | head to head | 0% | 480 | 0.5750 | 43.0860 | 0.0898 | -0.0061 | 0.1886 | 0.9655 | 219 | 0.0424 | 0.6849 | 0.3014 | -0.0906 | -0.0348 | 0.0993 | 0.2163 |
| No odds ensemble | head to head | 2% | 431 | 0.5800 | 52.3930 | 0.1216 | 0.0179 | 0.2278 | 0.9896 | 195 | 0.0483 | 0.7077 | 0.2769 | -0.0917 | -0.0049 | 0.1133 | 0.2690 |
| No odds ensemble | head to head | 5% | 341 | 0.5484 | 42.9470 | 0.1259 | 0.0033 | 0.2510 | 0.9773 | 156 | 0.0571 | 0.7436 | 0.2372 | -0.1025 | -0.0092 | 0.0963 | 0.3042 |
| No odds ensemble | head to head | 10% | 255 | 0.5373 | 40.7240 | 0.1597 | 0.0107 | 0.3091 | 0.9814 | 119 | 0.0658 | 0.7563 | 0.2269 | -0.1055 | 0.0460 | 0.1269 | 0.3180 |
| No odds ensemble | line | 0% | 471 | 0.5478 | 20.2460 | 0.0430 | -0.0417 | 0.1291 | 0.8402 | 211 | 2.0758 | 0.6588 | 0.2180 | -0.0132 | -0.0051 | 0.0307 | 0.1048 |
| No odds ensemble | line | 2% | 418 | 0.5574 | 25.5330 | 0.0611 | -0.0298 | 0.1521 | 0.9020 | 191 | 2.2670 | 0.6859 | 0.1937 | 0.0005 | 0.0076 | 0.0416 | 0.1408 |
| No odds ensemble | line | 5% | 339 | 0.5605 | 22.6290 | 0.0668 | -0.0345 | 0.1677 | 0.9040 | 161 | 2.5093 | 0.7019 | 0.1925 | 0.0075 | -0.0141 | 0.1171 | 0.1036 |
| No odds ensemble | line | 10% | 229 | 0.5546 | 12.3530 | 0.0539 | -0.0695 | 0.1776 | 0.8080 | 109 | 3.0642 | 0.7615 | 0.1651 | -0.0373 | -0.0359 | 0.0748 | 0.1379 |
| No odds ensemble | total | 0% | 507 | 0.5464 | 15.7140 | 0.0310 | -0.0533 | 0.1121 | 0.7742 | 507 | 0.1617 | 0.2860 | 0.2604 | 0.0372 | 0.0372 | 0.0057 | 0.0536 |
| No odds ensemble | total | 2% | 447 | 0.5436 | 11.3640 | 0.0254 | -0.0633 | 0.1119 | 0.7157 | 447 | 0.1812 | 0.2953 | 0.2528 | 0.0321 | 0.0045 | 0.0116 | 0.0624 |
| No odds ensemble | total | 5% | 384 | 0.5365 | 4.1840 | 0.0109 | -0.0830 | 0.1054 | 0.5932 | 384 | 0.1250 | 0.2969 | 0.2656 | 0.0177 | 0.0144 | -0.0306 | 0.0606 |
| No odds ensemble | total | 10% | 286 | 0.5490 | 9.7640 | 0.0341 | -0.0765 | 0.1435 | 0.7326 | 286 | 0.0664 | 0.2867 | 0.2797 | 0.0426 | 0.0496 | -0.0380 | 0.1187 |
| With odds linear (no rain flag) | total | 0% | 399 | 0.5263 | -1.9840 | -0.0050 | -0.0991 | 0.0889 | 0.4550 | 399 | 0.0852 | 0.3208 | 0.2607 | 0.0013 | -0.0323 | 0.0484 | -0.0419 |
| With odds linear (no rain flag) | total | 2% | 341 | 0.5396 | 6.8140 | 0.0200 | -0.0801 | 0.1197 | 0.6529 | 341 | 0.0733 | 0.3167 | 0.2698 | 0.0258 | -0.0230 | 0.0542 | 0.0323 |
| With odds linear (no rain flag) | total | 5% | 227 | 0.5419 | 5.4840 | 0.0242 | -0.1003 | 0.1471 | 0.6408 | 227 | 0.1057 | 0.3128 | 0.2731 | 0.0328 | -0.0435 | 0.0734 | 0.0338 |
| With odds linear (no rain flag) | total | 10% | 109 | 0.5596 | 6.1300 | 0.0562 | -0.1186 | 0.2300 | 0.7422 | 109 | 0.0275 | 0.3211 | 0.2936 | 0.0702 | -0.0442 | 0.0986 | 0.1333 |
| No odds linear (no rain flag) | total | 0% | 526 | 0.5380 | 8.5140 | 0.0162 | -0.0632 | 0.0963 | 0.6631 | 526 | 0.0875 | 0.2681 | 0.2700 | 0.0316 | 0.0205 | -0.0143 | 0.0464 |
| No odds linear (no rain flag) | total | 2% | 459 | 0.5359 | 5.2940 | 0.0115 | -0.0760 | 0.0964 | 0.6046 | 459 | 0.1198 | 0.2745 | 0.2636 | 0.0280 | -0.0047 | -0.0612 | 0.1121 |
| No odds linear (no rain flag) | total | 5% | 390 | 0.5231 | -5.1160 | -0.0131 | -0.1051 | 0.0800 | 0.4017 | 390 | -0.0051 | 0.2641 | 0.2769 | -0.0057 | -0.0050 | -0.0426 | 0.0156 |
| No odds linear (no rain flag) | total | 10% | 275 | 0.5491 | 9.7540 | 0.0355 | -0.0749 | 0.1468 | 0.7462 | 275 | -0.0582 | 0.2545 | 0.2873 | 0.0453 | 0.0686 | 0.0137 | 0.0376 |
