# nrl-predictor

[![ci](https://github.com/stephensung21/nrl-predictor/actions/workflows/ci.yml/badge.svg)](https://github.com/stephensung21/nrl-predictor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

nrl-predictor predicts every NRL game before kickoff: the chance each team wins, the margin, the total points and the score. It's judged against the bookmakers' prices. Each week a scheduled pipeline scrapes results, fetches team lists and odds, predicts the coming round, grades the last one and publishes everything to a database. That database feeds a small tipping-comp website for a few friends.

The aim is to match or beat the betting market using only what's known before kickoff. The model gets close to the closing price, and it beats the opening price, Elo and "always tip the home team".

## Results

All results are out of sample: each season is predicted by a model built only on the seasons before it.

| Win probability (log loss, lower is better) | 2023–2025 backtest (631 games) | 2026 final test (197 games) |
|---|---|---|
| **Main model** (ensemble, with odds as an input) | 0.622 | 0.648 |
| Market closing price | 0.620 | 0.647 |
| Market opening price | 0.633 | 0.658 |
| Elo only | 0.638 | 0.658 |
| Always the home team | 0.683 | 0.694 |

The model's margins are within 0.1 points of the market's line (2026 mean absolute error: 15.27 points for the model, 15.20 for the closing line). Its totals beat the closing total (10.90 vs 11.06). The 2026 test was run once, with every setting fixed beforehand.

Full reports: [backtest](reports/backtest.md) · [2026 final test](reports/final_2026.md) · [betting simulation](reports/betting.md) ([2026](reports/betting_2026.md)) · [every experiment tried](reports/experiments/)

## How it works

- **Data.** Every NRL game from 2020 to 2026, scraped from nrl.com's match-centre data: about 1,400 games and 51,000 player-game rows. Also reserve grade and State of Origin, and historical odds from [AusSportsBetting](https://www.aussportsbetting.com/data/).
- **Features.** Each game uses only what was known before kickoff. That covers Elo ratings, regularised plus-minus ratings for every player (refitted before each round), and how the named 17 compares with each team's usual side, including missing stars. It also covers context such as the Origin period and wet conditions.
- **Models.** A logistic and ridge regression, and LightGBM, with Platt calibration, averaged 50/50. There are two variants: one takes the opening odds as an input, one never sees odds. Both are fitted once before the season and then frozen.
- **Weekly pipeline.** GitHub Actions runs it on a schedule. Monday's job scrapes the results and grades the predictions. Tuesday's job predicts the round from the team lists. Wednesday to Sunday the refresh job re-predicts games whose lists or prices changed, and the Sunday-night odds job catches the opening prices. Every run is committed to `data/pipeline/live/` and published to Supabase.
- **Website.** A Next.js site with predictions, model vs market, Elo charts, a tipping comp with a ladder, and news. It runs on sample data until it's connected to Supabase. It hasn't been deployed yet.

## Quick start

Requires Python 3.12. Pinned versions matter: the frozen models only load with the exact library versions they were saved with.

```bash
git clone https://github.com/stephensung21/nrl-predictor.git
cd nrl-predictor
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Re-predict 2026 Round 10 as it stood on its Tuesday, with the frozen models
python src/predict.py --replay --season 2026 --round 10
```

It takes about a minute and prints the round:

```
         kickoff                 game        tip  win % predicted score  margin  total  market (home %)     model
Fri 08 May 18:00    Roosters v Titans   Roosters   74.0           32-18    13.6   50.2             79.0 with odds
Fri 08 May 20:00       Cowboys v Eels    Cowboys   74.0           29-18    10.7   47.3             68.0 with odds
...
```

It also writes the predictions to `reports/predictions/2026_round10_replay.{csv,md,json}`.

## Usage

Run every command from the repo root.

| Command | What it does |
|---|---|
| `python src/scrape.py --years 2026` | Scrape matches, team stats and player stats from nrl.com into `data/processed/` |
| `python src/features.py` | Build the feature table (`data/processed/features.csv`) |
| `python src/train.py --backtest` | Rerun the full development procedure for 2023–2025 → `reports/backtest.md` |
| `python src/betting.py` | Simulate flat-stake betting on the backtest → `reports/betting.md` |
| `python src/experiments.py --only weather` | Run one experiment → `reports/experiments/` |
| `python src/train.py --freeze` | Pre-season: fit on every past season and save `models/<season>/` |
| `python src/predict.py --season 2027 --round 1` | Predict a live round from nrl.com's current team lists |
| `python pipeline/run.py --job predict` | Run one weekly job (`results`, `predict`, `refresh` or `odds`) |
| `python pipeline/replay.py --season 2026 --rounds 1 10 --check` | Replay the weekly schedule over a past season as an end-to-end test |

The pipeline's API keys are optional. A step whose key is missing is skipped. Copy [`.env.example`](.env.example) to `.env` to set them. The workflows read the same names from GitHub secrets.

### Website

```bash
cd web
npm install
npm run dev          # http://localhost:3000, on sample data
```

Copy [`web/.env.example`](web/.env.example) to `web/.env.local` to connect it to Supabase.

### Tests

```bash
python -m pytest -m "not slow"   # CI's Python suite; drop the marker to include the slow leakage test
cd web && npm test               # the website, including the tipping rules run in Postgres (PGlite)
```

## Project layout

```
src/            model code: scraping, features, Elo, training, prediction, experiments
pipeline/       the weekly jobs: fetch odds and weather, predict, grade, publish, back up
models/         frozen model bundles, one per season served
data/
  processed/    scraped tables (matches, team and player stats, team lists)
  pipeline/     the live season's run log, predictions, odds snapshots and grades
  nrl_betting_odds.xlsx   historical results and odds (AusSportsBetting)
reports/        backtest, final test and betting reports; reports/experiments/ for every idea tested
supabase/       database migrations: model data, tipping comp and its rules
web/            Next.js website
docs/           plans, the improvement log and the design brief
tests/          Python tests and shared fixtures
```

`src/` and `pipeline/` are plain script folders, not an installed package. The frozen model bundles refer to `models.Platt` by module name, so the modules keep their names.

## Documentation

- [docs/PLAN.md](docs/PLAN.md): the original project plan
- [docs/MODELLING_PLAN.md](docs/MODELLING_PLAN.md): targets, validation and models
- [docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md): every change tried, adopted or rejected, with its backtest result
- [docs/PLAN_WEB.md](docs/PLAN_WEB.md): the weekly automation and the website, and what's built
- [docs/DESIGN_BRIEF.md](docs/DESIGN_BRIEF.md) and [DESIGN.md](DESIGN.md): the website's design

## Limitations

- The backtest guided many modelling decisions, so its results are a little optimistic. The 2026 final test is the fair measure.
- The betting simulation's profits are noisy. Their confidence intervals are wide, and the 2026 totals prices in the odds data look doubtful. It's a research check, not betting advice.
- Team lists change after Tuesday, so the pipeline re-predicts games through the week. Weather is unknown until the day, so it's left out of live predictions.

## License

[MIT](LICENSE)
