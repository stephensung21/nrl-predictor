"""
Build the leakage-safe, one-row-per-match feature table.

Every feature for a match uses only information from earlier matches, plus things known
before kickoff (the published draw, the final team list, opening odds). Team features are
expressed as home minus away differences.

Usage: python src/features.py   ->  data/processed/features.csv
"""

from pathlib import Path

import numpy as np
import pandas as pd

from elo import load_params, run_elo
from ingest import CITY_STATE, PROCESSED, TEAM_STATE, join_odds_to_matches, load_odds

# Team stats averaged into form features (exponentially weighted, carried across seasons).
FORM_STATS = [
    "points_for", "points_against", "completion_rate", "possession_pct", "all_run_metres",
    "post_contact_metres", "line_breaks", "tackle_breaks", "errors", "penalties_conceded",
    "missed_tackles",
]
FORM_ALPHA = 2 / (6 + 1)  # EWMA span of 6 games
SEASON_SHRINK = 1 / 3     # pull form one-third back to last season's league average

PLAYER_ALPHA = 0.25       # EWMA weight on a player's most recent game
PLAYER_PRIOR_GAMES = 4    # shrinkage strength towards the position-group average
ROOKIE_GAMES = 3
POS_GROUP = {
    "Fullback": "spine", "Five-Eighth": "spine", "Halfback": "spine", "Hooker": "spine",
    "Prop": "forwards", "2nd Row": "forwards", "Lock": "forwards",
    "Winger": "backs", "Centre": "backs",
}  # anything else (Interchange, Replacement, Reserve) -> bench

PLAYER_TEAM_FEATURES = [
    "rating_total", "rating_spine", "rating_forwards", "rating_backs", "rating_bench",
    "spine_vs_usual", "spine_changes", "halfback_changed", "rookies",
]

FEATURE_GROUPS = {
    "elo": ["elo_logit"],
    "form": [f"diff_form_{s}" for s in FORM_STATS],
    "context": ["diff_rest_days", "home_travel", "away_travel", "neutral", "away_at_ground", "is_final"],
    "player": [f"diff_{f}" for f in PLAYER_TEAM_FEATURES],
    "odds": ["open_logit", "open_line", "open_total"],
}

MIN_HISTORY = 5  # both teams need this many earlier games in the scraped data (2021 warm-up)


