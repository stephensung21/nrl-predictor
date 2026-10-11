"""
Paper trading (IMPROVEMENTS.md item 33): the head-to-head bets the model would have made on fully live
information, and how they did. The honest test of the betting edge: the backtest's betting simulation
used opening prices from the sheet, and predictions made with knowledge the opening price didn't have.

For each finished game's prediction of record, the price is Betr's latest live snapshot at or before
the moment the prediction was made (pipeline/fetch_odds.py), so the bet could really have been placed.
A flat 1-unit bet goes on the side with the bigger expected edge (probability x odds - 1) when that
edge is at least MIN_EDGE, as in src/betting.py. A head-to-head bet loses on a draw. Closing line
value compares the bet's price with the last snapshot before kickoff: positive means the bet got a
better price than the market closed at, a much less noisy sign of edge than profit.

Rebuilt from the records by the results job: paper_bets.csv and paper.md beside the graded season.
"""

import numpy as np
import pandas as pd

import fetch_odds
from common import load_matches

MIN_EDGE = 0.02
BET_COLS = ["match_id", "season", "round", "home_team", "away_team", "side", "team", "prob", "odds", "edge",
            "placed_at", "price_at", "close_odds", "home_score", "away_score", "won", "profit", "clv"]


def oriented_snapshots(snaps, fixtures):
    """Live snapshots with nrl.com's match id, prices turned round to nrl.com's home team."""
    if snaps is None or snaps.empty:
        return pd.DataFrame(columns=["match_id", "captured_at", "home_odds", "away_odds"])
    ids = fetch_odds.match_events(snaps, fixtures)
    s = snaps.merge(ids, on="event_id")
    s = fetch_odds.turn_round(s, s["flipped"])
    s["captured_at"] = pd.to_datetime(s["captured_at"], utc=True)
    return s.dropna(subset=["home_odds", "away_odds"]).sort_values("captured_at")


def paper_bets(record, snaps, results=None):
    """One row per bet the model would have placed, graded where the game is finished.
    `record`: each game's prediction of record (match_id, created_at, start_time_utc, home_win_prob,
    season, round, home_team, away_team). `snaps`: oriented_snapshots."""
    results = load_matches() if results is None else results
    scores = results.set_index("match_id")[["home_score", "away_score"]]
    rows = []
    for p in record.itertuples():
        kickoff = pd.Timestamp(p.start_time_utc)
        s = snaps[(snaps["match_id"] == p.match_id) & (snaps["captured_at"] < kickoff)]
        at = s[s["captured_at"] <= pd.Timestamp(p.created_at)]
        if at.empty:
            continue  # no price was available when the prediction was made
        price, close = at.iloc[-1], s.iloc[-1]
        sides = {"home": (p.home_win_prob, price["home_odds"], close["home_odds"], p.home_team),
                 "away": (1 - p.home_win_prob, price["away_odds"], close["away_odds"], p.away_team)}
        side, (prob, odds, close_odds, team) = max(sides.items(), key=lambda kv: kv[1][0] * kv[1][1])
        edge = prob * odds - 1
        if edge < MIN_EDGE:
            continue
        hs, as_ = scores["home_score"].get(p.match_id, np.nan), scores["away_score"].get(p.match_id, np.nan)
        done = not (pd.isna(hs) or pd.isna(as_))
        won = (hs > as_ if side == "home" else as_ > hs) if done else None
        rows.append({"match_id": p.match_id, "season": p.season, "round": p.round, "home_team": p.home_team,
                     "away_team": p.away_team, "side": side, "team": team, "prob": prob, "odds": odds, "edge": edge,
                     "placed_at": p.created_at, "price_at": price["captured_at"], "close_odds": close_odds,
                     "home_score": hs, "away_score": as_, "won": won,
                     "profit": (odds - 1 if won else -1.0) if done else None, "clv": odds / close_odds - 1})
    return pd.DataFrame(rows, columns=BET_COLS)


def report(bets, season):
    settled = bets[bets["profit"].notna()]
    lines = [f"# {season} paper trading (head to head)", "",
             f"Flat 1-unit bets at Betr's live price when each prediction of record was made, where the "
             f"model's expected edge was at least {MIN_EDGE:.0%}. A draw loses. Closing line value (CLV) is the "
             "bet's price against the last price before kickoff.", ""]
    if settled.empty:
        return "\n".join(lines + ["No settled bets yet.", ""])
    profit = settled["profit"].astype(float).sum()
    lines += [f"- Bets settled: {len(settled)} (won {int(settled['won'].astype(bool).sum())})",
              f"- Profit: {profit:+.2f} units, ROI {profit / len(settled):+.1%}",
              f"- Average CLV: {settled['clv'].mean():+.1%}; beat the closing price on "
              f"{(settled['clv'] > 0).mean():.0%} of bets",
              f"- Still to play: {int(bets['profit'].isna().sum())}", ""]
    return "\n".join(lines)


def write(records, season, fixtures, snaps, record):
    """Rebuild the season's paper trading files from the records."""
    bets = paper_bets(record, oriented_snapshots(snaps, fixtures))
    bets.to_csv(records.dir / "paper_bets.csv", index=False)
    (records.dir / "paper.md").write_text(report(bets, season), encoding="utf-8")
    return bets
