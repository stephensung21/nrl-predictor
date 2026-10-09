"""Builds web/lib/sample-archive.ts from the real 2026 replays, so the round and
match pages have honest sample data until the pipeline publishes to Supabase.

Run from the repo root:  python web/scripts/build_sample.py

Real: matches, results, predictions (with and without odds), the bookies'
opening price, Elo, Tuesday team lists, the 17 who played, head to head.
Invented (and labelled as sample on the site): tippers' tips and ladders.
"""

import json
import random
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "lib" / "sample-archive.ts"
ROUNDS = [3, 5, 10]
SEASON = 2026

# Tippers from lib/sample.ts and how often each goes against the Model.
TIPPERS = {"mick": 0.15, "dazza": 0.22, "sully": 0.2, "jacko": 0.3, "tom": 0.35}


def display_scores(p_home, margin, total):
    """Same rule as src/predict.display_scores: scores never contradict the tip."""
    home, away = round((total + margin) / 2), round((total - margin) / 2)
    if p_home >= 0.5 and home <= away:
        home = away + 1
    if p_home < 0.5 and away <= home:
        away = home + 1
    return int(home), int(away)


def num(x):
    return None if pd.isna(x) else round(float(x), 4)


matches = pd.read_csv(ROOT / "data/processed/matches.csv")
matches["match_id"] = matches["match_id"].astype(str)
features = pd.read_csv(ROOT / "data/processed/features.csv", usecols=["match_id", "elo_prob"])
features["match_id"] = features["match_id"].astype(str)
elo = dict(zip(features.match_id, features.elo_prob))
lists = pd.read_csv(ROOT / "data/processed/pre_kickoff_teamlists.csv")
lists["match_id"] = lists["match_id"].astype(str)
played = pd.read_csv(ROOT / "data/processed/player_match_stats.csv",
                     usecols=["match_id", "team", "player_name", "jersey_number", "position", "minutesPlayed"])
played["match_id"] = played["match_id"].astype(str)
# Unused reserves are listed with 0 minutes; a reserve who came on (e.g. for a concussion) counts.
played = played[(played.position != "Reserve") | (played.minutesPlayed > 0)]

rounds, details = [], {}
for rnd in ROUNDS:
    pred = pd.read_csv(ROOT / f"reports/predictions/{SEASON}_round{rnd}_replay.csv")
    pred["match_id"] = pred["match_id"].astype(str)
    round_matches, round_preds = [], []
    for _, p in pred.iterrows():
        m = matches[matches.match_id == p.match_id].iloc[0]
        mid = p.match_id
        round_matches.append({
            "id": mid, "season": SEASON, "round": rnd, "kickoff": m.start_time_utc,
            "home": m.home_team, "away": m.away_team, "venue": m.venue, "city": m.venue_city,
            "homeScore": int(m.home_score), "awayScore": int(m.away_score),
        })
        hp, ap = display_scores(p.home_win_prob, p.margin, p.total)
        round_preds.append({
            "matchId": mid, "homeWinProb": num(p.home_win_prob), "margin": round(float(p.margin), 2),
            "total": round(float(p.total), 2), "homePred": hp, "awayPred": ap,
            "model": p.model, "modelVersion": "2026.1",
        })

        # Team lists: Tuesday's 1-17 against the 17 who played.
        teams = {}
        for side, team in (("home", m.home_team), ("away", m.away_team)):
            tue = lists[(lists.match_id == mid) & (lists.team == team) & (lists.jersey_number <= 17)]
            tue_names = set(tue.player_name)
            game = played[(played.match_id == mid) & (played.team == team)].sort_values("jersey_number")
            if game.empty:
                game = tue.sort_values("jersey_number")
            players = [{"n": int(r.jersey_number), "name": r.player_name, "position": r.position,
                        **({"isIn": True} if r.player_name not in tue_names else {})}
                       for r in game.itertuples()]
            outs = sorted(tue_names - set(game.player_name))
            tuesday = [{"n": int(r.jersey_number), "name": r.player_name, "position": r.position}
                       for r in tue.sort_values("jersey_number").itertuples()]
            teams[side] = {"tuesday": tuesday, "players": players, "out": outs}

        # Last five meetings before this game.
        kick = m.start_time_utc
        h2h = matches[(((matches.home_team == m.home_team) & (matches.away_team == m.away_team))
                       | ((matches.home_team == m.away_team) & (matches.away_team == m.home_team)))
                      & (matches.start_time_utc < kick) & matches.home_score.notna()]
        h2h = h2h.sort_values("start_time_utc").tail(5).iloc[::-1]
        details[mid] = {
            "matchId": mid,
            "noOddsHomeProb": num(p.no_odds_home_win_prob),
            "marketHomeProb": num(p.market_open_home_prob),
            "eloHomeProb": num(elo.get(mid)),
            "lists": teams,
            "headToHead": [{
                "matchId": r.match_id, "season": int(r.season), "roundTitle": r.round_title,
                "home": r.home_team, "away": r.away_team, "venue": r.venue,
                "homeScore": int(r.home_score), "awayScore": int(r.away_score),
            } for r in h2h.itertuples()],
        }

    # Invented tips: each tipper goes against the Model on some games.
    tips = []
    order = sorted(round_matches, key=lambda x: x["kickoff"])
    for tipper, rate in [("model", 0.0), *TIPPERS.items()]:
        rng = random.Random(f"{tipper}-{rnd}")
        for m in order:
            p = next(x for x in round_preds if x["matchId"] == m["id"])
            model_tip = m["home"] if p["homeWinProb"] >= 0.5 else m["away"]
            other = m["away"] if model_tip == m["home"] else m["home"]
            tips.append({"tipperId": tipper, "matchId": m["id"], "team": other if rng.random() < rate else model_tip})
    rng = random.Random(f"ladder-{rnd}")
    ladder = [{"tipperId": t, "points": int((rnd - 1) * 4.6 + rng.randint(-3, 3)), "marginScore": rng.randint(5, 12) * (rnd - 1)}
              for t in ["model", *TIPPERS]]
    rounds.append({
        "data": {"season": SEASON, "round": rnd, "featuredMatchId": order[0]["id"],
                 "matches": round_matches, "predictions": round_preds},
        "tips": tips, "ladderBefore": ladder,
    })

js = lambda x: json.dumps(x, indent=2, ensure_ascii=False)
OUT.write_text(f"""// GENERATED by web/scripts/build_sample.py. Do not edit by hand.
// Real 2026 replays (rounds {", ".join(map(str, ROUNDS))}): results, predictions, odds, Elo,
// team lists and head to head. Tips and ladders are invented sample data.

import type {{ ArchivedRound, MatchDetail }} from "./types";

export const ARCHIVE: ArchivedRound[] = {js(rounds)} as ArchivedRound[];

export const MATCH_DETAILS: Record<string, MatchDetail> = {js(details)} as Record<string, MatchDetail>;
""", encoding="utf-8")
print(f"wrote {OUT.relative_to(ROOT)}: {len(rounds)} rounds, {len(details)} matches")
