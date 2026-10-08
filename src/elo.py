"""
Elo engine. Runs over every result in the odds sheet (2009+) and returns pre-match ratings.

Settings are tuned on 2013-2020 only, before any season the model is trained or tested on.
"""

import itertools
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PARAMS_FILE = ROOT / "data" / "processed" / "elo_params.json"

DEFAULT_PARAMS = {"k": 30, "hfa": 45, "neutral_hfa": 0, "regress": 0.3, "mov": True}


def run_elo(games, k=30, hfa=45, neutral_hfa=0, regress=0.3, mov=True):
    """games: sorted DataFrame with season, home_team, away_team, home_score, away_score, neutral.

    Returns DataFrame (same index) with elo_home, elo_away (pre-match) and elo_prob (home win).
    """
    ratings, season_of = {}, None
    out = np.empty((len(games), 3))
    for i, g in enumerate(games.itertuples(index=False)):
        if g.season != season_of:  # off-season: pull every rating partway back to 1500
            ratings = {t: r + regress * (1500 - r) for t, r in ratings.items()}
            season_of = g.season
        rh, ra = ratings.get(g.home_team, 1500.0), ratings.get(g.away_team, 1500.0)
        adv = neutral_hfa if g.neutral else hfa
        p = 1 / (1 + 10 ** ((ra - rh - adv) / 400))
        out[i] = (rh, ra, p)

        if pd.isna(g.home_score) or pd.isna(g.away_score):
            continue
        margin = g.home_score - g.away_score
        actual = 1.0 if margin > 0 else 0.0 if margin < 0 else 0.5
        mult = 1.0
        if mov and margin != 0:
            winner_diff = (rh + adv - ra) if margin > 0 else (ra - rh - adv)
            mult = math.log(abs(margin) + 1) * 2.2 / (winner_diff * 0.001 + 2.2)
        delta = k * mult * (actual - p)
        ratings[g.home_team] = rh + delta
        ratings[g.away_team] = ra - delta
    return pd.DataFrame(out, index=games.index, columns=["elo_home", "elo_away", "elo_prob"])


def log_loss(y, p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def tune(odds, seasons=range(2013, 2021)):
    """Grid search Elo settings on log loss over `seasons` (draws excluded from scoring)."""
    mask = odds["season"].isin(seasons) & (odds["home_score"] != odds["away_score"])
    y = (odds.loc[mask, "home_score"] > odds.loc[mask, "away_score"]).astype(float).values
    best = None
    grid = itertools.product([6, 8, 10, 12, 15, 20, 25, 30, 40], [20, 35, 50, 65], [0.2, 0.3, 0.4, 0.5, 0.6, 0.7], [True, False])
    for k, hfa, regress, mov in grid:
        params = {"k": k, "hfa": hfa, "neutral_hfa": 0, "regress": regress, "mov": mov}
        p = run_elo(odds, **params).loc[mask, "elo_prob"].values
        score = log_loss(y, p)
        if best is None or score < best[0]:
            best = (score, params)
    return best


if __name__ == "__main__":
    from ingest import load_odds

    odds = load_odds()
    score, params = tune(odds)
    PARAMS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PARAMS_FILE.write_text(json.dumps(params, indent=2))
    print(f"best Elo params (2013-2020 log loss {score:.4f}): {params}")
