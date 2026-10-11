# Weather at kickoff (2023–2025 backtest)

The recorded weather (nrl.com) is missing for almost all of 2023 and 2024, so the current wet-conditions flag (totals model) there comes from the ground conditions alone. These experiments use Open-Meteo's weather for every game instead (`src/weather.py`): rain in the 2 hours either side of kickoff, wind over the first 2 hours, temperature at kickoff; roofed venues get no rain or wind. Results are for the main ensembles; `diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

## A. Weather as it was (reanalysis)

The most a game-day refresh could gain: the weather that actually happened. Correlation with the match total: rain -0.152, recorded wet flag -0.162.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| W1 + rain (mm) in totals: ensemble | With odds | home_win | log loss | 0.6220 | 0.6219 | -0.0001 | -0.0014 | 0.0011 | no clear difference |  |
| W1 + rain (mm) in totals: ensemble | With odds | margin | MAE | 13.4944 | 13.4954 | 0.0010 | -0.0070 | 0.0091 | no clear difference |  |
| W1 + rain (mm) in totals: ensemble | With odds | total | MAE | 10.7776 | 10.7926 | 0.0150 | -0.0614 | 0.0901 | no clear difference |  |
| W1 + rain (mm) in totals: ensemble | No odds | home_win | log loss | 0.6266 | 0.6267 | 0.0001 | -0.0011 | 0.0013 | no clear difference |  |
| W1 + rain (mm) in totals: ensemble | No odds | margin | MAE | 13.5158 | 13.5103 | -0.0055 | -0.0146 | 0.0035 | no clear difference |  |
| W1 + rain (mm) in totals: ensemble | No odds | total | MAE | 10.8333 | 10.8274 | -0.0059 | -0.0888 | 0.0775 | no clear difference |  |
| W2 rain (mm) instead of the recorded wet flag: ensemble | With odds | home_win | log loss | 0.6220 | 0.6218 | -0.0002 | -0.0015 | 0.0011 | no clear difference |  |
| W2 rain (mm) instead of the recorded wet flag: ensemble | With odds | margin | MAE | 13.4944 | 13.4961 | 0.0017 | -0.0052 | 0.0088 | no clear difference |  |
| W2 rain (mm) instead of the recorded wet flag: ensemble | With odds | total | MAE | 10.7776 | 10.8268 | 0.0491 | -0.0430 | 0.1395 | no clear difference |  |
| W2 rain (mm) instead of the recorded wet flag: ensemble | No odds | home_win | log loss | 0.6266 | 0.6267 | 0.0001 | -0.0010 | 0.0013 | no clear difference |  |
| W2 rain (mm) instead of the recorded wet flag: ensemble | No odds | margin | MAE | 13.5158 | 13.5082 | -0.0075 | -0.0161 | 0.0009 | no clear difference |  |
| W2 rain (mm) instead of the recorded wet flag: ensemble | No odds | total | MAE | 10.8333 | 10.8502 | 0.0169 | -0.0731 | 0.1076 | no clear difference |  |
| W3 rain flag (1 mm+) instead of the recorded wet flag: ensemble | With odds | home_win | log loss | 0.6220 | 0.6219 | -0.0001 | -0.0005 | 0.0003 | no clear difference |  |
| W3 rain flag (1 mm+) instead of the recorded wet flag: ensemble | With odds | margin | MAE | 13.4944 | 13.4963 | 0.0020 | -0.0050 | 0.0089 | no clear difference |  |
| W3 rain flag (1 mm+) instead of the recorded wet flag: ensemble | With odds | total | MAE | 10.7776 | 10.8321 | 0.0545 | -0.0398 | 0.1505 | no clear difference |  |
| W3 rain flag (1 mm+) instead of the recorded wet flag: ensemble | No odds | home_win | log loss | 0.6266 | 0.6268 | 0.0002 | -0.0002 | 0.0006 | no clear difference |  |
| W3 rain flag (1 mm+) instead of the recorded wet flag: ensemble | No odds | margin | MAE | 13.5158 | 13.5091 | -0.0067 | -0.0158 | 0.0024 | no clear difference |  |
| W3 rain flag (1 mm+) instead of the recorded wet flag: ensemble | No odds | total | MAE | 10.8333 | 10.8522 | 0.0189 | -0.0641 | 0.1021 | no clear difference |  |
| W4 + rain, wind and temperature in totals: ensemble | With odds | home_win | log loss | 0.6220 | 0.6204 | -0.0016 | -0.0035 | 0.0004 | no clear difference |  |
| W4 + rain, wind and temperature in totals: ensemble | With odds | margin | MAE | 13.4944 | 13.4859 | -0.0084 | -0.0229 | 0.0060 | no clear difference |  |
| W4 + rain, wind and temperature in totals: ensemble | With odds | total | MAE | 10.7776 | 10.7971 | 0.0195 | -0.0576 | 0.0952 | no clear difference |  |
| W4 + rain, wind and temperature in totals: ensemble | No odds | home_win | log loss | 0.6266 | 0.6249 | -0.0017 | -0.0039 | 0.0005 | no clear difference |  |
| W4 + rain, wind and temperature in totals: ensemble | No odds | margin | MAE | 13.5158 | 13.5056 | -0.0102 | -0.0281 | 0.0072 | no clear difference |  |
| W4 + rain, wind and temperature in totals: ensemble | No odds | total | MAE | 10.8333 | 10.8343 | 0.0010 | -0.0776 | 0.0797 | no clear difference |  |
| W5 rain, wind and temperature in LightGBM only: ensemble | With odds | home_win | log loss | 0.6220 | 0.6207 | -0.0013 | -0.0032 | 0.0007 | no clear difference |  |
| W5 rain, wind and temperature in LightGBM only: ensemble | With odds | margin | MAE | 13.4944 | 13.4843 | -0.0100 | -0.0254 | 0.0050 | no clear difference |  |
| W5 rain, wind and temperature in LightGBM only: ensemble | With odds | total | MAE | 10.7776 | 10.7848 | 0.0072 | -0.0409 | 0.0569 | no clear difference |  |
| W5 rain, wind and temperature in LightGBM only: ensemble | No odds | home_win | log loss | 0.6266 | 0.6250 | -0.0016 | -0.0036 | 0.0005 | no clear difference |  |
| W5 rain, wind and temperature in LightGBM only: ensemble | No odds | margin | MAE | 13.5158 | 13.5088 | -0.0070 | -0.0224 | 0.0087 | no clear difference |  |
| W5 rain, wind and temperature in LightGBM only: ensemble | No odds | total | MAE | 10.8333 | 10.8288 | -0.0045 | -0.0474 | 0.0390 | no clear difference |  |

