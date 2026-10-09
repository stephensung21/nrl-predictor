"""
Build the leakage-safe, one-row-per-match feature table.

Every feature for a match uses only information from earlier matches, plus things known
before kickoff (the published draw, the final team list, opening odds). Team features are
expressed as home minus away differences.

Usage: python src/features.py   ->  data/processed/features.csv
"""

from collections import Counter, defaultdict, deque
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import sparse
from scipy.sparse.linalg import spsolve

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

NOT_NAMED = {"Replacement", "Reserve"}  # 18th/19th players: outside the named 17
USUAL_WINDOW, USUAL_MIN = 5, 3          # a "usual" player was named in 3 of the team's last 5 games
RETURNING_GAMES = 10                    # experienced player back after missing the previous game

PLAYER_TEAM_FEATURES = [
    "rating_total", "rating_spine", "rating_forwards", "rating_backs", "rating_bench",
    "spine_vs_usual", "spine_changes", "halfback_changed", "rookies",
    "missing_usual", "missing_usual_rating", "ins_forwards", "ins_backs", "ins_bench",
    "returning", "kicker_changed", "rapm_total", "rapm_vs_usual", "rapm_missing",
    "origin_backup", "origin_out",
]

SHORT_TURNAROUND_DAYS = 6   # under 6 days since the last game (e.g. Sunday -> Friday)
BYE_GAP_DAYS = 11           # 11+ days since the last game in the same season: coming off a bye
ORIGIN_WINDOW_DAYS = 7      # an Origin game within this many days of the match

RAPM_ALPHA = 300.0          # ridge penalty on player plus-minus ratings (chosen on 2022-24 CV)
RAPM_HALF_LIFE_DAYS = 90    # a game 90 days old counts half as much
MARGIN_CAP = 40             # cap blowouts so one game can't dominate a rating

FEATURE_GROUPS = {
    "elo": ["elo_logit"],
    "form": [f"diff_form_{s}" for s in FORM_STATS],
    "context": ["diff_rest_days", "home_travel", "away_travel", "neutral", "away_at_ground", "is_final",
                "diff_short_turnaround", "diff_after_bye", "origin_period"],
    "player": [f"diff_{f}" for f in PLAYER_TEAM_FEATURES],
    "odds": ["open_logit", "open_line", "open_total"],
}

MIN_HISTORY = 5  # both teams need this many earlier games in the scraped data (2021 warm-up)


