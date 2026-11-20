"""
The players page's tables (docs/superpowers/specs/2026-11-21-players-page-design.md): each player's
season of stats (player_seasons) and the Model's rating of him (player_ratings), from the processed
tables. publish.py writes them to the database.

- player_seasons: one row per player per season, totals over every game he played in (regular season
  and finals, minutes > 0). His position is the starting position he wore most often that season (the
  most recent start on a tie), or "Interchange" if he only came off the bench; his team is the one he
  played for last.
- player_ratings: features.player_ratings, as of the season's last decided game: the RAPM rating the
  model would give him for his next game, with its attack and defence split.

Usage:
    python pipeline/players.py --season 2026     # print the season's top 10 by rating
"""

import argparse

import pandas as pd

from common import load_matches
from features import NOT_NAMED, player_ratings
from ingest import PROCESSED

POSITIONS = ["Fullback", "Winger", "Centre", "Five-Eighth", "Halfback", "Hooker", "Prop", "2nd Row", "Lock"]

# player_seasons column -> player_match_stats column, summed over the season.
TOTALS = {
    "minutes": "minutesPlayed", "tries": "tries", "points": "points", "goals": "goals", "conversions": "conversions",
    "conversion_attempts": "conversionAttempts", "penalty_goals": "penaltyGoals", "field_goals": "fieldGoals",
    "run_metres": "allRunMetres", "runs": "allRuns", "post_contact_metres": "postContactMetres",
    "line_breaks": "lineBreaks", "line_break_assists": "lineBreakAssists", "try_assists": "tryAssists",
    "tackle_breaks": "tackleBreaks", "offloads": "offloads", "kick_return_metres": "kickReturnMetres",
    "kicks": "kicks", "kick_metres": "kickMetres", "forty_twenty": "fortyTwentyKicks",
    "forced_drop_outs": "forcedDropOutKicks", "bomb_kicks": "bombKicks", "grubber_kicks": "grubberKicks",
    "tackles": "tacklesMade", "missed_tackles": "missedTackles", "ineffective_tackles": "ineffectiveTackles",
    "intercepts": "intercepts", "one_on_one_steals": "oneOnOneSteal",
    "errors": "errors", "penalties": "penalties", "sin_bins": "sinBins", "send_offs": "sendOffs",
    "fantasy_points": "fantasyPointsTotal",
}
SEASON_COLS = ["season", "player_id", "player_name", "team", "position", "games", *TOTALS]
RATING_COLS = ["season", "player_id", "rating", "attack", "defence", "as_of"]


def load_players():
    return pd.read_csv(PROCESSED / "player_match_stats.csv", low_memory=False)


def appearances(players, matches):
    """Every game a player took the field in, with its kickoff (the order positions and teams follow)."""
    p = players[players["minutesPlayed"].fillna(0) > 0]
    kick = pd.to_datetime(matches.set_index("match_id")["start_time_utc"], utc=True)
    return p.assign(kickoff=p["match_id"].map(kick)).sort_values(["kickoff", "match_id"])


def season_rows(players, matches, season):
    """player_seasons rows for one season (empty when it has no games yet)."""
    p = appearances(players[players["season"] == season], matches)
    if p.empty:
        return pd.DataFrame(columns=SEASON_COLS)
    g = p.groupby("player_id", sort=False)
    out = g[list(TOTALS.values())].sum().rename(columns={v: k for k, v in TOTALS.items()})
    out["games"] = g.size()
    last = g.tail(1).set_index("player_id")
    out["player_name"] = last["player_name"]
    out["team"] = last["team"]
    starts = p[p["position"].isin(POSITIONS)]
    # Most starts at a position, the latest start breaking a tie.
    tally = starts.assign(n=1, at=range(len(starts))).groupby(["player_id", "position"]).agg(n=("n", "sum"), at=("at", "max"))
    main = tally.reset_index().sort_values(["n", "at"]).groupby("player_id").tail(1).set_index("player_id")["position"]
    out["position"] = main.reindex(out.index).fillna("Interchange")
    out["season"] = season
    out = out.reset_index()
    ints = [c for c in TOTALS if c != "fantasy_points"]
    out[ints] = out[ints].fillna(0).astype(int)
    return out[SEASON_COLS]


def rating_rows(players, matches, season):
    """player_ratings rows for everyone who played that season, as of its last decided game."""
    m = matches.copy()
    m["start_time_utc"] = pd.to_datetime(m["start_time_utc"], utc=True)
    m = m[m["home_score"].notna() & m["away_score"].notna() & (m["season"] <= season)]
    played = set(appearances(players[players["season"] == season], matches)["player_id"])
    if not played:
        return pd.DataFrame(columns=RATING_COLS)
    last = m.loc[m["season"] == season, "start_time_utc"].max()
    as_of = last + pd.Timedelta(seconds=1)  # include the season's last game
    p = players[players["match_id"].isin(m["match_id"])]
    r = player_ratings(m, p, as_of)
    r = r[r["player_id"].isin(played)].copy()
    r["season"], r["as_of"] = season, last.date()
    return r[RATING_COLS].reset_index(drop=True)


def tables(season, players=None, matches=None):
    """Both tables' rows for a season, as publish.py writes them."""
    players = load_players() if players is None else players
    matches = load_matches() if matches is None else matches
    players = players[~players["position"].isin(NOT_NAMED) | (players["minutesPlayed"].fillna(0) > 0)]
    return {"player_seasons": season_rows(players, matches, season),
            "player_ratings": rating_rows(players, matches, season)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", type=int, required=True)
    args = parser.parse_args()
    t = tables(args.season)
    top = t["player_ratings"].merge(t["player_seasons"], on=["season", "player_id"]).nlargest(10, "rating")
    print(top[["player_name", "team", "position", "games", "rating", "attack", "defence"]].to_string(index=False))


if __name__ == "__main__":
    main()
