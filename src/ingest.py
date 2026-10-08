"""
Load and clean the aussportsbetting.com odds sheet and join it to the scraped nrl.com matches.

The odds sheet is the master list of results back to 2009 (used for Elo); the scraped
matches (2021+) carry the detailed stats. Only opening odds are ever used as features;
closing / Odds Portal average are benchmarks, and Min/Max are dropped entirely.
"""

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ODDS_FILE = ROOT / "data" / "nrl_betting odds.xlsx"
PROCESSED = ROOT / "data" / "processed"

TEAM_MAP = {
    "Brisbane Broncos": "Broncos",
    "Canberra Raiders": "Raiders",
    "Canterbury Bulldogs": "Bulldogs",
    "Canterbury-Bankstown Bulldogs": "Bulldogs",
    "Cronulla Sharks": "Sharks",
    "Cronulla-Sutherland Sharks": "Sharks",
    "Dolphins": "Dolphins",
    "Gold Coast Titans": "Titans",
    "Manly Sea Eagles": "Sea Eagles",
    "Manly-Warringah Sea Eagles": "Sea Eagles",
    "Melbourne Storm": "Storm",
    "New Zealand Warriors": "Warriors",
    "Newcastle Knights": "Knights",
    "North QLD Cowboys": "Cowboys",
    "North Queensland Cowboys": "Cowboys",
    "Parramatta Eels": "Eels",
    "Penrith Panthers": "Panthers",
    "South Sydney Rabbitohs": "Rabbitohs",
    "St George Dragons": "Dragons",
    "St. George Illawarra Dragons": "Dragons",
    "Sydney Roosters": "Roosters",
    "Wests Tigers": "Wests Tigers",
}

TEAM_STATE = {
    "Broncos": "QLD", "Cowboys": "QLD", "Titans": "QLD", "Dolphins": "QLD",
    "Storm": "VIC", "Warriors": "NZ", "Raiders": "ACT",
    "Bulldogs": "NSW", "Sharks": "NSW", "Sea Eagles": "NSW", "Knights": "NSW", "Eels": "NSW",
    "Panthers": "NSW", "Rabbitohs": "NSW", "Dragons": "NSW", "Roosters": "NSW", "Wests Tigers": "NSW",
}

CITY_STATE = {
    **{c: "NSW" for c in ["Sydney", "Penrith", "Wollongong", "Gosford", "Newcastle", "Bathurst", "Mudgee",
                          "Coffs Harbour", "Kogarah", "Wagga Wagga", "Tamworth", "Dubbo", "Campbelltown"]},
    **{c: "QLD" for c in ["Brisbane", "Gold Coast", "Townsville", "Redcliffe", "Sunshine Coast", "Mackay",
                          "Rockhampton", "Bundaberg", "Toowoomba", "Cairns"]},
    **{c: "NZ" for c in ["Auckland", "Christchurch", "Wellington", "Napier", "Hamilton"]},
    "Canberra": "ACT", "Melbourne": "VIC", "Perth": "WA", "Darwin": "NT", "Las Vegas": "USA",
}

BOOKMAKER_CHANGES = [("2018-04-02", "Pinnacle"), ("2024-04-28", "bet365")]  # before date -> bookmaker


def two_way_prob(home_odds, away_odds):
    """Implied home-win probability with the bookmaker margin removed (proportional method)."""
    ih, ia = 1 / home_odds, 1 / away_odds
    return ih / (ih + ia)


