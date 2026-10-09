"""Builds web/lib/sample-archive.ts from the real 2026 replays, so the round and
match pages have honest sample data until the pipeline publishes to Supabase.

Run from the repo root:  python web/scripts/build_sample.py

Real: matches, results, predictions (with and without odds), the bookies'
opening price, Elo, Tuesday team lists, the 17 who played, head to head.
Invented (and labelled as sample on the site): friends' tips and margins.
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
CURRENT_ROUND = 10  # the sample round in lib/sample.ts

# Tippers from lib/sample.ts and how often each goes against the Model.
TIPPERS = {"mick": 0.15, "dazza": 0.22, "sully": 0.2, "jacko": 0.3, "tom": 0.35}
# How often each forgets to tip a game, so auto-tips get exercised (not in rounds with their own page).
FORGETS = {"jacko": 0.04, "tom": 0.08}


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

    order = sorted(round_matches, key=lambda x: x["kickoff"])
    rounds.append({
        "data": {"season": SEASON, "round": rnd, "featuredMatchId": order[0]["id"],
                 "matches": round_matches, "predictions": round_preds},
    })


def invent_tips(rnd, games):
    """Each tipper goes against the Model on some games; margins for the featured (first) game."""
    tips, margins = [], []
    for tipper, rate in [("model", 0.0), *TIPPERS.items()]:
        rng = random.Random(f"{tipper}-{rnd}")
        forget = random.Random(f"forget-{tipper}-{rnd}")
        for i, g in enumerate(games):
            model_tip = g["home"] if g["modelHomeProb"] >= 0.5 else g["away"]
            other = g["away"] if model_tip == g["home"] else g["home"]
            team = other if rng.random() < rate else model_tip
            if i > 0 and rnd not in ROUNDS and forget.random() < FORGETS.get(tipper, 0):
                continue
            tips.append({"tipperId": tipper, "matchId": g["matchId"], "team": team})
        first = games[0]
        team = next(t["team"] for t in tips if t["tipperId"] == tipper and t["matchId"] == first["matchId"])
        margin = max(1, round(abs(first["modelMargin"]))) if tipper == "model" else rng.randint(2, 20)
        margins.append({"tipperId": tipper, "team": team, "margin": margin})
    return tips, margins


# The sample season before the current round: every game of rounds 1-9 with the Model's real
# test-season prediction (the replay's 7 games for rounds with a replay, so their pages agree).
season_preds = pd.read_csv(ROOT / f"reports/predictions_{SEASON}.csv")
season_preds["match_id"] = season_preds["match_id"].astype(str)
season = []
for rnd in range(1, CURRENT_ROUND):
    archived = next((r for r in rounds if r["data"]["round"] == rnd), None)
    if archived:
        preds = {p["matchId"]: p for p in archived["data"]["predictions"]}
        games = [{"matchId": m["id"], "kickoff": m["kickoff"], "home": m["home"], "away": m["away"],
                  "homeScore": m["homeScore"], "awayScore": m["awayScore"],
                  "modelHomeProb": preds[m["id"]]["homeWinProb"], "modelMargin": preds[m["id"]]["margin"]}
                 for m in archived["data"]["matches"]]
    else:
        ids = matches[(matches.season == SEASON) & (matches["round"] == rnd)].match_id
        games = []
        for _, r in season_preds[season_preds.match_id.isin(ids)].iterrows():
            m = matches[matches.match_id == r.match_id].iloc[0]
            prob, margin = r["with_odds|ensemble|home_win"], r["with_odds|ensemble|margin"]
            games.append({"matchId": r.match_id, "kickoff": m.start_time_utc, "home": m.home_team, "away": m.away_team,
                          "homeScore": int(m.home_score), "awayScore": int(m.away_score),
                          "modelHomeProb": num(prob), "modelMargin": round(float(margin), 2)})
    games.sort(key=lambda g: g["kickoff"])
    tips, margins = invent_tips(rnd, games)
    season.append({"round": rnd, "featuredMatchId": games[0]["matchId"], "games": games, "tips": tips, "margins": margins})
    if archived:
        archived["tips"] = tips

js = lambda x: json.dumps(x, indent=2, ensure_ascii=False)
OUT.write_text(f"""// GENERATED by web/scripts/build_sample.py. Do not edit by hand.
// Real 2026 data: games, results and the Model's test-season predictions for rounds 1-{CURRENT_ROUND - 1},
// plus the replays (rounds {", ".join(map(str, ROUNDS))}) with odds, Elo, team lists and head to head.
// Friends' tips and margins are invented sample data.

import type {{ ArchivedRound, MatchDetail, SeasonRound }} from "./types";

export const ARCHIVE: ArchivedRound[] = {js([r for r in rounds if r["data"]["round"] < CURRENT_ROUND])} as ArchivedRound[];

/** Rounds before the current one, for the ladder. */
export const SEASON_ROUNDS: SeasonRound[] = {js(season)} as SeasonRound[];

export const MATCH_DETAILS: Record<string, MatchDetail> = {js(details)} as Record<string, MatchDetail>;
""", encoding="utf-8")
print(f"wrote {OUT.relative_to(ROOT)}: {len(season)} season rounds, {len(details)} matches")
