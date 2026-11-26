"""Builds web/lib/sample-elo.ts for the Elo page (/elo).

Run from the repo root:  python web/scripts/build_elo_sample.py

Real data only: the project's Elo engine (src/elo.py) with its tuned settings
(data/processed/elo_params.json) over every result in the odds sheet since 2009.
The 2026 season stops at the sample's current results (games before Round 10).
"""

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
from elo import load_params, run_elo  # noqa: E402
from ingest import join_odds_to_matches, load_odds  # noqa: E402

OUT = ROOT / "web" / "lib" / "sample-elo.ts"
CURRENT_SEASON, CURRENT_ROUND = 2026, 10  # the sample's current round: its results aren't in yet
TEAM_VIEW_SEASONS = 6
SWINGS = 3  # biggest rises and falls labelled per team view

odds = load_odds()
params = load_params(odds)
pre = run_elo(odds, **params)

# Round numbers: nrl.com's for seasons the scraper covers, otherwise weeks from the season's start.
matches = pd.read_csv(ROOT / "data/processed/matches.csv")
joined = join_odds_to_matches(matches, odds).dropna(subset=["odds_id"])
round_of = {int(r.odds_id): (int(r["round"]), r.round_title) for _, r in joined.iterrows()}


def week_rounds(season_games):
    start = season_games["date"].min()
    start = start - pd.Timedelta(days=(start.weekday() - 1) % 7)  # rounds run Tuesday to Monday
    return ((season_games["date"] - start).dt.days // 7 + 1).astype(int)


odds["round_no"] = np.nan
odds["round_label"] = ""
for season, g in odds.groupby("season"):
    weeks = week_rounds(g)
    for idx, wk in weeks.items():
        oid = int(odds.at[idx, "odds_id"])
        if oid in round_of:
            n, title = round_of[oid]
        else:
            n, title = int(wk), f"Round {int(wk)}"
        if odds.at[idx, "is_final"]:
            title = "Finals"
        odds.at[idx, "round_no"] = n
        odds.at[idx, "round_label"] = title


def update(rh, ra, adv, hs, as_):
    """One game's rating change, exactly as src/elo.run_elo applies it."""
    p = 1 / (1 + 10 ** ((ra - rh - adv) / 400))
    margin = hs - as_
    actual = 1.0 if margin > 0 else 0.0 if margin < 0 else 0.5
    mult = 1.0
    if params["mov"] and margin != 0:
        winner_diff = (rh + adv - ra) if margin > 0 else (ra - rh - adv)
        mult = math.log(abs(margin) + 1) * 2.2 / (winner_diff * 0.001 + 2.2)
    return params["k"] * mult * (actual - p)


# Walk every game, keeping each team's rating after each game.
ratings, season_of = {}, None
games = []
for i, g in odds.iterrows():
    if g.season != season_of:
        ratings = {t: r + params["regress"] * (1500 - r) for t, r in ratings.items()}
        season_of = g.season
    rh, ra = ratings.get(g.home_team, 1500.0), ratings.get(g.away_team, 1500.0)
    assert abs(rh - pre.at[i, "elo_home"]) < 1e-6 and abs(ra - pre.at[i, "elo_away"]) < 1e-6, "drifted from src/elo.py"
    if pd.isna(g.home_score):
        continue
    adv = params["neutral_hfa"] if g.neutral else params["hfa"]
    p_home = 1 / (1 + 10 ** ((ra - rh - adv) / 400))  # the home team's chance going in, as src/elo.py has it
    d = update(rh, ra, adv, g.home_score, g.away_score)
    ratings[g.home_team], ratings[g.away_team] = rh + d, ra - d
    games.append({
        "season": int(g.season), "round": int(g.round_no), "label": g.round_label, "final": bool(g.is_final),
        "date": g.date.strftime("%Y-%m-%d"), "home": g.home_team, "away": g.away_team,
        "hs": int(g.home_score), "as": int(g.away_score), "pre_h": rh, "pre_a": ra, "delta": d, "p_h": p_home,
    })

games = pd.DataFrame(games)
games = games[~((games.season == CURRENT_SEASON) & (games["round"] >= CURRENT_ROUND) | (games.season > CURRENT_SEASON))]


# ---------- Per season: each team's results, points, expected wins and last five ----------
CLOSE = 6  # a close game is decided by this many points or fewer


def record(season_games, t):
    """A team's season, the same sums web/lib/data.ts makes from the elo_ratings table."""
    rows = []
    for _, x in season_games[(season_games.home == t) | (season_games.away == t)].sort_values("date").iterrows():
        home = x.home == t
        us, them = (x.hs, x["as"]) if home else (x["as"], x.hs)
        rows.append({"us": int(us), "them": int(them), "p": x.p_h if home else 1 - x.p_h,
                     "change": x.delta if home else -x.delta, "label": x.label, "opp": x.away if home else x.home})
    close = [r for r in rows if abs(r["us"] - r["them"]) <= CLOSE]
    # Packed as a tuple to keep the sample small; sample-elo.ts unpacks it into an EloRecord.
    short = lambda label: "F" if label == "Finals" else "R" + label.removeprefix("Round ")
    return [
        sum(r["us"] > r["them"] for r in rows), sum(r["us"] < r["them"] for r in rows),
        sum(r["us"] == r["them"] for r in rows), sum(r["us"] for r in rows), sum(r["them"] for r in rows),
        round(sum(r["p"] for r in rows), 2),
        sum(r["us"] > r["them"] for r in close), sum(r["us"] < r["them"] for r in close),
        [[short(r["label"]), r["opp"], r["us"], r["them"], round(r["change"], 1)] for r in rows[-5:]],
    ]


# ---------- Per season: each team's rating after every round ----------
seasons = []
for season, g in games.groupby("season"):
    g = g.sort_values("date")
    # Rounds in order; finals collapse into one point each week.
    steps = g[["round", "label", "final"]].drop_duplicates(subset=["round"]).sort_values("round")
    labels = [("F" if r.final else f"R{r['round']}") for _, r in steps.iterrows()]
    teams = sorted(set(g.home) | set(g.away))
    start = {}
    for t in teams:
        first = g[(g.home == t) | (g.away == t)].iloc[0]
        start[t] = first.pre_h if first.home == t else first.pre_a
    series = {}
    for t in teams:
        r, out = start[t], []
        for rnd in steps["round"]:
            for _, x in g[(g["round"] == rnd) & ((g.home == t) | (g.away == t))].iterrows():
                r = x.pre_h + x.delta if x.home == t else x.pre_a - x.delta
            out.append(round(r, 1))
        series[t] = out
    seasons.append({
        "season": int(season), "rounds": labels,
        "lastRound": labels[-1],
        "start": {t: round(v, 1) for t, v in start.items()},
        "ratings": series,
        "records": {t: record(g, t) for t in teams},
    })


# ---------- Team view: recent seasons game by game, with the biggest swings ----------
team_view = {}
recent = games[games.season > games.season.max() - TEAM_VIEW_SEASONS]
for t in sorted(set(games.home) | set(games.away)):
    g = recent[(recent.home == t) | (recent.away == t)].sort_values("date")
    points = []
    for _, x in g.iterrows():
        home = x.home == t
        after = x.pre_h + x.delta if home else x.pre_a - x.delta
        change = x.delta if home else -x.delta
        us, them = (x.hs, x["as"]) if home else (x["as"], x.hs)
        opp = x.away if home else x.home
        result = "Beat" if us > them else "Lost to" if us < them else "Drew with"
        points.append({
            "season": int(x.season), "label": x.label, "date": x.date, "rating": round(after, 1), "change": round(change, 1),
            "text": f"{result} {opp} {us}–{them}",
        })
    order = sorted(range(len(points)), key=lambda i: points[i]["change"])
    swings = sorted(set(order[:SWINGS] + order[-SWINGS:]))
    team_view[t] = {"points": points, "swings": swings}

hfa = params["hfa"]
js = lambda x: json.dumps(x, ensure_ascii=False, separators=(",", ":"))
OUT.write_text(f"""// GENERATED by web/scripts/build_elo_sample.py. Do not edit by hand.
// Real data only: src/elo.py with data/processed/elo_params.json over every result in the
// odds sheet since 2009; 2026 stops at the sample's current results (before Round {CURRENT_ROUND}).

import type {{ EloRecord, EloSeason, EloTeamView }} from "./types";

export const ELO_PARAMS = {js(params)} as const;

// A season record packed as [won, lost, drawn, scored, conceded, expectedWins, closeWon, closeLost, form],
// each form game as [round ("R7", or "F" for a final), opponent, scored, conceded, change].
type Packed = [number, number, number, number, number, number, number, number, [string, string, number, number, number][]];
const unpack = ([won, lost, drawn, scored, conceded, expectedWins, closeWon, closeLost, form]: Packed): EloRecord => ({{
  won, lost, drawn, scored, conceded, expectedWins, closeWon, closeLost,
  form: form.map(([r, opponent, scored, conceded, change]) => ({{
    label: r === "F" ? "Finals" : `Round ${{r.slice(1)}}`, opponent, scored, conceded, change,
  }})),
}});

// Parsed from strings: as object literals this much data takes TypeScript minutes to check.
export const ELO_SEASONS: EloSeason[] = (JSON.parse({json.dumps(js(seasons))}) as (Omit<EloSeason, "records"> & {{
  records: Record<string, Packed>;
}})[]).map((s) => ({{ ...s, records: Object.fromEntries(Object.entries(s.records).map(([t, r]) => [t, unpack(r)])) }}));

/** Each team's last {TEAM_VIEW_SEASONS} seasons game by game; swings index its biggest rises and falls. */
export const ELO_TEAMS: Record<string, EloTeamView> = JSON.parse({json.dumps(js(team_view))});
""", encoding="utf-8")
last = seasons[-1]
top = sorted(last["ratings"].items(), key=lambda kv: -kv[1][-1])[:3]
print(f"wrote {OUT.relative_to(ROOT)}: {len(seasons)} seasons, {len(team_view)} teams; "
      f"{last['season']} after {last['lastRound']}: " + ", ".join(f"{t} {v[-1]:.0f}" for t, v in top))
