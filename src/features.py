"""
Build the leakage-safe, one-row-per-match feature table.

Every feature for a match uses only information from earlier matches, plus things known
before kickoff (the published draw, the final team list, opening odds). Team features are
expressed as home minus away differences.

Usage:
    python src/features.py                  ->  data/processed/features.csv (the features the models use,
                                                plus the original base features)
    python src/features.py --experimental   ->  also the tested-but-unused features, for rerunning
                                                those experiments (slower: the reserve-grade plus-minus
                                                alone takes over a minute)
"""

import argparse

from collections import Counter, defaultdict, deque
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import sparse
from scipy.linalg import cho_factor, cho_solve

from elo import load_params, run_elo
from ingest import CITY_STATE, PROCESSED, TEAM_STATE, join_odds_to_matches, load_odds

# Team stats averaged into form features (exponentially weighted, carried across seasons).
FORM_STATS = [
    "points_for", "points_against", "completion_rate", "possession_pct", "all_run_metres",
    "post_contact_metres", "line_breaks", "tackle_breaks", "errors", "penalties_conceded",
    "missed_tackles",
]
POINTS = ["points_for", "points_against"]
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

NOT_NAMED = {"Replacement", "Reserve"}  # 18th/19th players: outside the named 17
USUAL_WINDOW, USUAL_MIN = 5, 3          # a "usual" player was named in 3 of the team's last 5 games
RETURNING_GAMES = 10                    # experienced player back after missing the previous game

PLAYER_TEAM_FEATURES = [
    "rating_total", "rating_spine", "rating_forwards", "rating_backs", "rating_bench",
    "spine_vs_usual", "spine_changes", "halfback_changed", "rookies",
    "missing_usual", "missing_usual_rating", "ins_forwards", "ins_backs", "ins_bench",
    "returning", "kicker_changed", "rapm_total", "rapm_vs_usual", "rapm_missing",
    "origin_backup", "origin_out", "rapm_attack", "rapm_defence", "s2_stars_out_spine", "s2_stars_out_other",
]

# Tested but not used by any model (see IMPROVEMENTS.md): only built with --experimental, so the
# default build (and the leakage test, which rebuilds it) stays fast.
EXPERIMENTAL = False
EXPERIMENTAL_TEAM_FEATURES = [
    "reserve_newcomers", "reserve_rapm_newcomers", "origin_reps", "stars_named", "stars_out",
    "rapm_stars_named", "rapm_stars_out", "missq_fullback", "missq_halfback", "missq_five_eighth",
    "missq_hooker", "key_absence", "key_star_out", "impact_out", "origin_stars_out_spine", "origin_stars_out_other",
]
EXPERIMENTAL_MATCH_FEATURES = [
    "team_total", "night_game", "kickoff_thursday", "kickoff_friday", "kickoff_sunday",
    "diff_travel_km", "diff_tz_change", "diff_ladder_pos", "diff_out_of_contention",
]


def team_features():
    """Per-team features built this run (home minus away versions become diff_*)."""
    return PLAYER_TEAM_FEATURES + (EXPERIMENTAL_TEAM_FEATURES if EXPERIMENTAL else [])


def feature_columns():
    """Every feature column in features.csv this run (the core groups, plus the experimental ones
    with --experimental). Used by the leakage test."""
    groups = [g for name, g in FEATURE_GROUPS.items() if name != "experimental" or EXPERIMENTAL]
    return list(dict.fromkeys(f for g in groups for f in g))

# Origin-based stars (general, no names): a player picked in an Origin 17 within the previous
# ORIGIN_REP_DAYS. S1 counts the team's usual players (named in USUAL_MIN of its last USUAL_WINDOW
# games) who are Origin stars and missing from the named 17, split into spine and other positions
# (by the player's latest starting position). S2 is the same with a star being an Origin star OR a
# stats-based star (top STAR_SHARE of his position group for fantasy points per 80 minutes), which also
# covers players not eligible for Origin.

# Impact-based stars (with/without): a player's impact is the team's average result against its
# line-up-blind team rating (actual margin minus team_margin) in games he played minus games he missed
# while at the club (appeared for it within STAR_ACTIVE_DAYS), each shrunk by n / (n + IMPACT_SHRINK);
# players with fewer than IMPACT_MIN_GAMES games played count 0. impact_out sums the impact of the team's
# usual players (named in USUAL_MIN of its last USUAL_WINDOW games) missing from the named 17.
IMPACT_SHRINK = 10
IMPACT_MIN_GAMES = 10

# Key-position absences (the star-absence score). The team's usual player at each key position is
# whoever started there most often in its last KEY_WINDOW games (ties: the most recent). His quality is
# his fantasy points per 80 minutes (EWMA over games with STAR_MIN_MINUTES+), as a percentile among
# active players (KEY_MIN_GAMES+ games, played in the last year) whose latest key position is the same.
# If he isn't in the named 17 the team gets his quality at that position; key_absence sums the four,
# and key_star_out counts missing usual players with quality >= KEY_STAR_PCT. Earlier games only.
KEY_POSITIONS = {"Fullback": "fullback", "Halfback": "halfback", "Five-Eighth": "five_eighth", "Hooker": "hooker"}
KEY_WINDOW = 5
KEY_MIN_GAMES = 5
KEY_STAR_PCT = 0.8

# Star players (two definitions, fixed before testing). Stats-based: fantasy points per 80 minutes
# (EWMA over NRL games with 20+ minutes), top STAR_SHARE of the player's position group (spine,
# forwards, outside backs; from his latest starting position) among players with STAR_MIN_GAMES+ NRL
# games who played in the last year. Impact-based: top STAR_SHARE of RAPM among players with
# STAR_MIN_GAMES+ named appearances. Both recalculated before every round from earlier games only.
STAR_SHARE = 0.10
STAR_MIN_GAMES = 10
STAR_ALPHA = 0.2              # EWMA weight on the latest game for the stats-based rating
STAR_MIN_MINUTES = 20
STAR_ACTIVE_DAYS = 365

RESERVE_FILE = PROCESSED / "reserve_player_stats.csv"
PRE_KICKOFF_FILE = PROCESSED / "pre_kickoff_teamlists.csv"  # teamlists.py (item 40)
RESERVE_NEWCOMER_GAMES = 10   # "newcomer": fewer NRL games than this before the match
RESERVE_MIN_MINUTES = 20      # reserve-grade games with less time on the field are too noisy to rate
RESERVE_RAPM_HALF_LIFE_DAYS = 365  # reserve plus-minus: newcomers' history spans longer than a regular's
RESERVE_INTERCHANGE_WEIGHT = 0.5   # an interchange newcomer counts half (they play about half the minutes)

# Travel: city coordinates (lat, lon) for every venue city and team base, and time-zone offsets from
# Sydney (standard time). Teams are based in their home city; the Warriors were based in Australia
# during COVID (Central Coast 2020-21, Redcliffe until mid-2022).
CITY_COORDS = {
    "Sydney": (-33.87, 151.21), "Brisbane": (-27.47, 153.03), "Gold Coast": (-28.00, 153.43),
    "Townsville": (-19.26, 146.82), "Newcastle": (-32.93, 151.78), "Canberra": (-35.28, 149.13),
    "Melbourne": (-37.81, 144.96), "Penrith": (-33.75, 150.69), "Auckland": (-36.85, 174.76),
    "Wollongong": (-34.42, 150.89), "Gosford": (-33.43, 151.34), "Redcliffe": (-27.23, 153.10),
    "Sunshine Coast": (-26.65, 153.07), "Perth": (-31.95, 115.86), "Darwin": (-12.46, 130.84),
    "Bathurst": (-33.42, 149.58), "Mackay": (-21.14, 149.19), "Las Vegas": (36.17, -115.14),
    "Mudgee": (-32.59, 149.59), "Kogarah": (-33.96, 151.13), "Tamworth": (-31.09, 150.93),
    "Coffs Harbour": (-30.30, 153.11), "Wagga Wagga": (-35.12, 147.37), "Rockhampton": (-23.38, 150.51),
    "Bundaberg": (-24.87, 152.35), "Christchurch": (-43.53, 172.64), "Dubbo": (-32.25, 148.60),
    "Wellington": (-41.29, 174.78), "Toowoomba": (-27.56, 151.95), "Napier": (-39.49, 176.91),
    "Cairns": (-16.92, 145.77), "Hamilton": (-37.79, 175.28),
}
CITY_TZ = {"Perth": -2.0, "Darwin": -0.5, "Auckland": 2.0, "Christchurch": 2.0, "Wellington": 2.0,
           "Napier": 2.0, "Hamilton": 2.0, "Las Vegas": -18.0}  # hours from Sydney; others 0
