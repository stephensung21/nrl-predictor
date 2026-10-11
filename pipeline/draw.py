"""
The season's draw: every game with its kickoff and status, which games the next run predicts, and
which venues are neutral (PLAN_WEB.md, notes 2).

Live, the draw comes from nrl.com (`scrape.fetch_fixtures`). In a replay it comes from the scraped
matches, with each game's status worked out from the replay clock, so the same rules can be run
over a finished season.
"""

import secrets

import pandas as pd

from common import load_matches

KICKOFF_TO_FINAL = pd.Timedelta(hours=3)  # replay clock: a game counts as finished 3 hours after kickoff
MODE_STATUS = {"Pre": "scheduled", "Current": "live", "Post": "final"}
COLUMNS = ["match_id", "season", "round", "round_title", "is_final", "start_time_utc", "venue", "venue_city",
           "home_team", "away_team", "status", "url"]


def live_draw(season):
    """Every game in the season's draw on nrl.com. Games not yet scraped have no match id; the
    match centre gives it when the game's team lists are fetched. Empty if nrl.com has no draw for
    the season (not published yet, or the site is down)."""
    import scrape
    rows = []
    for f in scrape.fetch_fixtures(season):
        title = f.get("roundTitle", "")
        rows.append({"season": season, "round": f["roundNumber"], "round_title": title,
                     "is_final": not title.lower().startswith("round"),
                     "start_time_utc": f.get("clock", {}).get("kickOffTimeLong"), "venue": f.get("venue"),
                     "venue_city": f.get("venueCity"), "home_team": f["homeTeam"]["nickName"],
                     "away_team": f["awayTeam"]["nickName"],
                     "status": MODE_STATUS.get(f.get("matchMode"), "scheduled"), "url": f["matchCentreUrl"]})
    draw = pd.DataFrame(rows, columns=[c for c in COLUMNS if c != "match_id"])
    draw["start_time_utc"] = pd.to_datetime(draw["start_time_utc"], utc=True)
    known = load_matches()
    known["path"] = known["url"].str.replace("https://www.nrl.com", "", regex=False)
    draw["match_id"] = draw["url"].map(known.set_index("path")["match_id"])
    return draw[COLUMNS]


def replay_draw(season, as_of):
    """The season's draw as it stood at `as_of`, from the scraped matches: games that kicked off more
    than three hours earlier are final, games under way are live, the rest are scheduled."""
    m = load_matches()
    m = m[m["season"] == season].copy()
    m["start_time_utc"] = pd.to_datetime(m["start_time_utc"], utc=True)
    m["status"] = "scheduled"
    m.loc[m["start_time_utc"] <= as_of, "status"] = "live"
    m.loc[m["start_time_utc"] + KICKOFF_TO_FINAL <= as_of, "status"] = "final"
    return m[COLUMNS].sort_values(["start_time_utc", "match_id"]).reset_index(drop=True)


def games_to_predict(draw, now):
    """The games the next predict or refresh run covers, and the round they belong to.

    The round is the lowest round with a game still to start, among rounds no earlier than the latest
    round already under way. Its unstarted games are predicted, plus any postponed game from an
    earlier round that now kicks off before this round's last game (so a moved game is predicted with
    the round it is played in, once, keyed by match id). A round with byes simply has fewer games.
    """
    upcoming = draw[(draw["status"] == "scheduled") & (draw["start_time_utc"] > now)]
    started = draw.loc[draw["status"] != "scheduled", "round"]
    current = int(started.max()) if len(started) else 0
    candidates = upcoming[upcoming["round"] >= current]
    if candidates.empty:
        return None, upcoming.iloc[0:0]
    rnd = int(candidates["round"].min())
    games = upcoming[upcoming["round"] == rnd]
    postponed = upcoming[(upcoming["round"] < current) & (upcoming["start_time_utc"] <= games["start_time_utc"].max())]
    return rnd, pd.concat([postponed, games]).sort_values("start_time_utc")


def eligible_for_draw(games, previous):
    """The games a round's margin game can be drawn from: those not involving either team in the
    previous round's margin game, or every game if none qualify (PLAN_WEB.md §3.5; the same rule as
    web/lib/rules.ts eligibleForDraw). `previous` is (home, away) or None."""
    banned = set(previous or ())
    ok = games[~games["home_team"].isin(banned) & ~games["away_team"].isin(banned)]
    return ok if len(ok) else games


def draw_featured(games, previous, rng=None):
    """Draw the round's margin game at random from the eligible games. A fresh, unpredictable random
    source unless `rng` (a random.Random, for tests) is given. Returns (match id, eligible games)."""
    eligible = eligible_for_draw(games.sort_values(["start_time_utc", "match_id"]), previous)
    pick = (rng or secrets.SystemRandom()).randrange(len(eligible))
    return int(eligible["match_id"].iloc[pick]), eligible


def neutral_games(draw, min_games=2):
    """Match ids at a neutral venue: the home team isn't drawn to host at least `min_games` regular-season
    games there (Magic Round, Las Vegas, relocated games, grand finals). The same rule as
    `ingest.add_venue_flags`, applied to nrl.com's venue names, so it works before the odds sheet has
    the game."""
    regular = draw[~draw["is_final"].astype(bool) & draw["venue"].notna()]
    hosted = regular.groupby(["home_team", "venue"]).size()
    grounds = set(hosted[hosted >= min_games].index)
    away_from_home = [(h, v) not in grounds for h, v in zip(draw["home_team"], draw["venue"])]
    return set(draw.loc[away_from_home, "match_id"].dropna().astype(int))