def logit(p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def team_long(matches, team_stats):
    """One row per team per match, in kickoff order, with rest days and travel."""
    long = team_stats.merge(
        matches[["match_id", "start_time_utc", "venue_city"]], on="match_id", how="left")
    long = long.sort_values(["start_time_utc", "match_id", "is_home"], ascending=[True, True, False])
    # Stats the site leaves out when they are zero.
    long[FORM_STATS] = long[FORM_STATS].fillna(0)

    long["rest_days"] = (long.groupby("team")["start_time_utc"].diff().dt.total_seconds() / 86400).clip(upper=14)
    long["rest_days"] = long["rest_days"].fillna(14)
    venue_state = long["venue_city"].str.split(",").str[0].str.strip().map(CITY_STATE)
    long["travel"] = (venue_state != long["team"].map(TEAM_STATE)).astype(int)
    return long.reset_index(drop=True)


def add_team_form(long):
    """Exponentially weighted pre-match averages of FORM_STATS for each team.

    At each new season the averages are pulled partway back to the previous season's league
    average (known by then). `n_hist` counts the team's earlier games in the scraped data.
    """
    values = long[FORM_STATS].to_numpy(dtype=float)
    season_means = long.groupby("season")[FORM_STATS].mean()
    out = np.full_like(values, np.nan)
    n_hist = np.zeros(len(long), dtype=int)

    for _, idx in long.groupby("team", sort=False).indices.items():
        state, season, n = None, None, 0
        for i in idx:  # indices are in kickoff order
            s = long.at[i, "season"]
            if state is not None and s != season and (s - 1) in season_means.index:
                state = state + SEASON_SHRINK * (season_means.loc[s - 1].to_numpy() - state)
            season = s
            if state is not None:
                out[i] = state
            n_hist[i] = n
            state = values[i] if state is None else FORM_ALPHA * values[i] + (1 - FORM_ALPHA) * state
            n += 1

    form = pd.DataFrame(out, columns=[f"form_{c}" for c in FORM_STATS], index=long.index)
    return pd.concat([long, form], axis=1).assign(n_hist=n_hist)


def player_team_features(matches, players):
    """Rate every player before each match, then aggregate the lineup to team level."""
    p = players[players["minutesPlayed"] > 0].merge(
        matches[["match_id", "start_time_utc"]], on="match_id", how="left")
    p = p.sort_values(["start_time_utc", "match_id", "player_id"]).reset_index(drop=True)
    p["pos_group"] = p["position"].map(POS_GROUP).fillna("bench")
    p["fantasy"] = p["fantasyPointsTotal"].astype(float)

    # Position-group average from strictly earlier kickoffs (the shrinkage target).
    by_time = p.groupby(["pos_group", "start_time_utc"])["fantasy"].agg(["sum", "count"]).reset_index()
    by_time[["cum_sum", "cum_n"]] = by_time.groupby("pos_group")[["sum", "count"]].cumsum()
    by_time[["cum_sum", "cum_n"]] = by_time.groupby("pos_group")[["cum_sum", "cum_n"]].shift(1)
    by_time["prior"] = (by_time["cum_sum"] / by_time["cum_n"]).fillna(40.0)
    p = p.merge(by_time[["pos_group", "start_time_utc", "prior"]], on=["pos_group", "start_time_utc"], how="left")

    # Player's own form from their earlier games only.
    grp = p.groupby("player_id")["fantasy"]
    p["n_prior"] = p.groupby("player_id").cumcount()
    p["ewm"] = grp.transform(lambda s: s.shift(1).ewm(alpha=PLAYER_ALPHA).mean())
    k = PLAYER_PRIOR_GAMES
    p["rating"] = np.where(p["n_prior"] > 0,
                           (p["n_prior"] * p["ewm"] + k * p["prior"]) / (p["n_prior"] + k),
                           p["prior"])

    team = p.pivot_table(index=["match_id", "team"], columns="pos_group", values="rating",
                         aggfunc="sum", fill_value=0)
    team.columns = [f"rating_{c}" for c in team.columns]
    team["rating_total"] = team.sum(axis=1)
    team["rookies"] = p.assign(r=p["n_prior"] < ROOKIE_GAMES).groupby(["match_id", "team"])["r"].sum()
    team["spine_ids"] = p[p["pos_group"] == "spine"].groupby(["match_id", "team"])["player_id"].agg(frozenset)
    team["halfback_id"] = p[p["position"] == "Halfback"].groupby(["match_id", "team"])["player_id"].first()
    team = team.reset_index().merge(matches[["match_id", "start_time_utc"]], on="match_id")
    team = team.sort_values(["start_time_utc", "match_id"]).reset_index(drop=True)

    g = team.groupby("team")
    usual = g["rating_spine"].transform(lambda s: s.shift(1).ewm(alpha=FORM_ALPHA).mean())
    team["spine_vs_usual"] = (team["rating_spine"] - usual).fillna(0)
    prev_spine = g["spine_ids"].shift(1)
    team["spine_changes"] = [
        len(cur - prev) if isinstance(cur, frozenset) and isinstance(prev, frozenset) else 0
        for cur, prev in zip(team["spine_ids"], prev_spine)
    ]
    prev_hb = g["halfback_id"].shift(1)
    team["halfback_changed"] = (prev_hb.notna() & (team["halfback_id"] != prev_hb)).astype(int)
    return team[["match_id", "team"] + PLAYER_TEAM_FEATURES]


def build_features(matches, team_stats, players, odds, elo_params):
    matches = matches.copy()
    matches["start_time_utc"] = pd.to_datetime(matches["start_time_utc"], utc=True)
    team_stats = team_stats.copy()

    # Elo over every result since 2009, pre-match ratings only.
    odds = odds.join(run_elo(odds, **elo_params))
    m = join_odds_to_matches(matches, odds)
    odds_cols = ["odds_id", "elo_prob", "neutral", "home_at_ground", "away_at_ground", "bookmaker",
                 "p_open", "open_line", "open_total", "p_close", "close_ok", "close_line", "close_total",
                 "p_avg", "data_issue"]
    m = m.merge(odds[odds_cols], on="odds_id", how="left")

    long = add_team_form(team_long(m, team_stats))
    side_cols = ["n_hist", "rest_days", "travel"] + [f"form_{s}" for s in FORM_STATS]
    long = long.merge(player_team_features(m, players), on=["match_id", "team"], how="left")
    side_cols += PLAYER_TEAM_FEATURES

    for side, is_home in (("home", True), ("away", False)):
        part = long[long["is_home"] == is_home][["match_id"] + side_cols]
        m = m.merge(part.rename(columns={c: f"{side}_{c}" for c in side_cols}), on="match_id", how="left")

    for c in ["rest_days"] + [f"form_{s}" for s in FORM_STATS] + PLAYER_TEAM_FEATURES:
        m[f"diff_{c}"] = m[f"home_{c}"] - m[f"away_{c}"]
    m["home_travel"] = m["home_travel"].astype(int)
    m["away_travel"] = m["away_travel"].astype(int)
    m["neutral"] = m["neutral"].astype(int)
    m["away_at_ground"] = m["away_at_ground"].astype(int)
    m["is_final"] = m["is_final"].astype(int)
    m["elo_logit"] = logit(m["elo_prob"])
    m["open_logit"] = logit(m["p_open"])

    m["margin"] = m["home_score"] - m["away_score"]
    m["total"] = m["home_score"] + m["away_score"]
    m["home_win"] = (m["margin"] > 0).astype(int)
    m["is_draw"] = m["margin"] == 0
    m["min_hist"] = m[["home_n_hist", "away_n_hist"]].min(axis=1)

    keep = ["match_id", "season", "round", "round_title", "start_time_utc", "home_team", "away_team",
            "venue", "home_score", "away_score", "margin", "total", "home_win", "is_draw", "min_hist",
            "elo_prob", "bookmaker", "p_open", "p_close", "close_ok", "p_avg", "close_line", "close_total",
            "data_issue"]
    feats = [f for group in FEATURE_GROUPS.values() for f in group]
    return m[keep + [f for f in feats if f not in keep]].sort_values("start_time_utc").reset_index(drop=True)


def load_inputs():
    matches = pd.read_csv(PROCESSED / "matches.csv")
    team_stats = pd.read_csv(PROCESSED / "team_match_stats.csv")
    players = pd.read_csv(PROCESSED / "player_match_stats.csv")
    return matches, team_stats, players, load_odds()


if __name__ == "__main__":
    matches, team_stats, players, odds = load_inputs()
    feats = build_features(matches, team_stats, players, odds, elo_params=load_params(odds))
    feats.to_csv(PROCESSED / "features.csv", index=False)
    print(f"wrote features.csv: {feats.shape}")
    usable = feats[(feats["min_hist"] >= MIN_HISTORY) & ~feats["is_draw"]]
    print("usable games per season:", usable.groupby("season").size().to_dict())
    print(usable[[f for g in FEATURE_GROUPS.values() for f in g]].describe().T[["mean", "std", "min", "max"]].round(2))
