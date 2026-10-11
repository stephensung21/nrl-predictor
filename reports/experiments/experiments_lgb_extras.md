# LightGBM's extra features (2023–2025 backtest)

LightGBM's compact set is every linear-model feature, plus the opening odds for the with-odds model, plus eight extras (`LGB_COMPACT_EXTRA`): `diff_rapm_attack`, `diff_rapm_missing`, `diff_rookies`, `diff_rest_days`, `home_travel`, `away_travel`, `neutral`, `is_final`. Each extra is tested on its own: `drop X` is the current set without it (what it adds on top of the other extras), `only X` is no extras but it (what it adds alone). Only LightGBM changes; the linear models are the same in every row.

## Main ensembles: change against the current setup

New minus current (negative = better): win log loss, margin and total MAE.

| experiment | With odds, home_win | With odds, margin | With odds, total | No odds, home_win | No odds, margin | No odds, total |
|---|---|---|---|---|---|---|
| no extras | -0.0027 | -0.0160 | +0.0038 | -0.0025 | -0.0093 | -0.0066 |
| drop diff_rapm_attack | -0.0011 | -0.0169 | -0.0011 | -0.0011 | -0.0099 | +0.0013 |
| drop diff_rapm_missing | -0.0002 | -0.0041 | +0.0027 | +0.0001 | -0.0037 | +0.0023 |
| drop diff_rookies | -0.0004 | -0.0060 | +0.0007 | -0.0003 | -0.0059 | +0.0042 |
| drop diff_rest_days | -0.0006 | -0.0065 | +0.0098 | -0.0002 | -0.0068 | +0.0080 |
| drop home_travel | -0.0001 | -0.0024 | +0.0003 | +0.0004 | -0.0015 | +0.0076 |
| drop away_travel | -0.0003 | -0.0028 | -0.0024 | +0.0001 | -0.0035 | +0.0052 |
| drop neutral | -0.0004 | -0.0035 | +0.0014 | +0.0001 | -0.0055 | +0.0070 |
| drop is_final | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 | +0.0000 |
| only diff_rapm_attack | -0.0012 | -0.0055 | +0.0063 | -0.0012 | -0.0043 | -0.0103 |
| only diff_rapm_missing | -0.0025 | -0.0120 | +0.0031 | -0.0019 | -0.0144 | -0.0071 |
| only diff_rookies | -0.0018 | -0.0102 | +0.0036 | -0.0012 | -0.0101 | -0.0138 |
| only diff_rest_days | -0.0018 | -0.0137 | +0.0004 | -0.0012 | -0.0115 | -0.0028 |
| only home_travel | -0.0020 | -0.0116 | +0.0041 | -0.0018 | -0.0139 | -0.0141 |
| only away_travel | -0.0026 | -0.0124 | +0.0057 | -0.0025 | -0.0135 | -0.0141 |
| only neutral | -0.0021 | -0.0103 | +0.0037 | -0.0016 | -0.0123 | -0.0138 |
| only is_final | -0.0027 | -0.0160 | +0.0038 | -0.0025 | -0.0093 | -0.0066 |

Clear differences (paired bootstrap 95% interval excludes 0):

- `no extras`: With odds home_win better (-0.0027)
- `no extras`: No odds home_win better (-0.0025)
- `drop diff_rapm_attack`: With odds margin better (-0.0169)
- `only diff_rapm_missing`: With odds home_win better (-0.0025)
- `only diff_rookies`: With odds home_win better (-0.0018)
- `only home_travel`: With odds home_win better (-0.0020)
- `only away_travel`: With odds home_win better (-0.0026)
- `only away_travel`: No odds home_win better (-0.0025)
- `only neutral`: With odds home_win better (-0.0021)
- `only is_final`: With odds home_win better (-0.0027)
- `only is_final`: No odds home_win better (-0.0025)

## 2026 (extra information only)

