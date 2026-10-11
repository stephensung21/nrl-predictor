# Betting simulation, 2023–2025 backtest

Flat 1-unit bets at the **opening** prices whenever probability × odds − 1 exceeds the minimum edge, using out-of-sample backtest predictions (each season predicted from earlier seasons only), using the main models: the ensemble (average of linear and LightGBM) for both variants. The with-odds models use the opening odds as inputs; the no-odds models use no odds. `linear (no rain flag)` totals don't use the wet-conditions flag, which is only known near kickoff (linear only: LightGBM would need retraining without it).

CLV is the move to the closing price or line in the bet's favour: head to head in implied probability (only where closing prices are reliable), line and total in points.

Caveats: draws were excluded from the backtest; the line-up features use the named 17, which may come out after the opening price; and the backtest has informed many modelling decisions, so these results are optimistic. Thresholds are all shown, not chosen.

| model | market | min edge | bets | won | profit (units) | ROI | ROI ci_low | ROI ci_high | P(ROI > 0) | CLV bets | CLV mean | CLV positive | CLV negative | ROI at closing price | ROI 2023 | ROI 2024 | ROI 2025 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| With odds ensemble | head to head | 0% | 450 | 0.6111 | 57.8660 | 0.1286 | 0.0305 | 0.2253 | 0.9958 | 209 | 0.0433 | 0.6890 | 0.2967 | -0.0201 | 0.0554 | 0.1119 | 0.2301 |
| With odds ensemble | head to head | 2% | 378 | 0.6190 | 66.6330 | 0.1763 | 0.0699 | 0.2840 | 0.9991 | 179 | 0.0473 | 0.6983 | 0.2849 | -0.0144 | 0.0590 | 0.1372 | 0.3653 |
| With odds ensemble | head to head | 5% | 271 | 0.5646 | 40.8200 | 0.1506 | 0.0140 | 0.2914 | 0.9838 | 129 | 0.0568 | 0.7287 | 0.2558 | -0.1186 | -0.0071 | 0.1536 | 0.3273 |
| With odds ensemble | head to head | 10% | 158 | 0.5696 | 40.5050 | 0.2564 | 0.0637 | 0.4588 | 0.9961 | 74 | 0.0713 | 0.8108 | 0.1757 | -0.1249 | 0.0493 | 0.2042 | 0.5298 |
| With odds ensemble | line | 0% | 400 | 0.5450 | 15.8010 | 0.0395 | -0.0540 | 0.1327 | 0.8003 | 177 | 2.5311 | 0.7175 | 0.1808 | -0.0275 | -0.0375 | 0.0543 | 0.1030 |
| With odds ensemble | line | 2% | 329 | 0.5745 | 31.3710 | 0.0954 | -0.0062 | 0.1957 | 0.9670 | 148 | 2.6622 | 0.7230 | 0.1689 | 0.0325 | 0.0410 | 0.0602 | 0.1838 |
| With odds ensemble | line | 5% | 234 | 0.5641 | 17.4030 | 0.0744 | -0.0469 | 0.1944 | 0.8883 | 113 | 3.1239 | 0.7611 | 0.1681 | 0.0133 | 0.0283 | 0.0137 | 0.1979 |
| With odds ensemble | line | 10% | 114 | 0.6140 | 19.2090 | 0.1685 | 0.0001 | 0.3363 | 0.9753 | 64 | 3.6250 | 0.8125 | 0.1562 | 0.1051 | 0.0510 | 0.3415 | 0.1645 |
| With odds ensemble | total | 0% | 439 | 0.5444 | 12.5280 | 0.0285 | -0.0607 | 0.1131 | 0.7324 | 439 | 0.1959 | 0.3371 | 0.2392 | 0.0337 | 0.0730 | -0.0053 | 0.0253 |
| With odds ensemble | total | 2% | 367 | 0.5395 | 6.8380 | 0.0186 | -0.0751 | 0.1163 | 0.6527 | 367 | 0.1635 | 0.3406 | 0.2561 | 0.0262 | -0.0064 | 0.0261 | 0.0312 |
| With odds ensemble | total | 5% | 282 | 0.5284 | -1.2060 | -0.0043 | -0.1135 | 0.1081 | 0.4757 | 282 | 0.2482 | 0.3369 | 0.2518 | 0.0050 | -0.0849 | 0.0159 | 0.0324 |
| With odds ensemble | total | 10% | 160 | 0.5688 | 11.1920 | 0.0700 | -0.0716 | 0.2125 | 0.8272 | 160 | 0.2438 | 0.3062 | 0.2375 | 0.0820 | -0.0468 | 0.1076 | 0.0915 |
| No odds ensemble | head to head | 0% | 481 | 0.5821 | 48.9460 | 0.1018 | 0.0051 | 0.2003 | 0.9803 | 216 | 0.0437 | 0.6852 | 0.3009 | -0.0525 | 0.0080 | 0.1094 | 0.1930 |
| No odds ensemble | head to head | 2% | 423 | 0.5768 | 48.0100 | 0.1135 | 0.0119 | 0.2200 | 0.9862 | 189 | 0.0476 | 0.7037 | 0.2804 | -0.0958 | -0.0201 | 0.1217 | 0.2451 |
| No odds ensemble | head to head | 5% | 346 | 0.5549 | 44.7400 | 0.1293 | 0.0111 | 0.2503 | 0.9833 | 157 | 0.0557 | 0.7389 | 0.2420 | -0.0945 | 0.0023 | 0.1159 | 0.2750 |
| No odds ensemble | head to head | 10% | 251 | 0.5179 | 31.8240 | 0.1268 | -0.0247 | 0.2798 | 0.9496 | 115 | 0.0642 | 0.7391 | 0.2435 | -0.1375 | 0.0136 | 0.0954 | 0.2763 |
| No odds ensemble | line | 0% | 466 | 0.5536 | 25.1960 | 0.0541 | -0.0313 | 0.1399 | 0.8978 | 210 | 2.0143 | 0.6571 | 0.2190 | -0.0081 | 0.0012 | 0.0532 | 0.1111 |
| No odds ensemble | line | 2% | 417 | 0.5540 | 22.7330 | 0.0545 | -0.0372 | 0.1445 | 0.8805 | 191 | 2.1937 | 0.6754 | 0.2147 | 0.0003 | -0.0001 | 0.0504 | 0.1198 |
| No odds ensemble | line | 5% | 334 | 0.5569 | 20.0890 | 0.0601 | -0.0405 | 0.1614 | 0.8776 | 153 | 2.5294 | 0.6993 | 0.1961 | 0.0094 | 0.0051 | 0.0789 | 0.0985 |
| No odds ensemble | line | 10% | 228 | 0.5614 | 15.2930 | 0.0671 | -0.0574 | 0.1911 | 0.8602 | 106 | 3.2264 | 0.7830 | 0.1509 | -0.0096 | -0.0107 | 0.0822 | 0.1379 |
| No odds ensemble | total | 0% | 507 | 0.5404 | 10.1540 | 0.0200 | -0.0608 | 0.0989 | 0.6821 | 507 | 0.1874 | 0.2840 | 0.2643 | 0.0353 | 0.0186 | 0.0060 | 0.0379 |
| No odds ensemble | total | 2% | 453 | 0.5342 | 3.3740 | 0.0074 | -0.0805 | 0.0940 | 0.5690 | 453 | 0.1523 | 0.2892 | 0.2561 | 0.0135 | -0.0105 | 0.0003 | 0.0331 |
| No odds ensemble | total | 5% | 393 | 0.5369 | 4.7640 | 0.0121 | -0.0802 | 0.1039 | 0.5999 | 393 | 0.1069 | 0.2875 | 0.2672 | 0.0189 | -0.0043 | -0.0178 | 0.0659 |
| No odds ensemble | total | 10% | 296 | 0.5574 | 15.0740 | 0.0509 | -0.0566 | 0.1586 | 0.8247 | 296 | 0.0642 | 0.2804 | 0.2770 | 0.0586 | 0.0906 | -0.0021 | 0.0899 |
| With odds linear (no rain flag) | total | 0% | 399 | 0.5263 | -1.9840 | -0.0050 | -0.0991 | 0.0889 | 0.4550 | 399 | 0.0852 | 0.3208 | 0.2607 | 0.0013 | -0.0323 | 0.0484 | -0.0419 |
| With odds linear (no rain flag) | total | 2% | 341 | 0.5396 | 6.8140 | 0.0200 | -0.0801 | 0.1197 | 0.6529 | 341 | 0.0733 | 0.3167 | 0.2698 | 0.0258 | -0.0230 | 0.0542 | 0.0323 |
| With odds linear (no rain flag) | total | 5% | 227 | 0.5419 | 5.4840 | 0.0242 | -0.1003 | 0.1471 | 0.6408 | 227 | 0.1057 | 0.3128 | 0.2731 | 0.0328 | -0.0435 | 0.0734 | 0.0338 |
| With odds linear (no rain flag) | total | 10% | 109 | 0.5596 | 6.1300 | 0.0562 | -0.1186 | 0.2300 | 0.7422 | 109 | 0.0275 | 0.3211 | 0.2936 | 0.0702 | -0.0442 | 0.0986 | 0.1333 |
| No odds linear (no rain flag) | total | 0% | 526 | 0.5380 | 8.5140 | 0.0162 | -0.0632 | 0.0963 | 0.6631 | 526 | 0.0875 | 0.2681 | 0.2700 | 0.0316 | 0.0205 | -0.0143 | 0.0464 |
| No odds linear (no rain flag) | total | 2% | 459 | 0.5359 | 5.2940 | 0.0115 | -0.0760 | 0.0964 | 0.6046 | 459 | 0.1198 | 0.2745 | 0.2636 | 0.0280 | -0.0047 | -0.0612 | 0.1121 |
| No odds linear (no rain flag) | total | 5% | 390 | 0.5231 | -5.1160 | -0.0131 | -0.1051 | 0.0800 | 0.4017 | 390 | -0.0051 | 0.2641 | 0.2769 | -0.0057 | -0.0050 | -0.0426 | 0.0156 |
| No odds linear (no rain flag) | total | 10% | 275 | 0.5491 | 9.7540 | 0.0355 | -0.0749 | 0.1468 | 0.7462 | 275 | -0.0582 | 0.2545 | 0.2873 | 0.0453 | 0.0686 | 0.0137 | 0.0376 |