def logit(p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def team_long(matches, team_stats):
    """One row per team per match, in kickoff order, with rest days, turnaround, byes and travel."""
    long = team_stats.merge(
        matches[["match_id", "start_time_utc", "venue_city"]], on="match_id", how="left")
    long = long.sort_values(["start_time_utc", "match_id", "is_home"], ascending=[True, True, False])
    # Stats the site leaves out when they are zero.
    long[FORM_STATS] = long[FORM_STATS].fillna(0)

    gap = long.groupby("team")["start_time_utc"].diff().dt.total_seconds() / 86400
    long["rest_days"] = gap.clip(upper=14).fillna(14)
    long["short_turnaround"] = (gap < SHORT_TURNAROUND_DAYS).astype(int)
    same_season = long.groupby("team")["season"].shift(1) == long["season"]
    long["after_bye"] = (same_season & (gap >= BYE_GAP_DAYS)).astype(int)
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
    return q.set_index("_row")[["rating", "n_prior"]].reindex(query.index)


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


def weighted_ridge(X, y, w, alpha):
    """Exact ridge solution (X'WX + alpha I) b = X'Wy, so players with no games get exactly 0."""
    XtW = X.T.multiply(w)
    A = (XtW @ X + alpha * sparse.identity(X.shape[1])).tocsc()
    return spsolve(A, XtW @ y)


def rapm_features(matches, named, alpha=None, half_life=None):
    """Regularised plus-minus ratings from the named 17s, refitted before each round on earlier games.

    Each game is one row: +1 for every named home player, -1 for every named away player, plus a
    home-advantage column, with the capped margin as the target. Ridge shrinks every player towards
    zero (average), so new or rarely seen players stay near average; older games are down-weighted.
    Returns, per team and match: the named 17's total rating, that total minus the team's usual
    total (mean of its previous USUAL_WINDOW line-ups, valued with the same ratings), and the
    total rating of usual players missing from the line-up.
    """
    alpha = RAPM_ALPHA if alpha is None else alpha
    half_life = RAPM_HALF_LIFE_DAYS if half_life is None else half_life
    games = matches.sort_values("start_time_utc").reset_index(drop=True)
    lineups = named.groupby(["match_id", "team"])["player_id"].agg(list).to_dict()
    index = {pid: i for i, pid in enumerate(named["player_id"].unique())}
    n_players = len(index)

    rows, cols, vals = [], [], []
    for r, g in enumerate(games.itertuples()):
        for team, sign in ((g.home_team, 1.0), (g.away_team, -1.0)):
            for pid in lineups.get((g.match_id, team), []):
                rows.append(r), cols.append(index[pid]), vals.append(sign)
        rows.append(r), cols.append(n_players), vals.append(1.0)  # home advantage
    X = sparse.csr_matrix((vals, (rows, cols)), shape=(len(games), n_players + 1))
    y = (games["home_score"] - games["away_score"]).clip(-MARGIN_CAP, MARGIN_CAP).to_numpy(dtype=float)
    kickoff = games["start_time_utc"]

    coef, block, out = np.zeros(n_players + 1), None, []
    recent = defaultdict(lambda: deque(maxlen=USUAL_WINDOW))
    for g in games.itertuples():
        if (g.season, g.round) != block:  # new round (or a postponed game): refit on earlier results
            block = (g.season, g.round)
            train = ((kickoff < g.start_time_utc) & ~np.isnan(y)).to_numpy()
            if train.sum() >= 20:
                age = (g.start_time_utc - kickoff[train]).dt.days.to_numpy()
                coef = weighted_ridge(X[train], y[train], 0.5 ** (age / half_life), alpha)

        def value(ids):
            return float(sum(coef[index[p]] for p in ids))

        for team in (g.home_team, g.away_team):
            ids, prev = lineups.get((g.match_id, team), []), recent[team]
            total = value(ids)
            counts = Counter(p for lineup in prev for p in lineup)
            missing = {p for p, c in counts.items() if c >= USUAL_MIN} - set(ids)
            out.append({"match_id": g.match_id, "team": team, "rapm_total": total,
                        "rapm_vs_usual": total - (np.mean([value(l) for l in prev]) if prev else total),
                        "rapm_missing": value(missing)})
        for team in (g.home_team, g.away_team):
            recent[team].append(lineups.get((g.match_id, team), []))
    return pd.DataFrame(out).set_index(["match_id", "team"])


def player_team_features(matches, players, origin):
    """Rate every named player before each match, then aggregate the named 17 to team level."""
    p = players.merge(matches[["match_id", "start_time_utc"]], on="match_id", how="left")
    p["pos_group"] = p["position"].map(POS_GROUP).fillna("bench")
    p["fantasy"] = p["fantasyPointsTotal"].astype(float)
    history, group_avgs = player_history(p)

    # Line-up: the named 17 (known before kickoff), whether or not each player got minutes.
    named = p[~p["position"].isin(NOT_NAMED)].sort_values(["start_time_utc", "match_id", "player_id"])
    named = named.join(rate_players(named[["player_id", "pos_group", "start_time_utc"]], history, group_avgs))

    team = named.pivot_table(index=["match_id", "team"], columns="pos_group", values="rating",
                             aggfunc="sum", fill_value=0)
    team.columns = [f"rating_{c}" for c in team.columns]
    team["rating_total"] = team.sum(axis=1)
    team["rookies"] = named.assign(r=named["n_prior"] < ROOKIE_GAMES).groupby(["match_id", "team"])["r"].sum()
    team["spine_ids"] = named[named["pos_group"] == "spine"].groupby(["match_id", "team"])["player_id"].agg(frozenset)
    team["halfback_id"] = named[named["position"] == "Halfback"].groupby(["match_id", "team"])["player_id"].first()
    team = team.join(lineup_changes(named, history, group_avgs, origin_squads(origin)))
    team = team.join(rapm_features(matches, named))
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


def build_features(matches, team_stats, players, odds, origin, elo_params):
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
    side_cols = ["n_hist", "rest_days", "short_turnaround", "after_bye", "travel"] + [f"form_{s}" for s in FORM_STATS]
    long = long.merge(player_team_features(m, players, origin), on=["match_id", "team"], how="left")
    side_cols += PLAYER_TEAM_FEATURES

    for side, is_home in (("home", True), ("away", False)):
        part = long[long["is_home"] == is_home][["match_id"] + side_cols]
        m = m.merge(part.rename(columns={c: f"{side}_{c}" for c in side_cols}), on="match_id", how="left")

    for c in ["rest_days", "short_turnaround", "after_bye"] + [f"form_{s}" for s in FORM_STATS] + PLAYER_TEAM_FEATURES:
        m[f"diff_{c}"] = m[f"home_{c}"] - m[f"away_{c}"]
    m["home_travel"] = m["home_travel"].astype(int)
    m["away_travel"] = m["away_travel"].astype(int)
    m["neutral"] = m["neutral"].astype(int)
    m["away_at_ground"] = m["away_at_ground"].astype(int)
    m["is_final"] = m["is_final"].astype(int)
    m = m.copy()  # de-fragment after the many merges above
    origin_games = pd.to_datetime(origin["start_time_utc"], utc=True).drop_duplicates().tolist()
    window = pd.Timedelta(days=ORIGIN_WINDOW_DAYS)
    m["origin_period"] = [int(any(abs(t - g) <= window for g in origin_games)) for t in m["start_time_utc"]]
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
    origin = pd.read_csv(PROCESSED / "origin_players.csv")
    return matches, team_stats, players, load_odds(), origin


if __name__ == "__main__":
    matches, team_stats, players, odds, origin = load_inputs()
    feats = build_features(matches, team_stats, players, odds, origin, elo_params=load_params(odds))
    feats.to_csv(PROCESSED / "features.csv", index=False)
    print(f"wrote features.csv: {feats.shape}")
    usable = feats[(feats["min_hist"] >= MIN_HISTORY) & ~feats["is_draw"]]
    print("usable games per season:", usable.groupby("season").size().to_dict())
    print(usable[[f for g in FEATURE_GROUPS.values() for f in g]].describe().T[["mean", "std", "min", "max"]].round(2))
