# Weekly refitting with weekly calibration (2023–2025 backtest)

A (the baseline) fits the models and calibration once per season. B refits the model weights before every round (each season's settings fixed). C also recalibrates the final win probability before every round on all earlier out-of-sample predictions (earlier backtest seasons and this season's earlier rounds; at least 50 games). D recalibrates weekly without refitting the weights. `diff` is the set-up minus A (negative = better), with a paired bootstrap 95% interval; round 19+ rows cover the late season.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 20 B weekly model refit: ensemble | With odds | home_win | log loss | 0.6220 | 0.6253 | 0.0033 | -0.0016 | 0.0082 | no clear difference |  |
| 20 B weekly model refit: ensemble, round 19+ | With odds | home_win | log loss | 0.5598 | 0.5681 | 0.0083 | 0.0002 | 0.0159 | worse |  |
| 20 C weekly refit + weekly calibration (slope only): ensemble | With odds | home_win | log loss | 0.6220 | 0.6280 | 0.0060 | -0.0023 | 0.0135 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope only): ensemble, round 19+ | With odds | home_win | log loss | 0.5598 | 0.5757 | 0.0159 | 0.0031 | 0.0283 | worse |  |
| 20 D weekly calibration only (slope only): ensemble | With odds | home_win | log loss | 0.6220 | 0.6244 | 0.0024 | -0.0037 | 0.0082 | no clear difference |  |
| 20 D weekly calibration only (slope only): ensemble, round 19+ | With odds | home_win | log loss | 0.5598 | 0.5688 | 0.0090 | -0.0011 | 0.0184 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope and intercept): ensemble | With odds | home_win | log loss | 0.6220 | 0.6305 | 0.0085 | -0.0003 | 0.0166 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope and intercept): ensemble, round 19+ | With odds | home_win | log loss | 0.5598 | 0.5757 | 0.0159 | 0.0029 | 0.0287 | worse |  |
| 20 D weekly calibration only (slope and intercept): ensemble | With odds | home_win | log loss | 0.6220 | 0.6270 | 0.0050 | -0.0016 | 0.0111 | no clear difference |  |
| 20 D weekly calibration only (slope and intercept): ensemble, round 19+ | With odds | home_win | log loss | 0.5598 | 0.5687 | 0.0090 | -0.0016 | 0.0188 | no clear difference |  |
| 20 B weekly model refit: linear | With odds | home_win | log loss | 0.6209 | 0.6261 | 0.0052 | -0.0032 | 0.0141 | no clear difference |  |
| 20 B weekly model refit: linear, round 19+ | With odds | home_win | log loss | 0.5619 | 0.5660 | 0.0040 | -0.0074 | 0.0143 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope only): linear | With odds | home_win | log loss | 0.6209 | 0.6290 | 0.0082 | -0.0017 | 0.0183 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope only): linear, round 19+ | With odds | home_win | log loss | 0.5619 | 0.5707 | 0.0088 | -0.0045 | 0.0211 | no clear difference |  |
| 20 D weekly calibration only (slope only): linear | With odds | home_win | log loss | 0.6209 | 0.6238 | 0.0030 | -0.0017 | 0.0072 | no clear difference |  |
| 20 D weekly calibration only (slope only): linear, round 19+ | With odds | home_win | log loss | 0.5619 | 0.5672 | 0.0053 | -0.0007 | 0.0110 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope and intercept): linear | With odds | home_win | log loss | 0.6209 | 0.6316 | 0.0107 | 0.0006 | 0.0209 | worse |  |
| 20 C weekly refit + weekly calibration (slope and intercept): linear, round 19+ | With odds | home_win | log loss | 0.5619 | 0.5713 | 0.0094 | -0.0051 | 0.0230 | no clear difference |  |
| 20 D weekly calibration only (slope and intercept): linear | With odds | home_win | log loss | 0.6209 | 0.6265 | 0.0056 | 0.0002 | 0.0108 | worse |  |
| 20 D weekly calibration only (slope and intercept): linear, round 19+ | With odds | home_win | log loss | 0.5619 | 0.5674 | 0.0055 | -0.0014 | 0.0120 | no clear difference |  |
| 20 B weekly model refit: ensemble | No odds | home_win | log loss | 0.6266 | 0.6280 | 0.0014 | -0.0011 | 0.0039 | no clear difference |  |
| 20 B weekly model refit: ensemble, round 19+ | No odds | home_win | log loss | 0.5680 | 0.5718 | 0.0037 | -0.0012 | 0.0085 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope only): ensemble | No odds | home_win | log loss | 0.6266 | 0.6304 | 0.0038 | -0.0040 | 0.0111 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope only): ensemble, round 19+ | No odds | home_win | log loss | 0.5680 | 0.5806 | 0.0126 | -0.0005 | 0.0251 | no clear difference |  |
| 20 D weekly calibration only (slope only): ensemble | No odds | home_win | log loss | 0.6266 | 0.6287 | 0.0021 | -0.0053 | 0.0089 | no clear difference |  |
| 20 D weekly calibration only (slope only): ensemble, round 19+ | No odds | home_win | log loss | 0.5680 | 0.5776 | 0.0096 | -0.0028 | 0.0210 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope and intercept): ensemble | No odds | home_win | log loss | 0.6266 | 0.6331 | 0.0065 | -0.0019 | 0.0143 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope and intercept): ensemble, round 19+ | No odds | home_win | log loss | 0.5680 | 0.5813 | 0.0133 | 0.0002 | 0.0262 | worse |  |
| 20 D weekly calibration only (slope and intercept): ensemble | No odds | home_win | log loss | 0.6266 | 0.6314 | 0.0048 | -0.0030 | 0.0121 | no clear difference |  |
| 20 D weekly calibration only (slope and intercept): ensemble, round 19+ | No odds | home_win | log loss | 0.5680 | 0.5782 | 0.0101 | -0.0020 | 0.0219 | no clear difference |  |
| 20 B weekly model refit: linear | No odds | home_win | log loss | 0.6261 | 0.6271 | 0.0010 | -0.0005 | 0.0026 | no clear difference |  |
| 20 B weekly model refit: linear, round 19+ | No odds | home_win | log loss | 0.5697 | 0.5702 | 0.0005 | -0.0025 | 0.0034 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope only): linear | No odds | home_win | log loss | 0.6261 | 0.6298 | 0.0037 | -0.0031 | 0.0100 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope only): linear, round 19+ | No odds | home_win | log loss | 0.5697 | 0.5767 | 0.0070 | -0.0042 | 0.0173 | no clear difference |  |
| 20 D weekly calibration only (slope only): linear | No odds | home_win | log loss | 0.6261 | 0.6287 | 0.0025 | -0.0039 | 0.0086 | no clear difference |  |
| 20 D weekly calibration only (slope only): linear, round 19+ | No odds | home_win | log loss | 0.5697 | 0.5762 | 0.0065 | -0.0039 | 0.0162 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope and intercept): linear | No odds | home_win | log loss | 0.6261 | 0.6328 | 0.0067 | -0.0007 | 0.0138 | no clear difference |  |
| 20 C weekly refit + weekly calibration (slope and intercept): linear, round 19+ | No odds | home_win | log loss | 0.5697 | 0.5778 | 0.0081 | -0.0035 | 0.0190 | no clear difference |  |
| 20 D weekly calibration only (slope and intercept): linear | No odds | home_win | log loss | 0.6261 | 0.6316 | 0.0055 | -0.0014 | 0.0123 | no clear difference |  |
| 20 D weekly calibration only (slope and intercept): linear, round 19+ | No odds | home_win | log loss | 0.5697 | 0.5771 | 0.0074 | -0.0034 | 0.0176 | no clear difference |  |