The final test season, predicted by the same procedure developed on 2021–2025. Not used to decide, since it was already scored once; shown to see whether the backtest's pattern holds on new games. Main ensembles, all 213 games.

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026 no extras: ensemble | With odds | home_win | log loss | 0.6516 | 0.6526 | 0.0009 | -0.0029 | 0.0048 | no clear difference |  |
| 2026 no extras: ensemble | With odds | margin | MAE | 15.3195 | 15.3363 | 0.0168 | -0.0451 | 0.0785 | no clear difference |  |
| 2026 no extras: ensemble | With odds | total | MAE | 10.9576 | 10.9600 | 0.0024 | -0.0181 | 0.0223 | no clear difference |  |
| 2026 no extras: ensemble | No odds | home_win | log loss | 0.6553 | 0.6555 | 0.0002 | -0.0038 | 0.0043 | no clear difference |  |
| 2026 no extras: ensemble | No odds | margin | MAE | 15.5557 | 15.5307 | -0.0250 | -0.1002 | 0.0488 | no clear difference |  |
| 2026 no extras: ensemble | No odds | total | MAE | 11.1181 | 11.1103 | -0.0077 | -0.0322 | 0.0178 | no clear difference |  |
| 2026 drop diff_rapm_attack: ensemble | With odds | home_win | log loss | 0.6516 | 0.6512 | -0.0004 | -0.0013 | 0.0004 | no clear difference |  |
| 2026 drop diff_rapm_attack: ensemble | With odds | margin | MAE | 15.3195 | 15.3199 | 0.0004 | -0.0213 | 0.0222 | no clear difference |  |
| 2026 drop diff_rapm_attack: ensemble | With odds | total | MAE | 10.9576 | 10.9666 | 0.0090 | -0.0192 | 0.0367 | no clear difference |  |
| 2026 drop diff_rapm_attack: ensemble | No odds | home_win | log loss | 0.6553 | 0.6549 | -0.0004 | -0.0017 | 0.0009 | no clear difference |  |
| 2026 drop diff_rapm_attack: ensemble | No odds | margin | MAE | 15.5557 | 15.5494 | -0.0064 | -0.0390 | 0.0277 | no clear difference |  |
| 2026 drop diff_rapm_attack: ensemble | No odds | total | MAE | 11.1181 | 11.1100 | -0.0080 | -0.0225 | 0.0067 | no clear difference |  |
| 2026 drop diff_rapm_attack and is_final: ensemble | With odds | home_win | log loss | 0.6516 | 0.6513 | -0.0004 | -0.0012 | 0.0005 | no clear difference |  |
| 2026 drop diff_rapm_attack and is_final: ensemble | With odds | margin | MAE | 15.3195 | 15.3179 | -0.0016 | -0.0236 | 0.0207 | no clear difference |  |
| 2026 drop diff_rapm_attack and is_final: ensemble | With odds | total | MAE | 10.9576 | 10.9683 | 0.0107 | -0.0189 | 0.0397 | no clear difference |  |
| 2026 drop diff_rapm_attack and is_final: ensemble | No odds | home_win | log loss | 0.6553 | 0.6550 | -0.0003 | -0.0015 | 0.0009 | no clear difference |  |
| 2026 drop diff_rapm_attack and is_final: ensemble | No odds | margin | MAE | 15.5557 | 15.5509 | -0.0048 | -0.0390 | 0.0303 | no clear difference |  |
| 2026 drop diff_rapm_attack and is_final: ensemble | No odds | total | MAE | 11.1181 | 11.1134 | -0.0047 | -0.0178 | 0.0084 | no clear difference |  |

## Every result (LightGBM alone and the ensemble)

