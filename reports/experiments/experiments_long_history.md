# Elo, the team rating and the odds on the full history (item 52, 2023–2025 backtest)

The training rows start in 2021, but Elo, the team margin rating and the opening odds go back to 2013 in the odds sheet. A base win model (logistic) and margin model (least squares) are fitted on every game from 2013 to the end of the season before each game's season, so every value was known before its season. No-odds base: Elo log-odds and the team margin rating. With-odds base: also the opening log-odds, with separate levels and slopes for Pinnacle (to 2018) and BlueBet (from 2024; item 35's bookmaker change). Three uses:

- **replacing:** the no-odds base replaces `elo_logit` and `team_margin` in the linear models (and so LightGBM's compact set); the with-odds models still get the opening odds as inputs;
- **added:** the base is added beside them;
- **offset:** the linear win and margin models are anchored on the base and learn only the player features (RAPM, star absences) from 2021+, with the pipeline's margin blend; the ensemble averages that with the pipeline's LightGBM.

`diff` is new minus current (negative = better), with a paired bootstrap 95% interval.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 52 long-history base replacing Elo and the team rating: linear | With odds | home_win | log loss | 0.6209 | 0.6220 | 0.0011 | -0.0004 | 0.0027 | no clear difference |  |
| 52 long-history base replacing Elo and the team rating: linear | With odds | margin | MAE | 13.5340 | 13.5350 | 0.0010 | -0.0110 | 0.0130 | no clear difference |  |
| 52 long-history base replacing Elo and the team rating: linear | With odds | total | MAE | 10.7185 | 10.7185 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 52 long-history base replacing Elo and the team rating: ensemble | With odds | home_win | log loss | 0.6209 | 0.6220 | 0.0011 | -0.0013 | 0.0035 | no clear difference |  |
| 52 long-history base replacing Elo and the team rating: ensemble | With odds | margin | MAE | 13.4774 | 13.4872 | 0.0097 | -0.0190 | 0.0375 | no clear difference |  |
| 52 long-history base replacing Elo and the team rating: ensemble | With odds | total | MAE | 10.7765 | 10.7704 | -0.0061 | -0.0196 | 0.0076 | no clear difference |  |
| 52 long-history base replacing Elo and the team rating: linear | No odds | home_win | log loss | 0.6261 | 0.6269 | 0.0008 | -0.0013 | 0.0028 | no clear difference |  |
| 52 long-history base replacing Elo and the team rating: linear | No odds | margin | MAE | 13.5628 | 13.5501 | -0.0127 | -0.0504 | 0.0250 | no clear difference |  |
| 52 long-history base replacing Elo and the team rating: linear | No odds | total | MAE | 10.8072 | 10.8072 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 52 long-history base replacing Elo and the team rating: ensemble | No odds | home_win | log loss | 0.6255 | 0.6269 | 0.0014 | -0.0014 | 0.0044 | no clear difference |  |
| 52 long-history base replacing Elo and the team rating: ensemble | No odds | margin | MAE | 13.5058 | 13.5117 | 0.0058 | -0.0347 | 0.0465 | no clear difference |  |
| 52 long-history base replacing Elo and the team rating: ensemble | No odds | total | MAE | 10.8346 | 10.8302 | -0.0044 | -0.0141 | 0.0053 | no clear difference |  |
| 52 long-history base added: linear | With odds | home_win | log loss | 0.6209 | 0.6212 | 0.0003 | -0.0005 | 0.0011 | no clear difference |  |
| 52 long-history base added: linear | With odds | margin | MAE | 13.5340 | 13.5468 | 0.0127 | -0.0121 | 0.0371 | no clear difference |  |
| 52 long-history base added: linear | With odds | total | MAE | 10.7185 | 10.7185 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 52 long-history base added: ensemble | With odds | home_win | log loss | 0.6209 | 0.6213 | 0.0004 | -0.0005 | 0.0012 | no clear difference |  |
| 52 long-history base added: ensemble | With odds | margin | MAE | 13.4774 | 13.5018 | 0.0243 | 0.0002 | 0.0483 | worse |  |
| 52 long-history base added: ensemble | With odds | total | MAE | 10.7765 | 10.7721 | -0.0044 | -0.0158 | 0.0073 | no clear difference |  |
| 52 long-history base added: linear | No odds | home_win | log loss | 0.6261 | 0.6259 | -0.0003 | -0.0016 | 0.0010 | no clear difference |  |
| 52 long-history base added: linear | No odds | margin | MAE | 13.5628 | 13.5476 | -0.0152 | -0.0543 | 0.0228 | no clear difference |  |
| 52 long-history base added: linear | No odds | total | MAE | 10.8072 | 10.8072 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 52 long-history base added: ensemble | No odds | home_win | log loss | 0.6255 | 0.6262 | 0.0007 | -0.0005 | 0.0019 | no clear difference |  |
| 52 long-history base added: ensemble | No odds | margin | MAE | 13.5058 | 13.5091 | 0.0033 | -0.0284 | 0.0342 | no clear difference |  |
| 52 long-history base added: ensemble | No odds | total | MAE | 10.8346 | 10.8277 | -0.0069 | -0.0209 | 0.0071 | no clear difference |  |
| 52 offset on the long-history base: linear | No odds | home_win | log loss | 0.6261 | 0.6302 | 0.0041 | -0.0014 | 0.0097 | no clear difference |  |
| 52 offset on the long-history base: ensemble | No odds | home_win | log loss | 0.6255 | 0.6268 | 0.0013 | -0.0015 | 0.0041 | no clear difference |  |
| 52 offset on the long-history base: linear | No odds | margin | MAE | 13.5628 | 13.6638 | 0.1011 | -0.0269 | 0.2343 | no clear difference |  |
| 52 offset on the long-history base: ensemble | No odds | margin | MAE | 13.5058 | 13.5275 | 0.0217 | -0.0434 | 0.0879 | no clear difference |  |
| 52 offset on the long-history base: linear | With odds | home_win | log loss | 0.6209 | 0.6246 | 0.0038 | -0.0016 | 0.0091 | no clear difference |  |
| 52 offset on the long-history base: ensemble | With odds | home_win | log loss | 0.6209 | 0.6221 | 0.0012 | -0.0015 | 0.0039 | no clear difference |  |
| 52 offset on the long-history base: linear | With odds | margin | MAE | 13.5340 | 13.6872 | 0.1532 | 0.0435 | 0.2566 | worse |  |
| 52 offset on the long-history base: ensemble | With odds | margin | MAE | 13.4774 | 13.5306 | 0.0531 | -0.0010 | 0.1050 | no clear difference |  |