def load_odds(path=ODDS_FILE):
    raw = pd.read_excel(path, header=1)
    o = pd.DataFrame({
        "date": pd.to_datetime(raw["Date"]),
        "kickoff_local": raw["Kick-off (local)"].astype(str),
        "home_team": raw["Home Team"].map(TEAM_MAP),
        "away_team": raw["Away Team"].map(TEAM_MAP),
        "venue": raw["Venue"],
        "home_score": raw["Home Score"],
        "away_score": raw["Away Score"],
        "is_final": raw["Play Off Game?"].eq("Y"),
        "extra_time": raw["Over Time?"].eq("Y"),
        "notes": raw["Notes"].fillna(""),
    })
    if o[["home_team", "away_team"]].isna().any().any():
        raise ValueError("Unmapped team names in odds sheet")

    o["season"] = o["date"].dt.year
    o["bookmaker"] = "BlueBet"
    for cutoff, name in reversed(BOOKMAKER_CHANGES):
        o.loc[o["date"] < cutoff, "bookmaker"] = name

    # Opening odds: safe as features.
    o["p_open"] = two_way_prob(raw["Home Odds Open"], raw["Away Odds Open"])
    o["open_line"] = raw["Home Line Open"]          # handicap on the home team (negative = favourite)
    o["open_total"] = raw["Total Score Open"]

    # Closing odds and Odds Portal average: benchmarks only.
    o["p_close"] = two_way_prob(raw["Home Odds Close"], raw["Away Odds Close"])
    o["close_line"] = raw["Home Line Close"]
    o["close_total"] = raw["Total Score Close"]
    o["p_avg"] = two_way_prob(raw["Home Odds"], raw["Away Odds"])  # draw outcome removed as well

    o["data_issue"] = o["notes"].str.contains("Data supply issue")
    bad_close = (o["notes"].str.contains("Closing figures aren't reliable")
                 | (raw["Home Odds Close"] < 1.01) | (raw["Away Odds Close"] < 1.01))
    o["close_ok"] = o["p_close"].notna() & ~bad_close

    o = o.sort_values(["date", "kickoff_local"]).reset_index(drop=True)
    o["odds_id"] = np.arange(len(o))
    return add_venue_flags(o)


def add_venue_flags(o, min_games=2):
    """Flag whether each team is playing at one of its own grounds.

    The regular-season draw (fixtures and venues) is published before the season, so a
    venue counts as a team's home ground in a season if the team is drawn to host at least
    `min_games` regular-season games there. No results are used. A home team not at its
    own ground is treated as neutral (Magic Round, Las Vegas, relocated games, grand finals).
    The odds sheet only has venues from 2021; earlier seasons fall back to the Notes column.
    """
    draw = o[~o["is_final"] & o["venue"].notna()]
    counts = draw.groupby(["season", "home_team", "venue"]).size()
    grounds = set(counts[counts >= min_games].index)

    def at_ground(team_col):
        return [(s, t, v) in grounds for s, t, v in zip(o["season"], o[team_col], o["venue"])]

    has_venue = o["venue"].notna()
    o["home_at_ground"] = np.where(has_venue, at_ground("home_team"), True)
    o["away_at_ground"] = np.where(has_venue, at_ground("away_team"), False)
    notes_neutral = o["notes"].str.contains("Neutral venue|Every match this round|Played at", case=False)
    o["neutral"] = ~o["home_at_ground"].astype(bool) | notes_neutral
    return o


def join_odds_to_matches(matches, odds):
    """Attach odds_id to each scraped match: same home/away teams, local date within one day."""
    m = matches.copy()
    m["start_time_utc"] = pd.to_datetime(m["start_time_utc"], utc=True)
    m["local_date"] = m["start_time_utc"].dt.tz_convert("Australia/Sydney").dt.tz_localize(None).dt.normalize()
    cand = m[["match_id", "home_team", "away_team", "local_date"]].merge(
        odds[["odds_id", "home_team", "away_team", "date"]], on=["home_team", "away_team"])
    cand["gap"] = (cand["date"] - cand["local_date"]).abs()
    cand = cand[cand["gap"] <= pd.Timedelta(days=1)].sort_values("gap").drop_duplicates("match_id")
    m = m.merge(cand[["match_id", "odds_id"]], on="match_id", how="left")
    return m.drop(columns="local_date")


if __name__ == "__main__":
    odds = load_odds()
    matches = pd.read_csv(PROCESSED / "matches.csv")
    joined = join_odds_to_matches(matches, odds)
    print(f"odds rows: {len(odds)}, matches joined: {joined['odds_id'].notna().sum()}/{len(joined)}")
    print(joined[joined["odds_id"].isna()][["season", "round_title", "home_team", "away_team", "start_time_utc"]])
    print(odds.groupby("season")[["neutral", "data_issue", "close_ok"]].mean().round(2))
