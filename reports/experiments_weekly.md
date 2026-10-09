# Weekly refitting (2023–2025 backtest)

The current backtest fits each season's models once, before the season. Weekly refitting keeps each season's settings (developed on earlier seasons) but refits the model weights before every round on every game before it, including that season's earlier rounds; calibration still uses complete earlier seasons. `diff` is weekly minus current (negative = better), with a paired bootstrap 95% interval; the last rows split the win model by part of the season.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 13 weekly refitting: linear | With odds | home_win | log loss | 0.6243 | 0.6255 | 0.0012 | -0.0000 | 0.0024 | no clear difference |  |
| 13 weekly refitting: linear | With odds | margin | MAE | 13.5866 | 13.5813 | -0.0053 | -0.0332 | 0.0218 | no clear difference |  |
| 13 weekly refitting: linear | With odds | total | MAE | 10.7185 | 10.7044 | -0.0141 | -0.0466 | 0.0188 | no clear difference |  |
| 13 weekly refitting: ensemble | With odds | home_win | log loss | 0.6245 | 0.6265 | 0.0021 | -0.0005 | 0.0047 | no clear difference |  |
| 13 weekly refitting: ensemble | With odds | margin | MAE | 13.5148 | 13.5147 | -0.0001 | -0.0436 | 0.0446 | no clear difference |  |
| 13 weekly refitting: ensemble | With odds | total | MAE | 10.7773 | 10.7448 | -0.0326 | -0.0683 | 0.0038 | no clear difference |  |
| 13 weekly refitting: linear | No odds | home_win | log loss | 0.6275 | 0.6288 | 0.0013 | -0.0000 | 0.0026 | no clear difference |  |
| 13 weekly refitting: linear | No odds | margin | MAE | 13.6034 | 13.6063 | 0.0030 | -0.0244 | 0.0293 | no clear difference |  |
| 13 weekly refitting: linear | No odds | total | MAE | 10.8072 | 10.7979 | -0.0093 | -0.0346 | 0.0169 | no clear difference |  |
| 13 weekly refitting: ensemble | No odds | home_win | log loss | 0.6279 | 0.6293 | 0.0014 | -0.0012 | 0.0040 | no clear difference |  |
| 13 weekly refitting: ensemble | No odds | margin | MAE | 13.5366 | 13.5307 | -0.0059 | -0.0514 | 0.0394 | no clear difference |  |
| 13 weekly refitting: ensemble | No odds | total | MAE | 10.8319 | 10.8147 | -0.0172 | -0.0396 | 0.0052 | no clear difference |  |
| 13 weekly refitting, rounds 1-9: ensemble | With odds | home_win | log loss | 0.6579 | 0.6586 | 0.0006 | -0.0029 | 0.0041 | no clear difference |  |
| 13 weekly refitting, rounds 1-9: ensemble | No odds | home_win | log loss | 0.6596 | 0.6598 | 0.0001 | -0.0031 | 0.0035 | no clear difference |  |
| 13 weekly refitting, rounds 10-18: ensemble | With odds | home_win | log loss | 0.6684 | 0.6669 | -0.0015 | -0.0070 | 0.0040 | no clear difference |  |
| 13 weekly refitting, rounds 10-18: ensemble | No odds | home_win | log loss | 0.6656 | 0.6646 | -0.0010 | -0.0060 | 0.0040 | no clear difference |  |
| 13 weekly refitting, round 19+: ensemble | With odds | home_win | log loss | 0.5593 | 0.5655 | 0.0062 | 0.0014 | 0.0109 | worse |  |
| 13 weekly refitting, round 19+: ensemble | No odds | home_win | log loss | 0.5692 | 0.5736 | 0.0044 | -0.0006 | 0.0093 | no clear difference |  |