## Bet sizing, head to head (item 43)

Bets with at least a 2% edge, in kickoff order, starting from a bankroll of 1. Flat: 1% of the starting bankroll per bet. Fractional Kelly: that fraction of the Kelly stake (edge / (odds - 1)) of the current bankroll, capped at 5%. The bootstrap resamples the bets 2000 times in random order.

| model | market | staking | bets | final bankroll | largest drawdown | median final (bootstrap) | P(final < start) |
|---|---|---|---|---|---|---|---|
| With odds ensemble | head to head | flat 1% | 378 | 1.6660 | 0.0740 | 1.6600 | 0.0000 |
| With odds ensemble | head to head | 0.25 Kelly | 378 | 3.9220 | 0.2840 | 3.9580 | 0.0100 |
| With odds ensemble | head to head | 0.5 Kelly | 378 | 6.4960 | 0.3210 | 6.6400 | 0.0080 |
| No odds ensemble | head to head | flat 1% | 423 | 1.4800 | 0.1180 | 1.4760 | 0.0160 |
| No odds ensemble | head to head | 0.25 Kelly | 423 | 4.1680 | 0.3900 | 4.2320 | 0.0240 |
| No odds ensemble | head to head | 0.5 Kelly | 423 | 6.2080 | 0.4250 | 5.8290 | 0.0240 |