## B. What the live jobs would know (2024–2025)

Each season's models fitted as in the backtest, then fed what is known in advance. The baseline is the current model as the live jobs run it: wet flag 0, because the weather isn't known when they predict. `current model, recorded` is the current backtest (the flag as recorded on the day), the gap the live jobs leave; the next two rows keep the current model and set its flag from the forecast (1 mm or more). The W2/W3 rows are those models fed Open-Meteo's archived forecasts: issued 1 day before kickoff (a game-day refresh), or the one the Tuesday prediction (07:15 UTC) would have had. Tuesday's lead (days): 2: 2 games, 3: 54 games, 4: 142 games, 5: 208 games, 6: 18 games.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| current model, recorded | With odds | total | MAE | 11.0751 | 10.9438 | -0.1313 | -0.2830 | 0.0152 | no clear difference |  |
| current model, recorded | With odds | margin | MAE | 13.5642 | 13.5642 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| current model, recorded | With odds | home_win | log loss | 0.6319 | 0.6319 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| current model, recorded | No odds | total | MAE | 11.1048 | 10.9914 | -0.1134 | -0.2336 | 0.0032 | no clear difference |  |
| current model, recorded | No odds | margin | MAE | 13.5716 | 13.5716 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| current model, recorded | No odds | home_win | log loss | 0.6345 | 0.6345 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| current model, wet flag from the 1-day forecast | With odds | total | MAE | 11.0751 | 10.9840 | -0.0912 | -0.1882 | 0.0059 | no clear difference |  |
| current model, wet flag from the 1-day forecast | With odds | margin | MAE | 13.5642 | 13.5642 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| current model, wet flag from the 1-day forecast | With odds | home_win | log loss | 0.6319 | 0.6319 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| current model, wet flag from the 1-day forecast | No odds | total | MAE | 11.1048 | 11.0413 | -0.0635 | -0.1385 | 0.0126 | no clear difference |  |
| current model, wet flag from the 1-day forecast | No odds | margin | MAE | 13.5716 | 13.5716 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| current model, wet flag from the 1-day forecast | No odds | home_win | log loss | 0.6345 | 0.6345 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| current model, wet flag from the Tuesday forecast | With odds | total | MAE | 11.0751 | 10.9762 | -0.0989 | -0.2040 | 0.0039 | no clear difference |  |
| current model, wet flag from the Tuesday forecast | With odds | margin | MAE | 13.5642 | 13.5642 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| current model, wet flag from the Tuesday forecast | With odds | home_win | log loss | 0.6319 | 0.6319 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| current model, wet flag from the Tuesday forecast | No odds | total | MAE | 11.1048 | 11.0362 | -0.0686 | -0.1498 | 0.0122 | no clear difference |  |
| current model, wet flag from the Tuesday forecast | No odds | margin | MAE | 13.5716 | 13.5716 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| current model, wet flag from the Tuesday forecast | No odds | home_win | log loss | 0.6345 | 0.6345 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| W2, game day (1-day forecast) | With odds | total | MAE | 11.0751 | 10.9606 | -0.1145 | -0.2424 | 0.0137 | no clear difference |  |
| W2, game day (1-day forecast) | With odds | margin | MAE | 13.5642 | 13.5675 | 0.0032 | -0.0043 | 0.0110 | no clear difference |  |
| W2, game day (1-day forecast) | With odds | home_win | log loss | 0.6319 | 0.6312 | -0.0007 | -0.0016 | 0.0001 | no clear difference |  |
| W2, game day (1-day forecast) | No odds | total | MAE | 11.1048 | 10.9703 | -0.1344 | -0.2648 | -0.0039 | better |  |
| W2, game day (1-day forecast) | No odds | margin | MAE | 13.5716 | 13.5663 | -0.0053 | -0.0154 | 0.0048 | no clear difference |  |
| W2, game day (1-day forecast) | No odds | home_win | log loss | 0.6345 | 0.6342 | -0.0004 | -0.0012 | 0.0004 | no clear difference |  |
| W2, Tuesday forecast | With odds | total | MAE | 11.0751 | 10.9845 | -0.0906 | -0.2291 | 0.0472 | no clear difference |  |
| W2, Tuesday forecast | With odds | margin | MAE | 13.5642 | 13.5675 | 0.0032 | -0.0044 | 0.0110 | no clear difference |  |
| W2, Tuesday forecast | With odds | home_win | log loss | 0.6319 | 0.6314 | -0.0005 | -0.0013 | 0.0004 | no clear difference |  |
| W2, Tuesday forecast | No odds | total | MAE | 11.1048 | 11.0106 | -0.0942 | -0.2317 | 0.0478 | no clear difference |  |
| W2, Tuesday forecast | No odds | margin | MAE | 13.5716 | 13.5666 | -0.0050 | -0.0150 | 0.0051 | no clear difference |  |
| W2, Tuesday forecast | No odds | home_win | log loss | 0.6345 | 0.6344 | -0.0002 | -0.0011 | 0.0007 | no clear difference |  |
| W3, game day (1-day forecast) | With odds | total | MAE | 11.0751 | 11.0080 | -0.0672 | -0.1823 | 0.0502 | no clear difference |  |
| W3, game day (1-day forecast) | With odds | margin | MAE | 13.5642 | 13.5675 | 0.0033 | -0.0042 | 0.0110 | no clear difference |  |
| W3, game day (1-day forecast) | With odds | home_win | log loss | 0.6319 | 0.6319 | -0.0000 | -0.0005 | 0.0004 | no clear difference |  |
| W3, game day (1-day forecast) | No odds | total | MAE | 11.1048 | 11.0269 | -0.0779 | -0.1812 | 0.0263 | no clear difference |  |
| W3, game day (1-day forecast) | No odds | margin | MAE | 13.5716 | 13.5664 | -0.0052 | -0.0165 | 0.0061 | no clear difference |  |
| W3, game day (1-day forecast) | No odds | home_win | log loss | 0.6345 | 0.6347 | 0.0001 | -0.0003 | 0.0005 | no clear difference |  |
| W3, Tuesday forecast | With odds | total | MAE | 11.0751 | 10.9973 | -0.0779 | -0.1999 | 0.0428 | no clear difference |  |
| W3, Tuesday forecast | With odds | margin | MAE | 13.5642 | 13.5675 | 0.0032 | -0.0042 | 0.0109 | no clear difference |  |
| W3, Tuesday forecast | With odds | home_win | log loss | 0.6319 | 0.6318 | -0.0001 | -0.0005 | 0.0004 | no clear difference |  |
| W3, Tuesday forecast | No odds | total | MAE | 11.1048 | 11.0268 | -0.0780 | -0.1857 | 0.0299 | no clear difference |  |
| W3, Tuesday forecast | No odds | margin | MAE | 13.5716 | 13.5664 | -0.0051 | -0.0164 | 0.0061 | no clear difference |  |
| W3, Tuesday forecast | No odds | home_win | log loss | 0.6345 | 0.6346 | 0.0000 | -0.0004 | 0.0004 | no clear difference |  |