TEAM_BASE = {
    "Broncos": "Brisbane", "Raiders": "Canberra", "Bulldogs": "Sydney", "Sharks": "Sydney",
    "Dolphins": "Redcliffe", "Titans": "Gold Coast", "Sea Eagles": "Sydney", "Storm": "Melbourne",
    "Knights": "Newcastle", "Cowboys": "Townsville", "Eels": "Sydney", "Panthers": "Penrith",
    "Rabbitohs": "Sydney", "Dragons": "Sydney", "Roosters": "Sydney", "Warriors": "Auckland",
    "Wests Tigers": "Sydney",
}
WARRIORS_BASES = [(pd.Timestamp("2022-01-01", tz="UTC"), "Gosford"), (pd.Timestamp("2022-07-01", tz="UTC"), "Redcliffe")]
ORIGIN_REP_DAYS = 365         # an "Origin representative" played Origin within this many days
# Ladder: regular-season rounds per season (from the published draw) and the clubs in each season.
REGULAR_ROUNDS = {2020: 20, 2021: 25, 2022: 25, 2023: 27, 2024: 27, 2025: 27, 2026: 27}
FINALS_PLACES = 8

SHORT_TURNAROUND_DAYS = 6   # under 6 days since the last game (e.g. Sunday -> Friday)
BYE_GAP_DAYS = 11           # 11+ days since the last game in the same season: coming off a bye
ORIGIN_WINDOW_DAYS = 7      # an Origin game within this many days of the match

RAPM_ALPHA = 300.0          # ridge penalty on player plus-minus ratings (chosen on 2022-24 CV)
RAPM_HALF_LIFE_DAYS = 90    # a game 90 days old counts half as much
MARGIN_CAP = 40             # cap blowouts so one game can't dominate a rating
RAPM_BENCH_WEIGHT = True    # weight players by minutes (past games) / typical role minutes (prediction)
RAPM_STATS_PRIOR = False    # deviations from a fantasy-points estimate: worse on 2022-24 CV, so off
RAPM_PRIOR_PENALTY = 1.0    # light penalty on the stats-prior coefficient

TEAM_RATING_HALF_LIFE_DAYS = 730  # team margin rating: a game two years old counts half
TEAM_HFA_PENALTY = 30.0           # shrinkage of each team's own home advantage towards the league's
TEAM_STRENGTH_PENALTY = 1.0       # light ridge penalty on team strengths

FEATURE_GROUPS = {
    "elo": ["elo_logit", "team_margin"],
    "form": [f"diff_form_{s}" for s in FORM_STATS],
    "context": ["diff_rest_days", "home_travel", "away_travel", "neutral", "away_at_ground", "is_final",
                "diff_short_turnaround", "diff_after_bye", "origin_period", "wet_conditions"],
    "player": [f"diff_{f}" for f in PLAYER_TEAM_FEATURES] + ["rapm_points"],
    # Opening prices come from bet365 until April 2024 and BlueBet after, which open differently
    # (bet365 under-confident, BlueBet over-confident), so the with-odds models also get a BlueBet
    # indicator and the opening log-odds x BlueBet.
    "odds": ["open_logit", "open_line", "open_total", "bluebet", "open_logit_bluebet"],
    "experimental": [f"diff_{f}" for f in EXPERIMENTAL_TEAM_FEATURES] + EXPERIMENTAL_MATCH_FEATURES,
}

WET_GROUNDS = {"Slippery", "Wet", "Heavy", "Muddy"}

MIN_HISTORY = 5  # both teams need this many earlier games in the scraped data

# Scraped games are used from the 2020 restart, when the six-again rule began: earlier games come
# from a different style of game. Elo still uses every result since 2009 from the odds sheet.
SIX_AGAIN_START = pd.Timestamp("2020-05-28", tz="UTC")


