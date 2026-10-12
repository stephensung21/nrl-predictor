# Upsets: tip the underdog, or bet it? (item 48)

The main with-odds model (ensemble) on every out-of-sample game 2023-2026 (844 games with an opening price, draws out): each season predicted by models built on earlier seasons only. The favourite is the model's tip.

## When signals disagree with the tip

If the model were overconfident in these games, the favourite would win less often than the model's chance.

| signal | games | model's chance | favourite won |
|---|---|---|---|
| Elo backs the other team | 81 | 0.5514 | 0.6543 |
| opening price backs the other team | 74 | 0.5422 | 0.6081 |
| no-odds model backs the other team | 46 | 0.5293 | 0.6304 |
| predicted margin backs the other team | 46 | 0.5219 | 0.5652 |
| two or more of Elo, opening, no-odds | 51 | 0.5303 | 0.5882 |
| all games | 844 | 0.6652 | 0.6576 |

## A model that flips the tip

Logistic regression of 'the favourite won' on the log-odds of the model, Elo, the opening price and the no-odds model, and the predicted margin; each season predicted from the others. It flips the tip where it gives the favourite under 50%.

| tip | log loss | tips right | tips flipped | flips right |
|---|---|---|---|---|
| main model | 0.6287 | 0.6576 | 0 | - |
| meta-model | 0.6313 | 0.6434 | 22 | 0.2273 |

Meta-model minus main model, log loss: +0.0027 (95% interval -0.0026 to +0.0080).

## Betting the underdog at value

Flat 1-unit head-to-head bets at the opening price wherever the model's chance × price − 1 is over 2% (as betting.py and paper trading), split by whether the bet is on the model's tip or on the team it tips to lose.

| bet on | bets | model's chance | mean price | won | ROI | ROI ci_low | ROI ci_high |
|---|---|---|---|---|---|---|---|
| 2023-2025: on the tip | 260 | 0.6892 | 1.6270 | 0.7000 | 0.1169 | 0.0193 | 0.2076 |
| 2023-2025: value underdog (tipped to lose) | 118 | 0.3861 | 3.1712 | 0.4407 | 0.3072 | 0.0241 | 0.5826 |
| 2026: on the tip | 55 | 0.6316 | 1.7971 | 0.6909 | 0.2527 | 0.0182 | 0.4835 |
| 2026: value underdog (tipped to lose) | 52 | 0.3615 | 3.5683 | 0.3846 | 0.2913 | -0.1635 | 0.7799 |
