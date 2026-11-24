"""
The players page's tables (docs/superpowers/specs/2026-11-21-players-page-design.md): each player's
season of stats (player_seasons) and the Model's rating of him (player_ratings), from the processed
tables. publish.py writes them to the database.

- player_seasons: one row per player per season, totals over every game he played in (regular season
  and finals, minutes > 0). His position is the starting position he wore most often that season (the
  most recent start on a tie), or "Interchange" if he only came off the bench; his team is the one he
  played for last. fantasy_rating is the players page's ranking: his NRL fantasy points a game over the
  season, pulled FANTASY_PRIOR_GAMES games' worth towards the average at that position, so a player with
  few games can't top the list on one big day. Points a game as fantasy scores them, not adjusted for
  position, so it can seed a fantasy team later.
- player_ratings: features.player_ratings, as of the season's last decided game: the RAPM rating the
  model would give him for his next game, with its attack and defence split. The page shows it as the
  Model's impact, not the ranking: all 17 players take the field together, so plus-minus mostly measures
  the team (about three quarters of the spread in 2026) and can't rank teammates fairly.
- round_players: everyone who took the field in each regular-season round, the community Dally M's
  candidates (a round opens for votes once its players are published).

Usage:
    python pipeline/players.py --season 2026     # print the season's top 10 by fantasy rating
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
SEASON_COLS = ["season", "player_id", "player_name", "team", "position", "games", "head_image", *TOTALS, "fantasy_rating"]
FANTASY_PRIOR_GAMES = 4  # fantasy_rating's pull towards the position average, in games
RATING_COLS = ["season", "player_id", "rating", "attack", "defence", "as_of"]
ROUND_PLAYER_COLS = ["season", "round", "player_id", "match_id", "player_name", "team", "position", "head_image"]


def load_players():
    return pd.read_csv(PROCESSED / "player_match_stats.csv", low_memory=False)


# nrl.com serves a headshot only at a requested size (without one the link is a 404): 2x a 56px circle.
IMAGE_SIZE = "&width=112&height=112&mode=crop"


def load_images():
    """Headshot links per player and season (scrape.write_player_images); empty before the first scrape."""
    path = PROCESSED / "player_images.csv"
    return pd.read_csv(path) if path.exists() else pd.DataFrame(columns=["season", "player_id", "head_image"])


def image_for(images, season):
    """Each player's headshot link for a season: that season's, else his nearest season's (a photo a year
    out is better than none), as a full nrl.com address at the page's size. Links only, never images.
    Only nrl.com's own paths count: a few headImage links point at a club's site, which refuses them (and
    nrl.com's image proxy won't fetch them), so they are treated as no photo."""
    images = images[images["head_image"].astype(str).str.startswith("/")]
    if images.empty:
        return pd.Series(dtype=object)
    i = images.assign(dist=(images["season"] - season).abs(), later=images["season"] > season)
    best = i.sort_values(["dist", "later"]).groupby("player_id").first()["head_image"]
    return "https://www.nrl.com" + best + IMAGE_SIZE


def appearances(players, matches):
    """Every game a player took the field in, with its kickoff (the order positions and teams follow)."""
    p = players[players["minutesPlayed"].fillna(0) > 0]
    kick = pd.to_datetime(matches.set_index("match_id")["start_time_utc"], utc=True)
    return p.assign(kickoff=p["match_id"].map(kick)).sort_values(["kickoff", "match_id"])


def season_rows(players, matches, season, images=None):
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
    out["head_image"] = image_for(load_images() if images is None else images, season).reindex(out.index)
    out["season"] = season
    out = out.reset_index()
    ints = [c for c in TOTALS if c != "fantasy_points"]
    out[ints] = out[ints].fillna(0).astype(int)
    out["fantasy_rating"] = fantasy_rating(out)
    return out[SEASON_COLS]


def fantasy_rating(seasons):
    """Fantasy points a game over the season, shrunk towards the position's average (every game played
    at that position this season) by FANTASY_PRIOR_GAMES games: (points + k * average) / (games + k)."""
    by_pos = seasons.groupby("position")[["fantasy_points", "games"]].transform("sum")
    pos_avg = by_pos["fantasy_points"] / by_pos["games"]
    k = FANTASY_PRIOR_GAMES
    return (seasons["fantasy_points"] + k * pos_avg) / (seasons["games"] + k)


def round_rows(players, matches, season, images=None):
    """round_players rows: everyone who took the field in each regular-season round so far, the
    community Dally M's candidates (docs/superpowers/specs/2026-11-21-dally-m-design.md)."""
    p = appearances(players[players["season"] == season], matches)
    m = matches.set_index("match_id")
    final = m["is_final"].map(lambda v: str(v).strip().lower() == "true") if "is_final" in m else False
    p = p.assign(round=p["match_id"].map(m["round"]), final=p["match_id"].map(final))
    p = p[p["round"].notna() & ~p["final"].fillna(False).astype(bool)]
    if p.empty:
        return pd.DataFrame(columns=ROUND_PLAYER_COLS)
    out = p.drop_duplicates(["round", "player_id"], keep="last").copy()  # two games in a round: the later
    out["round"] = out["round"].astype(int)
    out["position"] = out["position"].where(out["position"].isin(POSITIONS), "Interchange")
    out["head_image"] = out["player_id"].map(image_for(load_images() if images is None else images, season))
    out["season"] = season
    return out[ROUND_PLAYER_COLS].reset_index(drop=True)


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
            "player_ratings": rating_rows(players, matches, season),
            "round_players": round_rows(players, matches, season)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", type=int, required=True)
    args = parser.parse_args()
    t = tables(args.season)
    top = t["player_seasons"].merge(t["player_ratings"], on=["season", "player_id"], how="left").nlargest(10, "fantasy_rating")
    print(top[["player_name", "team", "position", "games", "fantasy_rating", "rating"]].to_string(index=False))


if __name__ == "__main__":
    main()
