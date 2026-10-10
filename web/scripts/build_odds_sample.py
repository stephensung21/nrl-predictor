"""Builds web/lib/sample-odds.ts for the Model vs market page (/odds).

Run from the repo root:  python web/scripts/build_odds_sample.py
(after build_sample.py, whose sample rounds it follows).

All real 2026 data, nothing invented:
- Round tab: for each sample game, the no-odds Model's win chance, margin and total against
  the bookies' opening and closing price, line and total (data/nrl_betting odds.xlsx, via
  src/ingest.py: margin removed proportionally).
- Season tab: every game of the 2026 test season (reports/predictions_2026.csv): the
  no-odds Model, the opening market and Elo, plus the head-to-head bets the 2026 betting
  simulation makes at 2% minimum edge, flat 1 unit at the opening price (betting_2026.md).
"""

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
from ingest import join_odds_to_matches, load_odds  # noqa: E402

OUT = ROOT / "web" / "lib" / "sample-odds.ts"
SEASON = 2026
CURRENT_ROUND = 10
REPLAY_ROUNDS = [3, 5, 10]  # their pages use the replay's numbers, so this page does too
MIN_EDGE = 0.02


def num(x, digits=4):
    return None if pd.isna(x) else round(float(x), digits)


matches = pd.read_csv(ROOT / "data/processed/matches.csv")
matches["match_id"] = matches["match_id"].astype(str)
odds = load_odds()
joined = join_odds_to_matches(matches[matches.season == SEASON], odds)
joined["match_id"] = joined["match_id"].astype(str)
odds_by_match = joined.dropna(subset=["odds_id"]).merge(odds, on="odds_id", suffixes=("", "_o")).set_index("match_id")

preds = pd.read_csv(ROOT / f"reports/predictions_{SEASON}.csv")
preds["match_id"] = preds["match_id"].astype(str)
preds = preds.merge(matches[["match_id", "round", "start_time_utc"]], on="match_id", how="left")

# ---------- Round tab: the sample rounds ----------
rounds = []
for rnd in range(1, CURRENT_ROUND + 1):
    if rnd in REPLAY_ROUNDS:
        rp = pd.read_csv(ROOT / f"reports/predictions/{SEASON}_round{rnd}_replay.csv")
        rp["match_id"] = rp["match_id"].astype(str)
        model = {r.match_id: (r.no_odds_home_win_prob, None, None) for r in rp.itertuples()}
        ids = list(rp.match_id)
    else:
        rows = preds[preds["round"] == rnd]
        model = {r["match_id"]: (r["no_odds|ensemble|home_win"], r["no_odds|ensemble|margin"], r["no_odds|ensemble|total"])
                 for _, r in rows.iterrows()}
        ids = list(rows.match_id)
    # Margins and totals for the replay rounds come from the full test-season run (same no-odds model).
    full = preds.set_index("match_id")
    games = []
    for mid in ids:
        m = matches[matches.match_id == mid].iloc[0]
        o = odds_by_match.loc[mid] if mid in odds_by_match.index else None
        prob, margin, total = model[mid]
        if margin is None and mid in full.index:
            margin, total = full.loc[mid, "no_odds|ensemble|margin"], full.loc[mid, "no_odds|ensemble|total"]
        games.append({
            "matchId": mid, "kickoff": m.start_time_utc, "home": m.home_team, "away": m.away_team, "venue": m.venue,
            "homeScore": int(m.home_score), "awayScore": int(m.away_score),
            "modelHomeProb": num(prob), "modelMargin": num(margin, 2), "modelTotal": num(total, 2),
            "openHomeProb": num(o["p_open"]) if o is not None else None,
            "closeHomeProb": num(o["p_close"]) if o is not None and bool(o["close_ok"]) else None,
            "openLine": num(o["open_line"], 1) if o is not None else None,
            "closeLine": num(o["close_line"], 1) if o is not None else None,
            "openTotal": num(o["open_total"], 1) if o is not None else None,
            "closeTotal": num(o["close_total"], 1) if o is not None else None,
            "bookmaker": o["bookmaker"] if o is not None else None,
        })
    games.sort(key=lambda g: g["kickoff"])
    rounds.append({"round": rnd, "games": games})

# ---------- Season tab: the whole 2026 test season ----------
season = []
bets = []
for _, r in preds.sort_values("start_time_utc").iterrows():
    mid = r["match_id"]
    p = r["no_odds|ensemble|home_win"]
    season.append({
        "matchId": mid, "round": r["round_title"], "kickoff": r["start_time_utc"],
        "home": r["home_team"], "away": r["away_team"], "homeWin": None if pd.isna(r["home_win"]) else float(r["home_win"]),
        "model": num(p), "market": num(r["p_open"]), "elo": num(r["elo_prob"]),
    })
    # The betting simulation: back whichever side has at least a 2% edge at the opening price; draws excluded.
    if mid not in odds_by_match.index or r["home_score"] == r["away_score"]:
        continue
    o = odds_by_match.loc[mid]
    for side, prob, price in (("home", p, o["home_odds_open"]), ("away", 1 - p, o["away_odds_open"])):
        if pd.isna(price) or prob * price - 1 <= MIN_EDGE:
            continue
        won = (r["home_score"] > r["away_score"]) == (side == "home")
        bets.append({"matchId": mid, "side": side, "odds": float(price), "won": bool(won),
                     "profit": round(float(price) - 1, 2) if won else -1.0})

profit = sum(b["profit"] for b in bets)
print(f"season: {len(season)} games; bets: {len(bets)}, profit {profit:.2f} units "
      "(betting_2026.md, no-odds ensemble, head to head, 2%: 122 bets, 24.05 units)")

js = lambda x: json.dumps(x, indent=2, ensure_ascii=False)
OUT.write_text(f"""// GENERATED by web/scripts/build_odds_sample.py. Do not edit by hand.
// Real 2026 data only: the no-odds Model, the bookies' prices (aussportsbetting.com odds sheet,
// margin removed) and Elo. Nothing here is invented.

import type {{ OddsRound, SeasonBet, SeasonGame }} from "./types";

export const ODDS_ROUNDS: OddsRound[] = {js(rounds)} as OddsRound[];

/** Every game of the 2026 test season, for the season scoreboard. */
export const SEASON_GAMES: SeasonGame[] = {js(season)} as SeasonGame[];

/** Head-to-head bets at a 2% minimum edge, 1 unit at the opening price (reports/betting_2026.md). */
export const SEASON_BETS: SeasonBet[] = {js(bets)} as SeasonBet[];
""", encoding="utf-8")
print(f"wrote {OUT.relative_to(ROOT)}")