def logit(p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def team_long(matches, team_stats):
    """One row per team per match, in kickoff order, with rest days, turnaround, byes and travel."""
    long = team_stats.merge(
        matches[["match_id", "start_time_utc", "venue_city"]], on="match_id", how="left")
    long = long.sort_values(["start_time_utc", "match_id", "is_home"], ascending=[True, True, False])
    # Stats the site leaves out when they are zero; a game with no stats recorded at all stays missing.
    other = [c for c in FORM_STATS if c not in POINTS]
    no_stats = long[other].isna().all(axis=1)
    long[FORM_STATS] = long[FORM_STATS].fillna(0)
    long.loc[no_stats, other] = np.nan

    gap = long.groupby("team")["start_time_utc"].diff().dt.total_seconds() / 86400
    long["rest_days"] = gap.clip(upper=14).fillna(14)
    long["short_turnaround"] = (gap < SHORT_TURNAROUND_DAYS).astype(int)
    same_season = long.groupby("team")["season"].shift(1) == long["season"]
    long["after_bye"] = (same_season & (gap >= BYE_GAP_DAYS)).astype(int)
    venue_city = long["venue_city"].str.split(",").str[0].str.strip()
    venue_state = venue_city.map(CITY_STATE)
    long["travel"] = (venue_state != long["team"].map(TEAM_STATE)).astype(int)
    if EXPERIMENTAL:
        base = [team_base(t, k) for t, k in zip(long["team"], long["start_time_utc"])]
        long["travel_km"] = [distance_km(b, v) / 100 for b, v in zip(base, venue_city)]  # hundreds of km
        long["tz_change"] = [tz_change(b, v) for b, v in zip(base, venue_city)]
    return long.reset_index(drop=True)


def team_base(team, kickoff):
    """The city a team is based in at the time (the Warriors were in Australia during COVID)."""
    if team == "Warriors":
        for until, city in WARRIORS_BASES:
            if kickoff < until:
                return city
    return TEAM_BASE[team]


def distance_km(a, b):
    """Great-circle distance between two cities; 0 if either is unknown."""
    if a not in CITY_COORDS or b not in CITY_COORDS:
        return 0.0
    (la1, lo1), (la2, lo2) = (np.radians(CITY_COORDS[a]), np.radians(CITY_COORDS[b]))
    h = np.sin((la2 - la1) / 2) ** 2 + np.cos(la1) * np.cos(la2) * np.sin((lo2 - lo1) / 2) ** 2
    return float(2 * 6371 * np.arcsin(np.sqrt(h)))


def tz_change(a, b):
    """Hours of time-zone change between two cities (the shorter way around the clock)."""
    d = abs(CITY_TZ.get(a, 0.0) - CITY_TZ.get(b, 0.0)) % 24
    return min(d, 24 - d)


def add_team_form(long):
    """Exponentially weighted pre-match averages of FORM_STATS for each team.

    At each new season the averages are pulled partway back to the previous season's league
    average (known by then). Missing stats (games with none recorded) leave the average unchanged.
    `n_hist` counts the team's earlier games in the scraped data.
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
            v = values[i]
            if state is None:
                state = v.copy()
            else:
                updated = FORM_ALPHA * v + (1 - FORM_ALPHA) * state
                state = np.where(np.isnan(v), state, np.where(np.isnan(state), v, updated))
            n += 1

    form = pd.DataFrame(out, columns=[f"form_{c}" for c in FORM_STATS], index=long.index)
    return pd.concat([long, form], axis=1).assign(n_hist=n_hist)


def player_history(p):
    """Each player's state after every game they played (minutes > 0), and position-group averages."""
    played = p[p["minutesPlayed"] > 0].sort_values(["start_time_utc", "match_id", "player_id"])
    played = played.assign(
        ewm=played.groupby("player_id")["fantasy"].transform(lambda s: s.ewm(alpha=PLAYER_ALPHA).mean()),
        n_played=played.groupby("player_id").cumcount() + 1,
    )
    by_time = played.groupby(["pos_group", "start_time_utc"])["fantasy"].agg(["sum", "count"]).reset_index()
    by_time[["cum_sum", "cum_n"]] = by_time.groupby("pos_group")[["sum", "count"]].cumsum()
    by_time["group_avg"] = by_time["cum_sum"] / by_time["cum_n"]
    return (played[["player_id", "start_time_utc", "ewm", "n_played"]],
            by_time[["pos_group", "start_time_utc", "group_avg"]])


def rate_players(query, history, group_avgs):
    """Pre-match rating for rows of (player_id, pos_group, start_time_utc), using strictly earlier games:
    the player's EWMA of fantasy points, shrunk towards the position-group average (less so as they
    play more games). Returns rating and n_prior aligned to query's index."""
    q = query.reset_index(names="_row").sort_values("start_time_utc")
    q = pd.merge_asof(q, history.sort_values("start_time_utc"), on="start_time_utc", by="player_id",
                      allow_exact_matches=False)
    q = pd.merge_asof(q, group_avgs.sort_values("start_time_utc"), on="start_time_utc", by="pos_group",
                      allow_exact_matches=False)
    n, prior, k = q["n_played"].fillna(0), q["group_avg"].fillna(40.0), PLAYER_PRIOR_GAMES
    q["rating"] = np.where(n > 0, (n * q["ewm"] + k * prior) / (n + k), prior)
    q["n_prior"] = n
    q["rating_vs_group"] = q["rating"] - prior  # 0 for a new player
    return q.set_index("_row")[["rating", "n_prior", "rating_vs_group"]].reindex(query.index)


def origin_squads(origin):
    """Kickoff times of the Origin games each player was named in (the 17, not reserves)."""
    o = origin[~origin["position"].isin(NOT_NAMED)]
    return o.assign(t=pd.to_datetime(o["start_time_utc"], utc=True)).groupby("player_id")["t"].agg(list).to_dict()


def lineup_changes(named, history, group_avgs, origin_by_player):
    """Team-news features from each team's sequence of named 17s.

    Only earlier line-ups (and earlier games' goal-kicking) are used; the current match contributes
    just its named 17, which is known before kickoff. Origin counts use Origin squads within
    ORIGIN_WINDOW_DAYS: backing up from a game just played, or missing for one just played or
    about to be played (squads are named well in advance).
    """
    window = pd.Timedelta(days=ORIGIN_WINDOW_DAYS)

    def in_origin(pid, start, end):
        return any(start <= t < end for t in origin_by_player.get(pid, ()))

    rows, missing_q = [], []
    for team_name, g in named.groupby("team", sort=False):
        recent, kicks, last_group = deque(maxlen=USUAL_WINDOW), deque(maxlen=USUAL_WINDOW), {}
        for (match_id, kickoff), lm in g.groupby(["match_id", "start_time_utc"], sort=False):
            ids = set(lm["player_id"])
            prev = recent[-1] if recent else ids
            counts = Counter(pid for lineup in recent for pid in lineup)
            missing = {pid for pid, c in counts.items() if c >= USUAL_MIN} - ids
            kick_totals = sum(kicks, Counter())
            usual_kicker = kick_totals.most_common(1)[0][0] if kick_totals else None

            row = {"match_id": match_id, "team": team_name, "missing_usual": len(missing),
                   "kicker_changed": int(usual_kicker is not None and usual_kicker not in ids),
                   "returning": int((~lm["player_id"].isin(prev) & (lm["n_prior"] >= RETURNING_GAMES)).sum())}
            row["origin_backup"] = sum(in_origin(pid, kickoff - window, kickoff) for pid in ids)
            row["origin_reps"] = sum(in_origin(pid, kickoff - pd.Timedelta(days=ORIGIN_REP_DAYS), kickoff) for pid in ids)
            row["origin_out"] = sum(in_origin(pid, kickoff - window, kickoff + window) for pid in missing)
            for grp in ("forwards", "backs", "bench"):
                row[f"ins_{grp}"] = len(set(lm.loc[lm["pos_group"] == grp, "player_id"]) - prev)
            rows.append(row)
            missing_q += [{"match_id": match_id, "team": team_name, "player_id": pid,
                           "pos_group": last_group[pid], "start_time_utc": kickoff} for pid in missing]

            # Only now does this match join the history used by later matches.
            recent.append(ids)
            last_group.update(zip(lm["player_id"], lm["pos_group"]))
            attempts = lm.set_index("player_id")["conversionAttempts"].fillna(0)
            kicks.append(Counter(attempts[attempts > 0].to_dict()))

    out = pd.DataFrame(rows).set_index(["match_id", "team"])
    out["missing_usual_rating"] = 0.0
    if missing_q:
        mq = pd.DataFrame(missing_q)
        mq["rating"] = rate_players(mq[["player_id", "pos_group", "start_time_utc"]], history, group_avgs)["rating"]
        out["missing_usual_rating"] = mq.groupby(["match_id", "team"])["rating"].sum().reindex(out.index).fillna(0)
    return out


def weighted_ridge(X, y, w, penalty):
    """Exact ridge solution (X'WX + diag(penalty)) b = X'Wy, so columns with no data get exactly 0."""
    XtW = X.T.multiply(w).tocsr()
    A = (XtW @ X).toarray() + np.diag(penalty)  # small (players x players) and fairly dense
    return cho_solve(cho_factor(A), XtW @ y)


def rapm_features(matches, players, alpha=None, half_life=None, bench_weight=None, stats_prior=None,
                  current=None):
    """Regularised plus-minus ratings, refitted before each round on earlier games only.

    Two ridge regressions over earlier games, one row per game, older games down-weighted:
    - margin: +share for each home player, -share for each away player, a home-advantage
      column, and the capped margin as the target;
    - total: +share for every player on either team, and the match total as the target.
    A player's attack rating is (margin + total) / 2 and defence rating (total - margin) / 2.
    That is the same as one regression on points scored by each team with separate attack and
    defence columns (rotating each game's two rows into their sum and difference), but solves
    two small systems instead of one twice the size.
    With bench_weight, `share` is a player's minutes / 80 in past games, and for the match being
    predicted it is the typical share for his named role (starter or interchange) in earlier
    games, so nothing from the match itself is used. Otherwise every named player counts 1.
    With stats_prior, each player's pre-match fantasy-point rating (relative to his position
    group's average) enters as a lightly penalised column, so a player's rating is a deviation
    from what his stats suggest rather than from zero.

    Returns per team and match: rapm_total (margin rating of the named 17), rapm_vs_usual (versus
    the team's previous USUAL_WINDOW line-ups, valued with the same ratings), rapm_missing (usual
    players not named), rapm_attack and rapm_defence (expected points scored / conceded relative
    to average; lower defence is better).
    With `current` (named-17 rows from pre-kickoff team lists), those line-ups replace the final
    named 17 for the match being predicted; history still uses the line-ups that actually played.
    """
    alpha = RAPM_ALPHA if alpha is None else alpha
    half_life = RAPM_HALF_LIFE_DAYS if half_life is None else half_life
    bench_weight = RAPM_BENCH_WEIGHT if bench_weight is None else bench_weight
    stats_prior = RAPM_STATS_PRIOR if stats_prior is None else stats_prior

    games = matches.sort_values("start_time_utc").reset_index(drop=True)
    n_games = len(games)
    game_row = pd.Series(games.index, index=games["match_id"])
    home_team = dict(zip(games["match_id"], games["home_team"]))
    pids = pd.Index(players["player_id"].unique())
    n = len(pids)
    minutes_share = players["minutesPlayed"].fillna(0).clip(upper=80) / 80
    is_named = ~players["position"].isin(NOT_NAMED)

    # Who counts in past games: everyone on the field (by minutes), or the named 17 equally.
    src = players[minutes_share > 0] if bench_weight else players[is_named]
    r = game_row.loc[src["match_id"]].to_numpy()
    c = pids.get_indexer(src["player_id"])
    share = minutes_share[src.index].to_numpy() if bench_weight else np.ones(len(src))
    rating = src["rating_vs_group"].to_numpy() if stats_prior else np.zeros(len(src))
    home = src["team"].to_numpy() == src["match_id"].map(home_team).to_numpy()
    sign = np.where(home, 1.0, -1.0)
    g_all = np.arange(n_games)

    # Margin design: players | home advantage | stats prior.
    zm = np.bincount(r, weights=sign * share * rating, minlength=n_games)
    Xm = sparse.csr_matrix(
        (np.r_[sign * share, np.ones(n_games), zm],
         (np.r_[r, g_all, g_all], np.r_[c, np.full(n_games, n), np.full(n_games, n + 1)])),
        shape=(n_games, n + 2))
    ym = (games["home_score"] - games["away_score"]).clip(-MARGIN_CAP, MARGIN_CAP).to_numpy(dtype=float)
    pen_m = np.r_[np.full(n + 1, alpha), RAPM_PRIOR_PENALTY]

    # Total design: players | stats prior (intercept handled by centring the target).
    zt = np.bincount(r, weights=share * rating, minlength=n_games)
    Xt = sparse.csr_matrix((np.r_[share, zt], (np.r_[r, g_all], np.r_[c, np.full(n_games, n)])),
                           shape=(n_games, n + 1))
    yt = (games["home_score"] + games["away_score"]).to_numpy(dtype=float)
    pen_t = np.r_[np.full(n, alpha), RAPM_PRIOR_PENALTY]

    # Named 17s for prediction: (player column, is starter, pre-match rating).
    named = players[is_named]
    starter = (named["position"] != "Interchange").to_numpy()
    named_game = game_row.loc[named["match_id"]].to_numpy()
    named_share = minutes_share[named.index].to_numpy()
    named_rating = named["rating_vs_group"].to_numpy() if stats_prior else np.zeros(len(named))
    lineups = defaultdict(list)
    for key, j, st, rt in zip(zip(named["match_id"], named["team"]), pids.get_indexer(named["player_id"]),
                              starter, named_rating):
        lineups[key].append((j, st, rt))
    current_lineups = defaultdict(list)
    if current is not None:  # players with no NRL games yet get column -1 (rating 0)
        cur_rating = current["rating_vs_group"].to_numpy() if stats_prior else np.zeros(len(current))
        for key, j, st, rt in zip(zip(current["match_id"], current["team"]), pids.get_indexer(current["player_id"]),
                                  (current["position"] != "Interchange").to_numpy(), cur_rating):
            current_lineups[key].append((j, st, rt))

    kickoff = games["start_time_utc"]
    fit, block, out = None, None, []
    recent = defaultdict(lambda: deque(maxlen=USUAL_WINDOW))
    appearances, rapm_stars = Counter(), set()  # named appearances so far; impact-based stars
    for g in games.itertuples():
        if (g.season, g.round) != block:  # new round (or a postponed game): refit on earlier results
            block = (g.season, g.round)
            rapm_stars = set()
            train = ((kickoff < g.start_time_utc) & ~np.isnan(ym)).to_numpy()
            if train.sum() >= 20:
                w = 0.5 ** ((g.start_time_utc - kickoff[train]).dt.days.to_numpy() / half_life)
                cm = weighted_ridge(Xm[train], ym[train], w, pen_m)
                ct = weighted_ridge(Xt[train], yt[train] - np.average(yt[train], weights=w), w, pen_t)
                (bm, gm), (bt, gt) = (cm[:n], cm[n + 1]), (ct[:n], ct[n])
                in_train = train[named_game]
                role_share = ((named_share[in_train & starter].mean(), named_share[in_train & ~starter].mean())
                              if bench_weight else (1.0, 1.0))
                fit = {"margin": (bm, gm), "attack": ((bt + bm) / 2, (gt + gm) / 2),
                       "defence": ((bt - bm) / 2, (gt - gm) / 2), "share": role_share}
            if fit is not None:
                eligible = np.array([j for j, k in appearances.items() if k >= STAR_MIN_GAMES], dtype=int)
                if len(eligible) >= 20:
                    coef = fit["margin"][0]
                    cut = np.quantile(coef[eligible], 1 - STAR_SHARE)
                    rapm_stars = {int(j) for j in eligible if coef[j] >= cut}

        def value(entries, kind):
            if fit is None:
                return 0.0
            coef, gamma = fit[kind]
            s_start, s_bench = fit["share"]
            return float(sum((s_start if st else s_bench) * ((coef[j] if j >= 0 else 0.0) + gamma * rt)
                             for j, st, rt in entries))

        for team in (g.home_team, g.away_team):
            key = (g.match_id, team)
            lineup = current_lineups[key] if key in current_lineups else lineups.get(key, [])
            prev = recent[team]
            latest = {e[0]: e for lineup_prev in prev for e in lineup_prev}  # most recent entry per player
            counts = Counter(e[0] for lineup_prev in prev for e in lineup_prev)
            missing = [latest[j] for j, k in counts.items() if k >= USUAL_MIN and j not in {e[0] for e in lineup}]
            total = value(lineup, "margin")
            lineup_ids = {e[0] for e in lineup}
            usual_ids = {j for j, k in counts.items() if k >= USUAL_MIN}
            out.append({"match_id": g.match_id, "team": team, "rapm_total": total,
                        "rapm_stars_named": len(lineup_ids & rapm_stars),
                        "rapm_stars_out": len((usual_ids - lineup_ids) & rapm_stars),
                        "rapm_vs_usual": total - (np.mean([value(l, "margin") for l in prev]) if prev else total),
                        "rapm_missing": value(missing, "margin"),
                        "rapm_attack": value(lineup, "attack"), "rapm_defence": value(lineup, "defence")})
        for team in (g.home_team, g.away_team):
            recent[team].append(lineups.get((g.match_id, team), []))
            appearances.update(e[0] for e in lineups.get((g.match_id, team), []))
    return pd.DataFrame(out).set_index(["match_id", "team"])


def team_ratings(odds, half_life=None, hfa_penalty=None, strength_penalty=None):
    """Team margin rating from results since 2009, refitted weekly on earlier games only.

    A ridge regression of capped margins on team strengths (+1 home, -1 away), a league home
    advantage and each team's own home advantage (shrunk towards the league's, 0 at neutral
    venues), with older games down-weighted. Unlike Elo, which only uses win/loss with a margin
    multiplier, it is fitted to the margins directly. Returns the predicted margin per odds game,
    and the home team's own home-advantage deviation (team_hfa, 0 at neutral venues).
    """
    half_life = TEAM_RATING_HALF_LIFE_DAYS if half_life is None else half_life
    hfa_penalty = TEAM_HFA_PENALTY if hfa_penalty is None else hfa_penalty
    strength_penalty = TEAM_STRENGTH_PENALTY if strength_penalty is None else strength_penalty
    g = odds.sort_values("odds_id").reset_index(drop=True)
    teams = sorted(set(g["home_team"]) | set(g["away_team"]))
    ix = {t: i for i, t in enumerate(teams)}
    n, T = len(g), len(teams)
    h, a = g["home_team"].map(ix).to_numpy(), g["away_team"].map(ix).to_numpy()
    home_adv = (~g["neutral"].astype(bool)).to_numpy().astype(float)
    r = np.arange(n)
    X = sparse.csr_matrix((np.r_[np.ones(n), -np.ones(n), home_adv, home_adv],
                           (np.r_[r, r, r, r], np.r_[h, a, np.full(n, T), T + 1 + h])), shape=(n, 2 * T + 1))
    y = (g["home_score"] - g["away_score"]).clip(-MARGIN_CAP, MARGIN_CAP).to_numpy(dtype=float)
    penalty = np.r_[np.full(T, strength_penalty), 1e-3, np.full(T, hfa_penalty)]
    week = g["date"].dt.to_period("W").to_numpy()
    pred, hfa_dev = np.full(n, np.nan), np.zeros(n)
    for wk in pd.unique(week):
        idx = np.flatnonzero(week == wk)
        start = g.loc[idx[0], "date"]
        train = ((g["date"] < start) & ~np.isnan(y)).to_numpy()
        if train.sum() < 50:
            continue
        w = 0.5 ** ((start - g.loc[train, "date"]).dt.days.to_numpy() / half_life)
        b = weighted_ridge(X[train], y[train], w, penalty)
        pred[idx] = b[h[idx]] - b[a[idx]] + home_adv[idx] * (b[T] + b[T + 1 + h[idx]])
        hfa_dev[idx] = home_adv[idx] * b[T + 1 + h[idx]]
    return pd.DataFrame({"odds_id": g["odds_id"], "team_margin": pred, "team_hfa": hfa_dev})


def reserve_ratings(reserve):
    """Each player's reserve-grade (NSW Cup / QLD Cup) state after every game they played: EWMA of
    fantasy points per 80 minutes, and reserve-grade position-group averages (as player_history)."""
    r = reserve[reserve["minutesPlayed"] >= RESERVE_MIN_MINUTES].copy()
    r["pos_group"] = r["position"].map(POS_GROUP).fillna("bench")
    r["fantasy"] = r["fantasyPointsTotal"] / r["minutesPlayed"] * 80
    return player_history(r)


def reserve_newcomers(named, reserve):
    """Sum of the reserve-grade rating (relative to the position group's reserve-grade average, shrunk
    for few games) of named players with fewer than RESERVE_NEWCOMER_GAMES NRL games. Only reserve
    games before the NRL kickoff are used. RAPM knows little about these players; reserve grade can."""
    out = pd.Series(0.0, index=pd.MultiIndex.from_frame(named[["match_id", "team"]].drop_duplicates()))
    if reserve is None or reserve.empty:
        return out
    history, group_avgs = reserve_ratings(reserve)
    newcomers = named[named["n_prior"] < RESERVE_NEWCOMER_GAMES]
    rated = rate_players(newcomers[["player_id", "pos_group", "start_time_utc"]], history, group_avgs)
    total = rated["rating_vs_group"].groupby([newcomers["match_id"], newcomers["team"]]).sum()
    return total.reindex(out.index).fillna(0.0)


def reserve_rapm_newcomers(matches, named, reserve):
    """Reserve-grade plus-minus (NSW Cup / QLD Cup) of NRL newcomers.

    The same method as the NRL RAPM margin model: a ridge regression of each reserve game's capped
    margin on the players on the field (weighted by minutes / 80) and a home-advantage column, older
    games down-weighted (RESERVE_RAPM_HALF_LIFE_DAYS), refitted before each NRL round on reserve games
    that started earlier. Each refit only includes players with a reserve game by then. Returns, per NRL
    team and match, the sum of the ratings of named players with fewer than RESERVE_NEWCOMER_GAMES NRL
    games (interchange players weighted by RESERVE_INTERCHANGE_WEIGHT).
    """
    keys = named[["match_id", "team"]].drop_duplicates()
    out = pd.Series(0.0, index=pd.MultiIndex.from_frame(keys))
    if reserve is None or reserve.empty:
        return out
    r = reserve[reserve["minutesPlayed"] > 0].sort_values(["start_time_utc", "match_id", "player_id"])
    game_ids = pd.unique(r["match_id"])
    row = pd.Series(np.arange(len(game_ids)), index=game_ids)
    home_rows = r[r["is_home"].astype(bool)].drop_duplicates("match_id").set_index("match_id")
    games = home_rows.loc[game_ids, ["start_time_utc", "team_score", "opponent_score"]]
    kickoff = games["start_time_utc"].to_numpy()
    y = (games["team_score"] - games["opponent_score"]).clip(-MARGIN_CAP, MARGIN_CAP).to_numpy(dtype=float)
    pids = pd.Index(pd.unique(r["player_id"]))
    n_games, n = len(game_ids), len(pids)
    rr, cc = row.loc[r["match_id"]].to_numpy(), pids.get_indexer(r["player_id"])
    sign = np.where(r["is_home"].astype(bool), 1.0, -1.0)
    share = (r["minutesPlayed"].clip(upper=80) / 80).to_numpy()
    X = sparse.csr_matrix((np.r_[sign * share, np.ones(n_games)],
                           (np.r_[rr, np.arange(n_games)], np.r_[cc, np.full(n_games, n)])), shape=(n_games, n + 1))
    first_game = pd.Series(rr).groupby(cc).min().reindex(range(n)).to_numpy()  # each player's first reserve game
    ok = ~np.isnan(y)

    newcomers = named[named["n_prior"] < RESERVE_NEWCOMER_GAMES]
    weight = np.where(newcomers["position"] == "Interchange", RESERVE_INTERCHANGE_WEIGHT, 1.0)
    by_match = {k: list(zip(g["player_id"], weight[g.index])) for k, g in
                newcomers.reset_index(drop=True).groupby(["match_id", "team"])}

    ratings, block = {}, None
    for g in matches.sort_values("start_time_utc").itertuples():
        if (g.season, g.round) != block:  # new NRL round: refit on reserve games that started earlier
            block = (g.season, g.round)
            train = ok & (kickoff < g.start_time_utc)
            ratings = {}
            if train.sum() >= 50:
                active = np.flatnonzero(first_game < np.flatnonzero(train).max() + 1)
                cols = np.r_[active, n]
                age = (g.start_time_utc - games["start_time_utc"][train]).dt.days.to_numpy()
                b = weighted_ridge(X[train][:, cols], y[train], 0.5 ** (age / RESERVE_RAPM_HALF_LIFE_DAYS),
                                   np.full(len(cols), RAPM_ALPHA))
                ratings = dict(zip(pids[active], b[:-1]))
        for team in (g.home_team, g.away_team):
            players_ = by_match.get((g.match_id, team), [])
            out[(g.match_id, team)] = sum(w * ratings.get(pid, 0.0) for pid, w in players_)
    return out


def team_total_ratings(odds, half_life=None, penalty=None):
    """Team total rating from results since 2009, refitted weekly on earlier games only.

    The totals counterpart of team_ratings: a ridge regression of each match's total (centred) on a
    "total tendency" per team (+1 for both teams), with older games down-weighted. A team's tendency
    is its attack plus its defence (how many points its games produce relative to average), which is
    all a total depends on. Same settings as the team margin rating. Returns the expected total relative
    to average per odds game.
    """
    half_life = TEAM_RATING_HALF_LIFE_DAYS if half_life is None else half_life
    penalty = TEAM_STRENGTH_PENALTY if penalty is None else penalty
    g = odds.sort_values("odds_id").reset_index(drop=True)
    teams = sorted(set(g["home_team"]) | set(g["away_team"]))
    ix = {t: i for i, t in enumerate(teams)}
    n, T = len(g), len(teams)
    h, a = g["home_team"].map(ix).to_numpy(), g["away_team"].map(ix).to_numpy()
    r = np.arange(n)
    X = sparse.csr_matrix((np.ones(2 * n), (np.r_[r, r], np.r_[h, a])), shape=(n, T))
    y = (g["home_score"] + g["away_score"]).to_numpy(dtype=float)
    week = g["date"].dt.to_period("W").to_numpy()
    pred = np.full(n, np.nan)
    for wk in pd.unique(week):
        idx = np.flatnonzero(week == wk)
        start = g.loc[idx[0], "date"]
        train = ((g["date"] < start) & ~np.isnan(y)).to_numpy()
        if train.sum() < 50:
            continue
        w = 0.5 ** ((start - g.loc[train, "date"]).dt.days.to_numpy() / half_life)
        b = weighted_ridge(X[train], y[train] - np.average(y[train], weights=w), w, np.full(T, penalty))
        pred[idx] = b[h[idx]] + b[a[idx]]
    return pd.DataFrame({"odds_id": g["odds_id"], "team_total": pred})


def star_features(matches, p, origin_by_player=None, return_sets=False, current=None):
    """Stats-based stars: per NRL team and match, how many stars are named, and how many of the team's
    usual players (named in USUAL_MIN of its last USUAL_WINDOW games) who are stars are missing.
    Ratings and thresholds come from games before the round; each round's games are added afterwards.
    With origin_by_player, also the Origin-based star absences (S1, S2; see above). With return_sets, also
    returns {round start: (stats-based stars, Origin stars)} for checking who counts as a star."""
    origin_by_player = origin_by_player or {}
    origin_window = pd.Timedelta(days=ORIGIN_REP_DAYS)
    snapshots = {}
    named = p[~p["position"].isin(NOT_NAMED)]
    played = p[p["minutesPlayed"] >= STAR_MIN_MINUTES]
    per80 = (played["fantasyPointsTotal"] / played["minutesPlayed"] * 80).to_numpy()
    state = {}  # player -> [ewma, games, position group, last game time]
    recent = defaultdict(lambda: deque(maxlen=USUAL_WINDOW))
    lineups = named.groupby(["match_id", "team"])["player_id"].agg(set).to_dict()
    current_ids = {} if current is None else current.groupby(["match_id", "team"])["player_id"].agg(set).to_dict()
    played_by_match = {mid: list(zip(g["player_id"], per80[played.index.get_indexer(g.index)], g["pos_group"]))
                       for mid, g in played.groupby("match_id")}
    out = []
    games = matches.sort_values("start_time_utc")
    for (_, _), block in games.groupby(["season", "round"], sort=False):
        start = block["start_time_utc"].min()
        thresholds, stars = {}, set()
        for grp in ("spine", "forwards", "backs"):
            vals = [v[0] for v in state.values() if v[2] == grp and v[1] >= STAR_MIN_GAMES
                    and (start - v[3]).days <= STAR_ACTIVE_DAYS]
            thresholds[grp] = np.quantile(vals, 1 - STAR_SHARE) if len(vals) >= 20 else np.inf
        stars = {pid for pid, v in state.items() if v[2] in thresholds and v[1] >= STAR_MIN_GAMES
                 and (start - v[3]).days <= STAR_ACTIVE_DAYS and v[0] >= thresholds[v[2]]}
        origin_stars = {pid for pid, times in origin_by_player.items()
                        if any(start - origin_window <= t < start for t in times)}
        if return_sets:
            snapshots[start] = (stars, origin_stars)
        for g in block.itertuples():
            for team in (g.home_team, g.away_team):
                ids = current_ids.get((g.match_id, team), lineups.get((g.match_id, team), set()))
                counts = Counter(pid for lineup in recent[team] for pid in lineup)
                usual = {pid for pid, c in counts.items() if c >= USUAL_MIN}
                missing = usual - ids
                spine = {pid for pid in missing if state.get(pid, [0, 0, None])[2] == "spine"}
                row = {"match_id": g.match_id, "team": team, "stars_named": len(ids & stars),
                       "stars_out": len(missing & stars),
                       "origin_stars_out_spine": len(spine & origin_stars),
                       "origin_stars_out_other": len((missing - spine) & origin_stars),
                       "s2_stars_out_spine": len(spine & (origin_stars | stars)),
                       "s2_stars_out_other": len((missing - spine) & (origin_stars | stars))}
                out.append(row)
        for g in block.itertuples():  # only now does the round join the history
            for team in (g.home_team, g.away_team):
                recent[team].append(lineups.get((g.match_id, team), set()))
            for pid, value, grp in played_by_match.get(g.match_id, []):
                v = state.get(pid)
                if v is None:
                    state[pid] = [value, 1, grp if grp != "bench" else None, g.start_time_utc]
                else:
                    v[0] = STAR_ALPHA * value + (1 - STAR_ALPHA) * v[0]
                    v[1] += 1
                    v[2] = grp if grp != "bench" else v[2]  # latest starting position group
                    v[3] = g.start_time_utc
    result = pd.DataFrame(out).set_index(["match_id", "team"])
    return (result, snapshots) if return_sets else result


def key_position_absences(matches, p):
    """Per NRL team and match: quality-weighted absence of the usual player at each key position, their
    sum (key_absence), and the number of missing usual key-position players in the top 20% (key_star_out).
    Ratings and percentiles come from games before the round; each round joins the history afterwards."""
    named = p[~p["position"].isin(NOT_NAMED)]
    lineup_ids = named.groupby(["match_id", "team"])["player_id"].agg(set).to_dict()
    key_slots = {k: dict(zip(g["position"], g["player_id"])) for k, g in
                 named[named["position"].isin(KEY_POSITIONS)].groupby(["match_id", "team"])}
    played = p[p["minutesPlayed"] >= STAR_MIN_MINUTES]
    per80 = played["fantasyPointsTotal"] / played["minutesPlayed"] * 80
    played_by_match = {mid: list(zip(g["player_id"], per80[g.index], g["position"]))
                       for mid, g in played.groupby("match_id")}
    state = {}  # player -> [ewma per80, games, last time, latest key position]
    recent = defaultdict(lambda: deque(maxlen=KEY_WINDOW))
    out = []
    for (_, _), block in matches.sort_values("start_time_utc").groupby(["season", "round"], sort=False):
        start = block["start_time_utc"].min()
        pct = {}
        for pos in KEY_POSITIONS:
            vals = pd.Series({pid: v[0] for pid, v in state.items() if v[3] == pos and v[1] >= KEY_MIN_GAMES
                              and (start - v[2]).days <= STAR_ACTIVE_DAYS})
            pct[pos] = vals.rank(pct=True).to_dict() if len(vals) else {}
        for g in block.itertuples():
            for team in (g.home_team, g.away_team):
                ids = lineup_ids.get((g.match_id, team), set())
                history = list(recent[team])
                row = {"match_id": g.match_id, "team": team, "key_star_out": 0}
                for pos, col in KEY_POSITIONS.items():
                    seen = [slots.get(pos) for slots in history if slots.get(pos) is not None]
                    q = 0.0
                    if seen:
                        c = Counter(seen)
                        top = max(c.values())
                        usual = next(pid for pid in reversed(seen) if c[pid] == top)  # ties: most recent
                        if usual not in ids:
                            q = pct[pos].get(usual, 0.5)
                            row["key_star_out"] += int(q >= KEY_STAR_PCT)
                    row[f"missq_{col}"] = q
                row["key_absence"] = sum(row[f"missq_{c}"] for c in KEY_POSITIONS.values())
                out.append(row)
        for g in block.itertuples():  # only now does the round join the history
            for team in (g.home_team, g.away_team):
                recent[team].append(key_slots.get((g.match_id, team), {}))
            for pid, value, position in played_by_match.get(g.match_id, []):
                v = state.get(pid)
                key = position if position in KEY_POSITIONS else (v[3] if v else None)
                if v is None:
                    state[pid] = [value, 1, g.start_time_utc, key]
                else:
                    v[0] = STAR_ALPHA * value + (1 - STAR_ALPHA) * v[0]
                    v[1] += 1
                    v[2] = g.start_time_utc
                    v[3] = key
    return pd.DataFrame(out).set_index(["match_id", "team"])


def impact_features(matches, p):
    """impact_out per NRL team and match, from earlier rounds only (see IMPACT_SHRINK)."""
    named = p[~p["position"].isin(NOT_NAMED)]
    lineups = named.groupby(["match_id", "team"])["player_id"].agg(set).to_dict()
    stats = defaultdict(lambda: [0.0, 0, 0.0, 0])  # (player, team) -> [sum with, n with, sum without, n without]
    last_seen = {}                                  # (player, team) -> last appearance
    recent = defaultdict(lambda: deque(maxlen=USUAL_WINDOW))
    out = []

    def impact(key):
        s_on, n_on, s_off, n_off = stats[key]
        if n_on < IMPACT_MIN_GAMES or n_off == 0:
            return 0.0
        diff = s_on / n_on - s_off / n_off
        return diff * n_on / (n_on + IMPACT_SHRINK) * n_off / (n_off + IMPACT_SHRINK)

    for (_, _), block in matches.sort_values("start_time_utc").groupby(["season", "round"], sort=False):
        for g in block.itertuples():
            for team in (g.home_team, g.away_team):
                ids = lineups.get((g.match_id, team), set())
                counts = Counter(pid for lineup in recent[team] for pid in lineup)
                usual = {pid for pid, c in counts.items() if c >= USUAL_MIN}
                out.append({"match_id": g.match_id, "team": team,
                            "impact_out": sum(impact((pid, team)) for pid in usual - ids)})
        for g in block.itertuples():  # only now does the round join the history
            if pd.isna(g.home_score) or pd.isna(g.team_margin):
                continue
            for team, sign in ((g.home_team, 1), (g.away_team, -1)):
                ids = lineups.get((g.match_id, team), set())
                result = sign * ((g.home_score - g.away_score) - g.team_margin)
                for (pid, t), seen in list(last_seen.items()):
                    if t == team and pid not in ids and (g.start_time_utc - seen).days <= STAR_ACTIVE_DAYS:
                        st = stats[(pid, team)]
                        st[2] += result
                        st[3] += 1
                for pid in ids:
                    st = stats[(pid, team)]
                    st[0] += result
                    st[1] += 1
                    last_seen[(pid, team)] = g.start_time_utc
                recent[team].append(ids)
    return pd.DataFrame(out).set_index(["match_id", "team"])


def named_from_list(lists):
    """The named 17 from a team list: the 17 lowest-numbered players who aren't reserves. On Tuesday
    lists that is jerseys 1-17 (since 2026 the squad lists a six-man interchange, 14-19, cut to four
    later in the week, and clubs number their expected four 14-17); on final lists, late replacements
    keep higher numbers, so the 17 who were named are kept whatever their numbers."""
    eligible = lists[~lists["position"].isin(NOT_NAMED)].sort_values(["match_id", "team", "jersey_number"])
    return eligible.groupby(["match_id", "team"], sort=False).head(17)


def player_team_features(matches, players, origin, reserve=None, pre_kickoff=None):
    """Rate every named player before each match, then aggregate the named 17 to team level.

    With pre_kickoff (team lists from before kickoff, teamlists.py), each match that has one for
    both teams is described by that list instead of the final named 17: the team ratings, rookies,
    RAPM and star-absence features. History (usual players, ratings) still comes from the teams
    that actually played. The other team-news features (lineup_changes, spine changes) keep the final
    named 17; the main models don't use them."""
    p = players.merge(matches[["match_id", "start_time_utc"]], on="match_id", how="left")
    p["pos_group"] = p["position"].map(POS_GROUP).fillna("bench")
    p["fantasy"] = p["fantasyPointsTotal"].astype(float)
    history, group_avgs = player_history(p)

    p = p.join(rate_players(p[["player_id", "pos_group", "start_time_utc"]], history, group_avgs))

    # Line-up: the named 17 (known before kickoff), whether or not each player got minutes.
    named = p[~p["position"].isin(NOT_NAMED)].sort_values(["start_time_utc", "match_id", "player_id"])
    current, named_now = None, named
    if pre_kickoff is not None:
        cur = named_from_list(pre_kickoff)[["match_id", "team", "player_id", "position"]]
        cur = cur[cur["match_id"].isin(set(matches["match_id"]))]
        cur = cur.merge(matches[["match_id", "start_time_utc"]], on="match_id")
        cur["pos_group"] = cur["position"].map(POS_GROUP).fillna("bench")
        current = cur.join(rate_players(cur[["player_id", "pos_group", "start_time_utc"]], history, group_avgs))
        keys = pd.MultiIndex.from_frame(current[["match_id", "team"]].drop_duplicates())
        replaced = pd.MultiIndex.from_frame(named[["match_id", "team"]]).isin(keys)
        named_now = pd.concat([named[~replaced], current]).sort_values(["start_time_utc", "match_id", "player_id"])

    team = named_now.pivot_table(index=["match_id", "team"], columns="pos_group", values="rating",
                             aggfunc="sum", fill_value=0)
    team.columns = [f"rating_{c}" for c in team.columns]
    team["rating_total"] = team.sum(axis=1)
    team["rookies"] = named_now.assign(r=named_now["n_prior"] < ROOKIE_GAMES).groupby(["match_id", "team"])["r"].sum()
    team["spine_ids"] = named[named["pos_group"] == "spine"].groupby(["match_id", "team"])["player_id"].agg(frozenset)
    team["halfback_id"] = named[named["position"] == "Halfback"].groupby(["match_id", "team"])["player_id"].first()
    team = team.join(lineup_changes(named, history, group_avgs, origin_squads(origin)))
    team = team.join(rapm_features(matches, p, current=current))
    team = team.join(star_features(matches, p, origin_squads(origin), current=current))  # includes the adopted S2 star absences
    if EXPERIMENTAL:
        team["reserve_newcomers"] = reserve_newcomers(named, reserve)
        team["reserve_rapm_newcomers"] = reserve_rapm_newcomers(matches, named, reserve)
        team = team.join(key_position_absences(matches, p)).join(impact_features(matches, p))
    team = team.reset_index().merge(matches[["match_id", "start_time_utc"]], on="match_id")
    team = team.sort_values(["start_time_utc", "match_id"]).reset_index(drop=True)

    g = team.groupby("team")
    # The usual spine rating comes from the line-ups that actually played (as all history does).
    actual_spine = named[named["pos_group"] == "spine"].groupby(["match_id", "team"])["rating"].sum()
    actual_spine = pd.Series(actual_spine.reindex(pd.MultiIndex.from_frame(team[["match_id", "team"]])).to_numpy(),
                             index=team.index).fillna(0)
    usual = actual_spine.groupby(team["team"]).transform(lambda s: s.shift(1).ewm(alpha=FORM_ALPHA).mean())
    team["spine_vs_usual"] = (team["rating_spine"] - usual).fillna(0)
    prev_spine = g["spine_ids"].shift(1)
    team["spine_changes"] = [
        len(cur - prev) if isinstance(cur, frozenset) and isinstance(prev, frozenset) else 0
        for cur, prev in zip(team["spine_ids"], prev_spine)
    ]
    prev_hb = g["halfback_id"].shift(1)
    team["halfback_changed"] = (prev_hb.notna() & (team["halfback_id"] != prev_hb)).astype(int)
    return team[["match_id", "team"] + team_features()]


def ladder_features(m):
    """Ladder position and finals contention before each regular-season round, from results of earlier
    rounds only: 2 points a win, 1 a draw, 2 a bye (rounds without a game), ranked by points then points
    difference. A team is out of contention when, winning every remaining round, it couldn't reach the
    points of the team currently 8th. Finals games get 0 for both (ladder no longer matters)."""
    rows = []
    for season, g in m.sort_values("start_time_utc").groupby("season"):
        teams = [t for t in TEAM_BASE if not (t == "Dolphins" and season < 2023)]
        rounds = REGULAR_ROUNDS[season]
        regular = g[~g["is_final"].astype(bool)]
        for rnd, games in regular.groupby("round"):
            start = games["start_time_utc"].min()
            done = regular[(regular["start_time_utc"] < start) & regular["home_score"].notna()]
            table = pd.DataFrame(0.0, index=teams, columns=["played", "points", "diff"])
            for side, opp in (("home", "away"), ("away", "home")):
                pf, pa = done[f"{side}_score"], done[f"{opp}_score"]
                pts = np.where(pf > pa, 2, np.where(pf == pa, 1, 0))
                agg = pd.DataFrame({"team": done[f"{side}_team"], "played": 1, "points": pts, "diff": pf - pa})
                table = table.add(agg.groupby("team")[["played", "points", "diff"]].sum(), fill_value=0)
            table = table.loc[teams]
            byes = (rnd - 1) - table["played"]
            table["points"] = table["points"] + 2 * byes.clip(lower=0)
            order = table.sort_values(["points", "diff"], ascending=False, kind="stable")
            pos = pd.Series(np.arange(1, len(order) + 1), index=order.index)
            cutoff = order["points"].iloc[FINALS_PLACES - 1]
            max_points = table["points"] + 2 * (rounds - (rnd - 1))
            out = (max_points < cutoff).astype(int)
            for r in games.itertuples():
                rows.append({"match_id": r.match_id, "home_ladder_pos": pos[r.home_team], "away_ladder_pos": pos[r.away_team],
                             "home_out_of_contention": out[r.home_team], "away_out_of_contention": out[r.away_team]})
    lad = pd.DataFrame(rows).set_index("match_id")
    res = pd.DataFrame({"diff_ladder_pos": lad["home_ladder_pos"] - lad["away_ladder_pos"],
                        "diff_out_of_contention": lad["home_out_of_contention"] - lad["away_out_of_contention"]})
    return res.reindex(m["match_id"]).fillna(0).reset_index()


def build_features(matches, team_stats, players, odds, origin, elo_params, reserve=None, pre_kickoff=None):
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
    m = m.merge(team_ratings(odds)[["odds_id", "team_margin"]], on="odds_id", how="left")
    if EXPERIMENTAL:
        m = m.merge(team_total_ratings(odds), on="odds_id", how="left")

    long = add_team_form(team_long(m, team_stats))
    travel_cols = ["travel_km", "tz_change"] if EXPERIMENTAL else []
    side_cols = ["n_hist", "rest_days", "short_turnaround", "after_bye", "travel"] + travel_cols \
        + [f"form_{s}" for s in FORM_STATS]
    long = long.merge(player_team_features(m, players, origin, reserve, pre_kickoff), on=["match_id", "team"], how="left")
    side_cols += team_features()

    for side, is_home in (("home", True), ("away", False)):
        part = long[long["is_home"] == is_home][["match_id"] + side_cols]
        m = m.merge(part.rename(columns={c: f"{side}_{c}" for c in side_cols}), on="match_id", how="left")

    diff_cols = ["rest_days", "short_turnaround", "after_bye"] + travel_cols \
        + [f"form_{s}" for s in FORM_STATS] + team_features()
    m = pd.concat([m, pd.DataFrame({f"diff_{c}": m[f"home_{c}"] - m[f"away_{c}"] for c in diff_cols})], axis=1)
    m["home_travel"] = m["home_travel"].astype(int)
    m["away_travel"] = m["away_travel"].astype(int)
    m["neutral"] = m["neutral"].astype(int)
    m["away_at_ground"] = m["away_at_ground"].astype(int)
    m["is_final"] = m["is_final"].astype(int)
    m = m.copy()  # de-fragment after the many merges above
    origin_games = pd.to_datetime(origin["start_time_utc"], utc=True).drop_duplicates().tolist()
    window = pd.Timedelta(days=ORIGIN_WINDOW_DAYS)
    m["origin_period"] = [int(any(abs(t - g) <= window for g in origin_games)) for t in m["start_time_utc"]]
    # Rain or a wet ground, as recorded on the day. Predictions are made just before kickoff, when
    # this is mostly known; rain that only starts during the game is the remaining risk.
    if EXPERIMENTAL:
        m = m.merge(ladder_features(m), on="match_id", how="left")
        # Kickoff slot in Sydney time (Saturday is the baseline; Monday/Tuesday games are rare).
        local = m["start_time_utc"].dt.tz_convert("Australia/Sydney")
        m["night_game"] = (local.dt.hour >= 18).astype(int)
        for day in ("Thursday", "Friday", "Sunday"):
            m[f"kickoff_{day.lower()}"] = (local.dt.day_name() == day).astype(int)
    m["wet_conditions"] = (m["ground_conditions"].isin(WET_GROUNDS)
                           | m["weather"].fillna("").str.contains("Rain|Showers")).astype(int)
    # Expected points of the match relative to average, from both teams' attack and defence ratings.
    m["rapm_points"] = m[["home_rapm_attack", "away_rapm_attack", "home_rapm_defence", "away_rapm_defence"]].sum(axis=1)
    m["elo_logit"] = logit(m["elo_prob"])
    m["open_logit"] = logit(m["p_open"])
    m["bluebet"] = (m["bookmaker"] == "BlueBet").astype(int)
    m["open_logit_bluebet"] = m["open_logit"] * m["bluebet"]

    m["margin"] = m["home_score"] - m["away_score"]
    m["total"] = m["home_score"] + m["away_score"]
    m["home_win"] = (m["margin"] > 0).astype(int)
    m["is_draw"] = m["margin"] == 0
    m["min_hist"] = m[["home_n_hist", "away_n_hist"]].min(axis=1)
    if pre_kickoff is not None:  # both teams' line-ups come from a pre-kickoff list
        teams_listed = pre_kickoff.groupby("match_id")["team"].nunique()
        m["pre_kickoff_list"] = m["match_id"].map(teams_listed).eq(2).astype(int)

    keep = ["match_id", "season", "round", "round_title", "start_time_utc", "home_team", "away_team",
            "venue", "home_score", "away_score", "margin", "total", "home_win", "is_draw", "min_hist",
            "elo_prob", "bookmaker", "p_open", "p_close", "close_ok", "p_avg", "close_line", "close_total",
            "data_issue"] + (["pre_kickoff_list"] if pre_kickoff is not None else [])
    return m[keep + [f for f in feature_columns() if f not in keep]].sort_values("start_time_utc").reset_index(drop=True)


def repair_scraped_games(matches, team_stats, players, odds):
    """Fix games where nrl.com's data is incomplete, using the odds sheet's results.

    - Scores that disagree with the odds sheet (a few games are recorded as 0-0, or with a wrong
      score) are replaced, in the match and in the team stats' points.
    - Games with no player minutes recorded get the typical minutes for each named role (starter or
      interchange), so the players still count in the ratings. Their missing team stats stay
      missing (see team_long).
    Every correction is printed.
    """
    matches = matches.astype({"home_score": float, "away_score": float})
    team_stats = team_stats.astype({"points_for": float, "points_against": float})
    players = players.astype({"minutesPlayed": float})

    joined = join_odds_to_matches(matches, odds).merge(
        odds[["odds_id", "home_score", "away_score"]], on="odds_id", how="left", suffixes=("", "_odds"))
    wrong = joined[joined["home_score_odds"].notna()
                   & ((joined["home_score"] != joined["home_score_odds"])
                      | (joined["away_score"] != joined["away_score_odds"]))]
    for r in wrong.itertuples():
        print(f"  score corrected: {r.season} R{r.round} {r.home_team} v {r.away_team} "
              f"{r.home_score:.0f}-{r.away_score:.0f} -> {r.home_score_odds:.0f}-{r.away_score_odds:.0f}")
        matches.loc[matches["match_id"] == r.match_id, ["home_score", "away_score"]] = [r.home_score_odds, r.away_score_odds]
        for team, pf, pa in ((r.home_team, r.home_score_odds, r.away_score_odds),
                             (r.away_team, r.away_score_odds, r.home_score_odds)):
            row = (team_stats["match_id"] == r.match_id) & (team_stats["team"] == team)
            team_stats.loc[row, POINTS] = [pf, pa]

    no_minutes = players.groupby("match_id")["minutesPlayed"].transform("sum") == 0
    if no_minutes.any():
        named = ~players["position"].isin(NOT_NAMED)
        interchange = players["position"] == "Interchange"
        recorded = players[~no_minutes & named]
        typical = recorded.groupby(recorded["position"] == "Interchange")["minutesPlayed"].mean()
        fill = no_minutes & named
        players.loc[fill, "minutesPlayed"] = np.where(interchange[fill], typical[True], typical[False])
        print(f"  typical minutes filled in for {players.loc[no_minutes, 'match_id'].nunique()} games with none recorded "
              f"(starters {typical[False]:.0f}, interchange {typical[True]:.0f})")
    return matches, team_stats, players


def load_inputs():
    matches = pd.read_csv(PROCESSED / "matches.csv")
    matches = matches[pd.to_datetime(matches["start_time_utc"], utc=True) >= SIX_AGAIN_START]
    team_stats = pd.read_csv(PROCESSED / "team_match_stats.csv")
    team_stats = team_stats[team_stats["match_id"].isin(matches["match_id"])]
    players = pd.read_csv(PROCESSED / "player_match_stats.csv")
    players = players[players["match_id"].isin(matches["match_id"])]
    origin = pd.read_csv(PROCESSED / "origin_players.csv")
    odds = load_odds()
    matches, team_stats, players = repair_scraped_games(matches, team_stats, players, odds)
    return matches, team_stats, players, odds, origin, load_reserve()


def load_reserve():
    """Reserve-grade player stats (scrape.py --reserve), or None if they haven't been scraped."""
    if not RESERVE_FILE.exists():
        return None
    reserve = pd.read_csv(RESERVE_FILE)
    reserve["start_time_utc"] = pd.to_datetime(reserve["start_time_utc"], utc=True)
    return reserve


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--experimental", action="store_true", help="also build the tested-but-unused features")
    parser.add_argument("--pre-kickoff", action="store_true",
                        help="describe each game by its pre-kickoff team list where there is one (teamlists.py) "
                             "-> features_pre_kickoff.csv")
    args = parser.parse_args()
    EXPERIMENTAL = args.experimental
    matches, team_stats, players, odds, origin, reserve = load_inputs()
    pre = pd.read_csv(PRE_KICKOFF_FILE) if args.pre_kickoff else None
    feats = build_features(matches, team_stats, players, odds, origin, elo_params=load_params(odds), reserve=reserve,
                           pre_kickoff=pre)
    out = "features_pre_kickoff.csv" if args.pre_kickoff else "features.csv"
    feats.to_csv(PROCESSED / out, index=False)
    print(f"wrote {out}: {feats.shape}")
    usable = feats[(feats["min_hist"] >= MIN_HISTORY) & ~feats["is_draw"]]
    print("usable games per season:", usable.groupby("season").size().to_dict())
    print(usable[feature_columns()].describe().T[["mean", "std", "min", "max"]].round(2))