| experiment | model | target | metric | baseline | new | diff | ci_low | ci_high | verdict | note |
|---|---|---|---|---|---|---|---|---|---|---|
| 47 no extras: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6226 | -0.0061 | -0.0104 | -0.0021 | better |  |
| 47 no extras: lightgbm | With odds | margin | MAE | 13.5620 | 13.5299 | -0.0322 | -0.0725 | 0.0077 | no clear difference |  |
| 47 no extras: lightgbm | With odds | total | MAE | 10.9068 | 10.9127 | 0.0059 | -0.0321 | 0.0445 | no clear difference |  |
| 47 no extras: ensemble | With odds | home_win | log loss | 0.6220 | 0.6193 | -0.0027 | -0.0047 | -0.0008 | better |  |
| 47 no extras: ensemble | With odds | margin | MAE | 13.4944 | 13.4783 | -0.0160 | -0.0360 | 0.0040 | no clear difference |  |
| 47 no extras: ensemble | With odds | total | MAE | 10.7776 | 10.7814 | 0.0038 | -0.0152 | 0.0231 | no clear difference |  |
| 47 no extras: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6277 | -0.0055 | -0.0110 | -0.0003 | better |  |
| 47 no extras: lightgbm | No odds | margin | MAE | 13.5789 | 13.5681 | -0.0108 | -0.0701 | 0.0472 | no clear difference |  |
| 47 no extras: lightgbm | No odds | total | MAE | 10.9343 | 10.9194 | -0.0149 | -0.0446 | 0.0165 | no clear difference |  |
| 47 no extras: ensemble | No odds | home_win | log loss | 0.6266 | 0.6241 | -0.0025 | -0.0052 | -0.0000 | better |  |
| 47 no extras: ensemble | No odds | margin | MAE | 13.5158 | 13.5065 | -0.0093 | -0.0389 | 0.0199 | no clear difference |  |
| 47 no extras: ensemble | No odds | total | MAE | 10.8333 | 10.8267 | -0.0066 | -0.0216 | 0.0090 | no clear difference |  |
| 47 drop diff_rapm_attack: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6258 | -0.0029 | -0.0059 | 0.0001 | no clear difference |  |
| 47 drop diff_rapm_attack: lightgbm | With odds | margin | MAE | 13.5620 | 13.5344 | -0.0276 | -0.0604 | 0.0054 | no clear difference |  |
| 47 drop diff_rapm_attack: lightgbm | With odds | total | MAE | 10.9068 | 10.8919 | -0.0149 | -0.0447 | 0.0145 | no clear difference |  |
| 47 drop diff_rapm_attack: ensemble | With odds | home_win | log loss | 0.6220 | 0.6209 | -0.0011 | -0.0026 | 0.0003 | no clear difference |  |
| 47 drop diff_rapm_attack: ensemble | With odds | margin | MAE | 13.4944 | 13.4774 | -0.0169 | -0.0333 | -0.0005 | better |  |
| 47 drop diff_rapm_attack: ensemble | With odds | total | MAE | 10.7776 | 10.7765 | -0.0011 | -0.0155 | 0.0136 | no clear difference |  |
| 47 drop diff_rapm_attack: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6306 | -0.0026 | -0.0059 | 0.0007 | no clear difference |  |
| 47 drop diff_rapm_attack: lightgbm | No odds | margin | MAE | 13.5789 | 13.5579 | -0.0210 | -0.0601 | 0.0190 | no clear difference |  |
| 47 drop diff_rapm_attack: lightgbm | No odds | total | MAE | 10.9343 | 10.9301 | -0.0042 | -0.0347 | 0.0265 | no clear difference |  |
| 47 drop diff_rapm_attack: ensemble | No odds | home_win | log loss | 0.6266 | 0.6255 | -0.0011 | -0.0027 | 0.0005 | no clear difference |  |
| 47 drop diff_rapm_attack: ensemble | No odds | margin | MAE | 13.5158 | 13.5058 | -0.0099 | -0.0298 | 0.0101 | no clear difference |  |
| 47 drop diff_rapm_attack: ensemble | No odds | total | MAE | 10.8333 | 10.8346 | 0.0013 | -0.0141 | 0.0168 | no clear difference |  |
| 47 drop diff_rapm_missing: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6281 | -0.0006 | -0.0019 | 0.0007 | no clear difference |  |
| 47 drop diff_rapm_missing: lightgbm | With odds | margin | MAE | 13.5620 | 13.5596 | -0.0024 | -0.0240 | 0.0193 | no clear difference |  |
| 47 drop diff_rapm_missing: lightgbm | With odds | total | MAE | 10.9068 | 10.9076 | 0.0008 | -0.0163 | 0.0184 | no clear difference |  |
| 47 drop diff_rapm_missing: ensemble | With odds | home_win | log loss | 0.6220 | 0.6218 | -0.0002 | -0.0008 | 0.0005 | no clear difference |  |
| 47 drop diff_rapm_missing: ensemble | With odds | margin | MAE | 13.4944 | 13.4902 | -0.0041 | -0.0149 | 0.0066 | no clear difference |  |
| 47 drop diff_rapm_missing: ensemble | With odds | total | MAE | 10.7776 | 10.7803 | 0.0027 | -0.0059 | 0.0116 | no clear difference |  |
| 47 drop diff_rapm_missing: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6333 | 0.0001 | -0.0011 | 0.0015 | no clear difference |  |
| 47 drop diff_rapm_missing: lightgbm | No odds | margin | MAE | 13.5789 | 13.5668 | -0.0121 | -0.0406 | 0.0147 | no clear difference |  |
| 47 drop diff_rapm_missing: lightgbm | No odds | total | MAE | 10.9343 | 10.9311 | -0.0032 | -0.0269 | 0.0209 | no clear difference |  |
| 47 drop diff_rapm_missing: ensemble | No odds | home_win | log loss | 0.6266 | 0.6267 | 0.0001 | -0.0006 | 0.0008 | no clear difference |  |
| 47 drop diff_rapm_missing: ensemble | No odds | margin | MAE | 13.5158 | 13.5121 | -0.0037 | -0.0180 | 0.0097 | no clear difference |  |
| 47 drop diff_rapm_missing: ensemble | No odds | total | MAE | 10.8333 | 10.8356 | 0.0023 | -0.0097 | 0.0143 | no clear difference |  |
| 47 drop diff_rookies: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6277 | -0.0010 | -0.0027 | 0.0006 | no clear difference |  |
| 47 drop diff_rookies: lightgbm | With odds | margin | MAE | 13.5620 | 13.5538 | -0.0083 | -0.0357 | 0.0186 | no clear difference |  |
| 47 drop diff_rookies: lightgbm | With odds | total | MAE | 10.9068 | 10.9015 | -0.0053 | -0.0242 | 0.0136 | no clear difference |  |
| 47 drop diff_rookies: ensemble | With odds | home_win | log loss | 0.6220 | 0.6216 | -0.0004 | -0.0012 | 0.0003 | no clear difference |  |
| 47 drop diff_rookies: ensemble | With odds | margin | MAE | 13.4944 | 13.4883 | -0.0060 | -0.0200 | 0.0077 | no clear difference |  |
| 47 drop diff_rookies: ensemble | With odds | total | MAE | 10.7776 | 10.7783 | 0.0007 | -0.0090 | 0.0104 | no clear difference |  |
| 47 drop diff_rookies: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6328 | -0.0003 | -0.0024 | 0.0018 | no clear difference |  |
| 47 drop diff_rookies: lightgbm | No odds | margin | MAE | 13.5789 | 13.5630 | -0.0159 | -0.0575 | 0.0239 | no clear difference |  |
| 47 drop diff_rookies: lightgbm | No odds | total | MAE | 10.9343 | 10.9344 | 0.0001 | -0.0226 | 0.0232 | no clear difference |  |
| 47 drop diff_rookies: ensemble | No odds | home_win | log loss | 0.6266 | 0.6263 | -0.0003 | -0.0013 | 0.0007 | no clear difference |  |
| 47 drop diff_rookies: ensemble | No odds | margin | MAE | 13.5158 | 13.5099 | -0.0059 | -0.0269 | 0.0144 | no clear difference |  |
| 47 drop diff_rookies: ensemble | No odds | total | MAE | 10.8333 | 10.8375 | 0.0042 | -0.0074 | 0.0157 | no clear difference |  |
| 47 drop diff_rest_days: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6273 | -0.0014 | -0.0029 | 0.0000 | no clear difference |  |
| 47 drop diff_rest_days: lightgbm | With odds | margin | MAE | 13.5620 | 13.5548 | -0.0073 | -0.0285 | 0.0129 | no clear difference |  |
| 47 drop diff_rest_days: lightgbm | With odds | total | MAE | 10.9068 | 10.9151 | 0.0082 | -0.0212 | 0.0380 | no clear difference |  |
| 47 drop diff_rest_days: ensemble | With odds | home_win | log loss | 0.6220 | 0.6214 | -0.0006 | -0.0013 | 0.0001 | no clear difference |  |
| 47 drop diff_rest_days: ensemble | With odds | margin | MAE | 13.4944 | 13.4879 | -0.0065 | -0.0172 | 0.0037 | no clear difference |  |
| 47 drop diff_rest_days: ensemble | With odds | total | MAE | 10.7776 | 10.7874 | 0.0098 | -0.0047 | 0.0245 | no clear difference |  |
| 47 drop diff_rest_days: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6330 | -0.0002 | -0.0016 | 0.0013 | no clear difference |  |
| 47 drop diff_rest_days: lightgbm | No odds | margin | MAE | 13.5789 | 13.5614 | -0.0175 | -0.0384 | 0.0032 | no clear difference |  |
| 47 drop diff_rest_days: lightgbm | No odds | total | MAE | 10.9343 | 10.9408 | 0.0065 | -0.0171 | 0.0313 | no clear difference |  |
| 47 drop diff_rest_days: ensemble | No odds | home_win | log loss | 0.6266 | 0.6264 | -0.0002 | -0.0009 | 0.0005 | no clear difference |  |
| 47 drop diff_rest_days: ensemble | No odds | margin | MAE | 13.5158 | 13.5090 | -0.0068 | -0.0173 | 0.0035 | no clear difference |  |
| 47 drop diff_rest_days: ensemble | No odds | total | MAE | 10.8333 | 10.8413 | 0.0080 | -0.0039 | 0.0201 | no clear difference |  |
| 47 drop home_travel: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6282 | -0.0005 | -0.0020 | 0.0010 | no clear difference |  |
| 47 drop home_travel: lightgbm | With odds | margin | MAE | 13.5620 | 13.5628 | 0.0008 | -0.0184 | 0.0191 | no clear difference |  |
| 47 drop home_travel: lightgbm | With odds | total | MAE | 10.9068 | 10.9009 | -0.0059 | -0.0246 | 0.0123 | no clear difference |  |
| 47 drop home_travel: ensemble | With odds | home_win | log loss | 0.6220 | 0.6219 | -0.0001 | -0.0008 | 0.0006 | no clear difference |  |
| 47 drop home_travel: ensemble | With odds | margin | MAE | 13.4944 | 13.4919 | -0.0024 | -0.0121 | 0.0067 | no clear difference |  |
| 47 drop home_travel: ensemble | With odds | total | MAE | 10.7776 | 10.7779 | 0.0003 | -0.0090 | 0.0097 | no clear difference |  |
| 47 drop home_travel: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6342 | 0.0010 | -0.0006 | 0.0027 | no clear difference |  |
| 47 drop home_travel: lightgbm | No odds | margin | MAE | 13.5789 | 13.5710 | -0.0079 | -0.0310 | 0.0135 | no clear difference |  |
| 47 drop home_travel: lightgbm | No odds | total | MAE | 10.9343 | 10.9417 | 0.0074 | -0.0233 | 0.0382 | no clear difference |  |
| 47 drop home_travel: ensemble | No odds | home_win | log loss | 0.6266 | 0.6270 | 0.0004 | -0.0004 | 0.0012 | no clear difference |  |
| 47 drop home_travel: ensemble | No odds | margin | MAE | 13.5158 | 13.5142 | -0.0015 | -0.0131 | 0.0091 | no clear difference |  |
| 47 drop home_travel: ensemble | No odds | total | MAE | 10.8333 | 10.8409 | 0.0076 | -0.0080 | 0.0229 | no clear difference |  |
| 47 drop away_travel: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6277 | -0.0010 | -0.0023 | 0.0004 | no clear difference |  |
| 47 drop away_travel: lightgbm | With odds | margin | MAE | 13.5620 | 13.5621 | 0.0001 | -0.0191 | 0.0184 | no clear difference |  |
| 47 drop away_travel: lightgbm | With odds | total | MAE | 10.9068 | 10.9098 | 0.0029 | -0.0252 | 0.0313 | no clear difference |  |
| 47 drop away_travel: ensemble | With odds | home_win | log loss | 0.6220 | 0.6217 | -0.0003 | -0.0010 | 0.0003 | no clear difference |  |
| 47 drop away_travel: ensemble | With odds | margin | MAE | 13.4944 | 13.4915 | -0.0028 | -0.0126 | 0.0063 | no clear difference |  |
| 47 drop away_travel: ensemble | With odds | total | MAE | 10.7776 | 10.7752 | -0.0024 | -0.0165 | 0.0118 | no clear difference |  |
| 47 drop away_travel: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6336 | 0.0004 | -0.0005 | 0.0013 | no clear difference |  |
| 47 drop away_travel: lightgbm | No odds | margin | MAE | 13.5789 | 13.5666 | -0.0123 | -0.0345 | 0.0077 | no clear difference |  |
| 47 drop away_travel: lightgbm | No odds | total | MAE | 10.9343 | 10.9347 | 0.0004 | -0.0335 | 0.0347 | no clear difference |  |
| 47 drop away_travel: ensemble | No odds | home_win | log loss | 0.6266 | 0.6267 | 0.0001 | -0.0003 | 0.0006 | no clear difference |  |
| 47 drop away_travel: ensemble | No odds | margin | MAE | 13.5158 | 13.5123 | -0.0035 | -0.0143 | 0.0065 | no clear difference |  |
| 47 drop away_travel: ensemble | No odds | total | MAE | 10.8333 | 10.8385 | 0.0052 | -0.0121 | 0.0225 | no clear difference |  |
| 47 drop neutral: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6276 | -0.0011 | -0.0025 | 0.0003 | no clear difference |  |
| 47 drop neutral: lightgbm | With odds | margin | MAE | 13.5620 | 13.5608 | -0.0013 | -0.0204 | 0.0172 | no clear difference |  |
| 47 drop neutral: lightgbm | With odds | total | MAE | 10.9068 | 10.9016 | -0.0053 | -0.0260 | 0.0151 | no clear difference |  |
| 47 drop neutral: ensemble | With odds | home_win | log loss | 0.6220 | 0.6216 | -0.0004 | -0.0011 | 0.0003 | no clear difference |  |
| 47 drop neutral: ensemble | With odds | margin | MAE | 13.4944 | 13.4908 | -0.0035 | -0.0134 | 0.0057 | no clear difference |  |
| 47 drop neutral: ensemble | With odds | total | MAE | 10.7776 | 10.7790 | 0.0014 | -0.0090 | 0.0118 | no clear difference |  |
| 47 drop neutral: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6335 | 0.0003 | -0.0005 | 0.0013 | no clear difference |  |
| 47 drop neutral: lightgbm | No odds | margin | MAE | 13.5789 | 13.5615 | -0.0174 | -0.0374 | 0.0011 | no clear difference |  |
| 47 drop neutral: lightgbm | No odds | total | MAE | 10.9343 | 10.9391 | 0.0048 | -0.0255 | 0.0353 | no clear difference |  |
| 47 drop neutral: ensemble | No odds | home_win | log loss | 0.6266 | 0.6267 | 0.0001 | -0.0003 | 0.0006 | no clear difference |  |
| 47 drop neutral: ensemble | No odds | margin | MAE | 13.5158 | 13.5103 | -0.0055 | -0.0153 | 0.0040 | no clear difference |  |
| 47 drop neutral: ensemble | No odds | total | MAE | 10.8333 | 10.8403 | 0.0070 | -0.0083 | 0.0223 | no clear difference |  |
| 47 drop is_final: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6287 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 47 drop is_final: lightgbm | With odds | margin | MAE | 13.5620 | 13.5620 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 47 drop is_final: lightgbm | With odds | total | MAE | 10.9068 | 10.9068 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 47 drop is_final: ensemble | With odds | home_win | log loss | 0.6220 | 0.6220 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 47 drop is_final: ensemble | With odds | margin | MAE | 13.4944 | 13.4944 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 47 drop is_final: ensemble | With odds | total | MAE | 10.7776 | 10.7776 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 47 drop is_final: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6332 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 47 drop is_final: lightgbm | No odds | margin | MAE | 13.5789 | 13.5789 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 47 drop is_final: lightgbm | No odds | total | MAE | 10.9343 | 10.9343 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 47 drop is_final: ensemble | No odds | home_win | log loss | 0.6266 | 0.6266 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 47 drop is_final: ensemble | No odds | margin | MAE | 13.5158 | 13.5158 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 47 drop is_final: ensemble | No odds | total | MAE | 10.8333 | 10.8333 | 0.0000 | 0.0000 | 0.0000 | no clear difference |  |
| 47 only diff_rapm_attack: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6262 | -0.0025 | -0.0062 | 0.0010 | no clear difference |  |
| 47 only diff_rapm_attack: lightgbm | With odds | margin | MAE | 13.5620 | 13.5540 | -0.0080 | -0.0391 | 0.0219 | no clear difference |  |
| 47 only diff_rapm_attack: lightgbm | With odds | total | MAE | 10.9068 | 10.9214 | 0.0146 | -0.0215 | 0.0517 | no clear difference |  |
| 47 only diff_rapm_attack: ensemble | With odds | home_win | log loss | 0.6220 | 0.6208 | -0.0012 | -0.0030 | 0.0005 | no clear difference |  |
| 47 only diff_rapm_attack: ensemble | With odds | margin | MAE | 13.4944 | 13.4888 | -0.0055 | -0.0216 | 0.0097 | no clear difference |  |
| 47 only diff_rapm_attack: ensemble | With odds | total | MAE | 10.7776 | 10.7839 | 0.0063 | -0.0115 | 0.0251 | no clear difference |  |
| 47 only diff_rapm_attack: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6307 | -0.0024 | -0.0063 | 0.0016 | no clear difference |  |
| 47 only diff_rapm_attack: lightgbm | No odds | margin | MAE | 13.5789 | 13.5727 | -0.0062 | -0.0523 | 0.0368 | no clear difference |  |
| 47 only diff_rapm_attack: lightgbm | No odds | total | MAE | 10.9343 | 10.9166 | -0.0177 | -0.0552 | 0.0210 | no clear difference |  |
| 47 only diff_rapm_attack: ensemble | No odds | home_win | log loss | 0.6266 | 0.6253 | -0.0012 | -0.0031 | 0.0006 | no clear difference |  |
| 47 only diff_rapm_attack: ensemble | No odds | margin | MAE | 13.5158 | 13.5115 | -0.0043 | -0.0274 | 0.0179 | no clear difference |  |
| 47 only diff_rapm_attack: ensemble | No odds | total | MAE | 10.8333 | 10.8230 | -0.0103 | -0.0292 | 0.0094 | no clear difference |  |
| 47 only diff_rapm_missing: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6232 | -0.0055 | -0.0104 | -0.0008 | better |  |
| 47 only diff_rapm_missing: lightgbm | With odds | margin | MAE | 13.5620 | 13.5415 | -0.0205 | -0.0603 | 0.0189 | no clear difference |  |
| 47 only diff_rapm_missing: lightgbm | With odds | total | MAE | 10.9068 | 10.9095 | 0.0027 | -0.0357 | 0.0425 | no clear difference |  |
| 47 only diff_rapm_missing: ensemble | With odds | home_win | log loss | 0.6220 | 0.6195 | -0.0025 | -0.0048 | -0.0002 | better |  |
| 47 only diff_rapm_missing: ensemble | With odds | margin | MAE | 13.4944 | 13.4824 | -0.0120 | -0.0315 | 0.0076 | no clear difference |  |
| 47 only diff_rapm_missing: ensemble | With odds | total | MAE | 10.7776 | 10.7807 | 0.0031 | -0.0160 | 0.0232 | no clear difference |  |
| 47 only diff_rapm_missing: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6291 | -0.0041 | -0.0086 | 0.0004 | no clear difference |  |
| 47 only diff_rapm_missing: lightgbm | No odds | margin | MAE | 13.5789 | 13.5573 | -0.0216 | -0.0763 | 0.0324 | no clear difference |  |
| 47 only diff_rapm_missing: lightgbm | No odds | total | MAE | 10.9343 | 10.9181 | -0.0162 | -0.0458 | 0.0153 | no clear difference |  |
| 47 only diff_rapm_missing: ensemble | No odds | home_win | log loss | 0.6266 | 0.6247 | -0.0019 | -0.0040 | 0.0003 | no clear difference |  |
| 47 only diff_rapm_missing: ensemble | No odds | margin | MAE | 13.5158 | 13.5014 | -0.0144 | -0.0425 | 0.0130 | no clear difference |  |
| 47 only diff_rapm_missing: ensemble | No odds | total | MAE | 10.8333 | 10.8262 | -0.0071 | -0.0225 | 0.0087 | no clear difference |  |
| 47 only diff_rookies: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6242 | -0.0045 | -0.0085 | -0.0009 | better |  |
| 47 only diff_rookies: lightgbm | With odds | margin | MAE | 13.5620 | 13.5451 | -0.0169 | -0.0515 | 0.0178 | no clear difference |  |
| 47 only diff_rookies: lightgbm | With odds | total | MAE | 10.9068 | 10.9090 | 0.0022 | -0.0361 | 0.0415 | no clear difference |  |
| 47 only diff_rookies: ensemble | With odds | home_win | log loss | 0.6220 | 0.6202 | -0.0018 | -0.0037 | -0.0001 | better |  |
| 47 only diff_rookies: ensemble | With odds | margin | MAE | 13.4944 | 13.4842 | -0.0102 | -0.0274 | 0.0074 | no clear difference |  |
| 47 only diff_rookies: ensemble | With odds | total | MAE | 10.7776 | 10.7812 | 0.0036 | -0.0155 | 0.0238 | no clear difference |  |
| 47 only diff_rookies: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6303 | -0.0029 | -0.0074 | 0.0014 | no clear difference |  |
| 47 only diff_rookies: lightgbm | No odds | margin | MAE | 13.5789 | 13.5611 | -0.0178 | -0.0628 | 0.0268 | no clear difference |  |
| 47 only diff_rookies: lightgbm | No odds | total | MAE | 10.9343 | 10.9106 | -0.0237 | -0.0646 | 0.0210 | no clear difference |  |
| 47 only diff_rookies: ensemble | No odds | home_win | log loss | 0.6266 | 0.6254 | -0.0012 | -0.0034 | 0.0008 | no clear difference |  |
| 47 only diff_rookies: ensemble | No odds | margin | MAE | 13.5158 | 13.5057 | -0.0101 | -0.0327 | 0.0126 | no clear difference |  |
| 47 only diff_rookies: ensemble | No odds | total | MAE | 10.8333 | 10.8194 | -0.0138 | -0.0342 | 0.0089 | no clear difference |  |
| 47 only diff_rest_days: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6243 | -0.0044 | -0.0086 | -0.0003 | better |  |
| 47 only diff_rest_days: lightgbm | With odds | margin | MAE | 13.5620 | 13.5428 | -0.0192 | -0.0635 | 0.0234 | no clear difference |  |
| 47 only diff_rest_days: lightgbm | With odds | total | MAE | 10.9068 | 10.8972 | -0.0097 | -0.0490 | 0.0311 | no clear difference |  |
| 47 only diff_rest_days: ensemble | With odds | home_win | log loss | 0.6220 | 0.6202 | -0.0018 | -0.0038 | 0.0002 | no clear difference |  |
| 47 only diff_rest_days: ensemble | With odds | margin | MAE | 13.4944 | 13.4806 | -0.0137 | -0.0361 | 0.0077 | no clear difference |  |
| 47 only diff_rest_days: ensemble | With odds | total | MAE | 10.7776 | 10.7780 | 0.0004 | -0.0193 | 0.0206 | no clear difference |  |
| 47 only diff_rest_days: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6304 | -0.0028 | -0.0072 | 0.0016 | no clear difference |  |
| 47 only diff_rest_days: lightgbm | No odds | margin | MAE | 13.5789 | 13.5575 | -0.0214 | -0.0769 | 0.0332 | no clear difference |  |
| 47 only diff_rest_days: lightgbm | No odds | total | MAE | 10.9343 | 10.9220 | -0.0123 | -0.0477 | 0.0231 | no clear difference |  |
| 47 only diff_rest_days: ensemble | No odds | home_win | log loss | 0.6266 | 0.6254 | -0.0012 | -0.0033 | 0.0010 | no clear difference |  |
| 47 only diff_rest_days: ensemble | No odds | margin | MAE | 13.5158 | 13.5042 | -0.0115 | -0.0397 | 0.0157 | no clear difference |  |
| 47 only diff_rest_days: ensemble | No odds | total | MAE | 10.8333 | 10.8305 | -0.0028 | -0.0206 | 0.0151 | no clear difference |  |
| 47 only home_travel: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6238 | -0.0049 | -0.0084 | -0.0014 | better |  |
| 47 only home_travel: lightgbm | With odds | margin | MAE | 13.5620 | 13.5426 | -0.0194 | -0.0609 | 0.0212 | no clear difference |  |
| 47 only home_travel: lightgbm | With odds | total | MAE | 10.9068 | 10.9095 | 0.0027 | -0.0352 | 0.0420 | no clear difference |  |
| 47 only home_travel: ensemble | With odds | home_win | log loss | 0.6220 | 0.6200 | -0.0020 | -0.0037 | -0.0004 | better |  |
| 47 only home_travel: ensemble | With odds | margin | MAE | 13.4944 | 13.4827 | -0.0116 | -0.0325 | 0.0090 | no clear difference |  |
| 47 only home_travel: ensemble | With odds | total | MAE | 10.7776 | 10.7817 | 0.0041 | -0.0151 | 0.0238 | no clear difference |  |
| 47 only home_travel: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6290 | -0.0042 | -0.0084 | -0.0000 | better |  |
| 47 only home_travel: lightgbm | No odds | margin | MAE | 13.5789 | 13.5571 | -0.0218 | -0.0791 | 0.0354 | no clear difference |  |
| 47 only home_travel: lightgbm | No odds | total | MAE | 10.9343 | 10.9102 | -0.0241 | -0.0648 | 0.0205 | no clear difference |  |
| 47 only home_travel: ensemble | No odds | home_win | log loss | 0.6266 | 0.6247 | -0.0018 | -0.0038 | 0.0002 | no clear difference |  |
| 47 only home_travel: ensemble | No odds | margin | MAE | 13.5158 | 13.5019 | -0.0139 | -0.0424 | 0.0143 | no clear difference |  |
| 47 only home_travel: ensemble | No odds | total | MAE | 10.8333 | 10.8192 | -0.0141 | -0.0345 | 0.0087 | no clear difference |  |
| 47 only away_travel: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6229 | -0.0058 | -0.0109 | -0.0009 | better |  |
| 47 only away_travel: lightgbm | With odds | margin | MAE | 13.5620 | 13.5401 | -0.0219 | -0.0622 | 0.0180 | no clear difference |  |
| 47 only away_travel: lightgbm | With odds | total | MAE | 10.9068 | 10.9125 | 0.0057 | -0.0662 | 0.0785 | no clear difference |  |
| 47 only away_travel: ensemble | With odds | home_win | log loss | 0.6220 | 0.6194 | -0.0026 | -0.0050 | -0.0003 | better |  |
| 47 only away_travel: ensemble | With odds | margin | MAE | 13.4944 | 13.4820 | -0.0124 | -0.0325 | 0.0081 | no clear difference |  |
| 47 only away_travel: ensemble | With odds | total | MAE | 10.7776 | 10.7833 | 0.0057 | -0.0299 | 0.0419 | no clear difference |  |
| 47 only away_travel: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6277 | -0.0055 | -0.0107 | -0.0005 | better |  |
| 47 only away_travel: lightgbm | No odds | margin | MAE | 13.5789 | 13.5587 | -0.0202 | -0.0770 | 0.0347 | no clear difference |  |
| 47 only away_travel: lightgbm | No odds | total | MAE | 10.9343 | 10.9106 | -0.0237 | -0.0678 | 0.0242 | no clear difference |  |
| 47 only away_travel: ensemble | No odds | home_win | log loss | 0.6266 | 0.6241 | -0.0025 | -0.0049 | -0.0001 | better |  |
| 47 only away_travel: ensemble | No odds | margin | MAE | 13.5158 | 13.5023 | -0.0135 | -0.0422 | 0.0144 | no clear difference |  |
| 47 only away_travel: ensemble | No odds | total | MAE | 10.8333 | 10.8192 | -0.0141 | -0.0361 | 0.0099 | no clear difference |  |
| 47 only neutral: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6238 | -0.0049 | -0.0095 | -0.0004 | better |  |
| 47 only neutral: lightgbm | With odds | margin | MAE | 13.5620 | 13.5454 | -0.0166 | -0.0581 | 0.0240 | no clear difference |  |
| 47 only neutral: lightgbm | With odds | total | MAE | 10.9068 | 10.9090 | 0.0021 | -0.0359 | 0.0417 | no clear difference |  |
| 47 only neutral: ensemble | With odds | home_win | log loss | 0.6220 | 0.6199 | -0.0021 | -0.0043 | -0.0000 | better |  |
| 47 only neutral: ensemble | With odds | margin | MAE | 13.4944 | 13.4840 | -0.0103 | -0.0311 | 0.0104 | no clear difference |  |
| 47 only neutral: ensemble | With odds | total | MAE | 10.7776 | 10.7813 | 0.0037 | -0.0155 | 0.0239 | no clear difference |  |
| 47 only neutral: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6294 | -0.0037 | -0.0083 | 0.0008 | no clear difference |  |
| 47 only neutral: lightgbm | No odds | margin | MAE | 13.5789 | 13.5613 | -0.0176 | -0.0742 | 0.0374 | no clear difference |  |
| 47 only neutral: lightgbm | No odds | total | MAE | 10.9343 | 10.9111 | -0.0232 | -0.0642 | 0.0213 | no clear difference |  |
| 47 only neutral: ensemble | No odds | home_win | log loss | 0.6266 | 0.6249 | -0.0016 | -0.0038 | 0.0005 | no clear difference |  |
| 47 only neutral: ensemble | No odds | margin | MAE | 13.5158 | 13.5035 | -0.0123 | -0.0411 | 0.0155 | no clear difference |  |
| 47 only neutral: ensemble | No odds | total | MAE | 10.8333 | 10.8195 | -0.0138 | -0.0343 | 0.0089 | no clear difference |  |
| 47 only is_final: lightgbm | With odds | home_win | log loss | 0.6287 | 0.6226 | -0.0061 | -0.0104 | -0.0021 | better |  |
| 47 only is_final: lightgbm | With odds | margin | MAE | 13.5620 | 13.5299 | -0.0322 | -0.0725 | 0.0077 | no clear difference |  |
| 47 only is_final: lightgbm | With odds | total | MAE | 10.9068 | 10.9127 | 0.0059 | -0.0321 | 0.0445 | no clear difference |  |
| 47 only is_final: ensemble | With odds | home_win | log loss | 0.6220 | 0.6193 | -0.0027 | -0.0047 | -0.0008 | better |  |
| 47 only is_final: ensemble | With odds | margin | MAE | 13.4944 | 13.4783 | -0.0160 | -0.0360 | 0.0040 | no clear difference |  |
| 47 only is_final: ensemble | With odds | total | MAE | 10.7776 | 10.7814 | 0.0038 | -0.0152 | 0.0231 | no clear difference |  |
| 47 only is_final: lightgbm | No odds | home_win | log loss | 0.6332 | 0.6277 | -0.0055 | -0.0110 | -0.0003 | better |  |
| 47 only is_final: lightgbm | No odds | margin | MAE | 13.5789 | 13.5681 | -0.0108 | -0.0701 | 0.0472 | no clear difference |  |
| 47 only is_final: lightgbm | No odds | total | MAE | 10.9343 | 10.9194 | -0.0149 | -0.0446 | 0.0165 | no clear difference |  |
| 47 only is_final: ensemble | No odds | home_win | log loss | 0.6266 | 0.6241 | -0.0025 | -0.0052 | -0.0000 | better |  |
| 47 only is_final: ensemble | No odds | margin | MAE | 13.5158 | 13.5065 | -0.0093 | -0.0389 | 0.0199 | no clear difference |  |
| 47 only is_final: ensemble | No odds | total | MAE | 10.8333 | 10.8267 | -0.0066 | -0.0216 | 0.0090 | no clear difference |  |
