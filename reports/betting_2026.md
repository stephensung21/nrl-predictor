# Betting simulation, 2026 (final test season)

Flat 1-unit bets at the **opening** prices whenever probability × odds − 1 exceeds the minimum edge, using out-of-sample predictions for 2026 (developed on 2021–2025, exactly as in the final test), using the main models: the ensemble (average of linear and LightGBM) for both variants. The with-odds models use the opening odds as inputs; the no-odds models use no odds. `linear (no rain flag)` totals don't use the wet-conditions flag, which is only known near kickoff (linear only: LightGBM would need retraining without it).

CLV is the move to the closing price or line in the bet's favour: head to head in implied probability (only where closing prices are reliable), line and total in points.

Caveats: the rules (markets, thresholds, opening prices) are the backtest's, fixed before this season was simulated; draws were excluded; the line-up features use the named 17, which may come out after the opening price. Odds data: the 2026 sheet has impossible prices (implied probabilities summing to under 100%) for 15 opening lines and 9 opening / 67 closing totals; those are dropped. The other 2026 totals prices are also doubtful: about a 1–2% margin instead of the usual 5%, with under prices up to 2.26, so the totals ROI is overstated. Thresholds are all shown, not chosen.

| model | market | min edge | bets | won | profit (units) | ROI | ROI ci_low | ROI ci_high | P(ROI > 0) | CLV bets | CLV mean | CLV positive | CLV negative | ROI at closing price |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| With odds ensemble | head to head | 0% | 132 | 0.5606 | 32.3900 | 0.2454 | 0.0297 | 0.4635 | 0.9874 | 121 | 0.0380 | 0.6777 | 0.2893 | 0.1606 |
| With odds ensemble | head to head | 2% | 107 | 0.5421 | 29.0500 | 0.2715 | 0.0161 | 0.5387 | 0.9819 | 98 | 0.0432 | 0.6939 | 0.2653 | 0.1924 |
| With odds ensemble | head to head | 5% | 81 | 0.5309 | 25.0300 | 0.3090 | 0.0002 | 0.6363 | 0.9750 | 76 | 0.0398 | 0.6711 | 0.2895 | 0.2722 |
| With odds ensemble | head to head | 10% | 50 | 0.5000 | 16.9600 | 0.3392 | -0.0734 | 0.7592 | 0.9465 | 47 | 0.0458 | 0.6809 | 0.2979 | 0.2930 |
| With odds ensemble | line | 0% | 129 | 0.4729 | -12.7000 | -0.0984 | -0.2640 | 0.0655 | 0.1264 | 129 | 0.9380 | 0.4884 | 0.2868 | -0.1054 |
| With odds ensemble | line | 2% | 110 | 0.4909 | -6.9500 | -0.0632 | -0.2386 | 0.1095 | 0.2430 | 110 | 0.9364 | 0.4727 | 0.2909 | -0.0723 |
| With odds ensemble | line | 5% | 89 | 0.4831 | -6.7500 | -0.0758 | -0.2713 | 0.1191 | 0.2244 | 89 | 1.1124 | 0.4719 | 0.2921 | -0.0848 |
| With odds ensemble | line | 10% | 53 | 0.5283 | 0.5500 | 0.0104 | -0.2434 | 0.2651 | 0.5600 | 53 | 1.2264 | 0.4528 | 0.2642 | 0.0019 |
| With odds ensemble | total | 0% | 182 | 0.5440 | 20.3000 | 0.1115 | -0.0370 | 0.2562 | 0.9294 | 182 | 0.1813 | 0.2912 | 0.1758 | 0.0861 |
| With odds ensemble | total | 2% | 167 | 0.5749 | 29.1900 | 0.1748 | 0.0185 | 0.3273 | 0.9857 | 167 | 0.2156 | 0.3054 | 0.1677 | 0.1445 |
| With odds ensemble | total | 5% | 151 | 0.5828 | 29.0100 | 0.1921 | 0.0307 | 0.3503 | 0.9897 | 151 | 0.2848 | 0.3245 | 0.1391 | 0.1629 |
| With odds ensemble | total | 10% | 118 | 0.6102 | 29.4800 | 0.2498 | 0.0689 | 0.4294 | 0.9968 | 118 | 0.3220 | 0.3390 | 0.1441 | 0.2868 |
| No odds ensemble | head to head | 0% | 145 | 0.5724 | 27.8300 | 0.1919 | -0.0107 | 0.3986 | 0.9683 | 135 | 0.0324 | 0.6370 | 0.3259 | 0.1668 |
| No odds ensemble | head to head | 2% | 122 | 0.5410 | 24.0500 | 0.1971 | -0.0345 | 0.4323 | 0.9506 | 113 | 0.0365 | 0.6549 | 0.3009 | 0.1748 |
| No odds ensemble | head to head | 5% | 93 | 0.5376 | 18.5700 | 0.1997 | -0.0640 | 0.4725 | 0.9270 | 86 | 0.0355 | 0.6628 | 0.2791 | 0.1642 |
| No odds ensemble | head to head | 10% | 63 | 0.5079 | 8.6500 | 0.1373 | -0.1700 | 0.4522 | 0.8052 | 59 | 0.0448 | 0.6949 | 0.2712 | 0.0475 |
| No odds ensemble | line | 0% | 151 | 0.5033 | -6.1000 | -0.0404 | -0.1924 | 0.1116 | 0.2929 | 151 | 0.8212 | 0.4636 | 0.3046 | -0.0447 |
| No odds ensemble | line | 2% | 138 | 0.5000 | -6.5500 | -0.0475 | -0.2109 | 0.1069 | 0.2797 | 138 | 0.8623 | 0.4638 | 0.2899 | -0.0518 |
| No odds ensemble | line | 5% | 114 | 0.5088 | -3.3500 | -0.0294 | -0.2105 | 0.1518 | 0.3819 | 114 | 1.0263 | 0.4825 | 0.2982 | -0.0338 |
| No odds ensemble | line | 10% | 79 | 0.4937 | -4.5500 | -0.0576 | -0.2728 | 0.1576 | 0.2946 | 79 | 1.2025 | 0.4937 | 0.2658 | -0.0620 |
| No odds ensemble | total | 0% | 196 | 0.5612 | 27.0800 | 0.1382 | -0.0024 | 0.2809 | 0.9730 | 196 | 0.1684 | 0.2806 | 0.1786 | 0.1126 |
| No odds ensemble | total | 2% | 189 | 0.5608 | 26.3000 | 0.1392 | -0.0052 | 0.2839 | 0.9707 | 189 | 0.1587 | 0.2804 | 0.1852 | 0.1181 |
| No odds ensemble | total | 5% | 184 | 0.5707 | 29.2000 | 0.1587 | 0.0125 | 0.3044 | 0.9836 | 184 | 0.1630 | 0.2826 | 0.1848 | 0.1350 |
| No odds ensemble | total | 10% | 163 | 0.5828 | 30.6100 | 0.1878 | 0.0344 | 0.3448 | 0.9921 | 163 | 0.2025 | 0.2945 | 0.1779 | 0.1597 |
| With odds linear (no rain flag) | total | 0% | 185 | 0.5622 | 27.4500 | 0.1484 | 0.0038 | 0.2953 | 0.9778 | 185 | 0.1892 | 0.2973 | 0.1784 | 0.0983 |
| With odds linear (no rain flag) | total | 2% | 172 | 0.5930 | 36.4900 | 0.2122 | 0.0626 | 0.3607 | 0.9970 | 172 | 0.1919 | 0.2907 | 0.1686 | 0.1562 |
| With odds linear (no rain flag) | total | 5% | 144 | 0.6042 | 34.0300 | 0.2363 | 0.0706 | 0.3997 | 0.9975 | 144 | 0.2569 | 0.3194 | 0.1528 | 0.1993 |
| With odds linear (no rain flag) | total | 10% | 110 | 0.6091 | 28.1300 | 0.2557 | 0.0654 | 0.4431 | 0.9967 | 110 | 0.2636 | 0.3364 | 0.1455 | 0.2592 |
| No odds linear (no rain flag) | total | 0% | 195 | 0.5692 | 30.1700 | 0.1547 | 0.0106 | 0.2943 | 0.9825 | 195 | 0.1795 | 0.2923 | 0.1897 | 0.1049 |
| No odds linear (no rain flag) | total | 2% | 190 | 0.5737 | 31.3500 | 0.1650 | 0.0188 | 0.3092 | 0.9861 | 190 | 0.1579 | 0.2842 | 0.1895 | 0.1161 |
| No odds linear (no rain flag) | total | 5% | 182 | 0.5659 | 26.7900 | 0.1472 | -0.0033 | 0.2898 | 0.9728 | 182 | 0.1374 | 0.2747 | 0.1923 | 0.1161 |
| No odds linear (no rain flag) | total | 10% | 160 | 0.5812 | 29.3900 | 0.1837 | 0.0252 | 0.3354 | 0.9896 | 160 | 0.1875 | 0.2938 | 0.1750 | 0.1512 |
