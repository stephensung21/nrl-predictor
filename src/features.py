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
from scipy.linalg import cho_factor, cho_solve

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
    "origin_backup", "origin_out", "rapm_attack", "rapm_defence",
]

SHORT_TURNAROUND_DAYS = 6   # under 6 days since the last game (e.g. Sunday -> Friday)
BYE_GAP_DAYS = 11           # 11+ days since the last game in the same season: coming off a bye
ORIGIN_WINDOW_DAYS = 7      # an Origin game within this many days of the match

RAPM_ALPHA = 300.0          # ridge penalty on player plus-minus ratings (chosen on 2022-24 CV)
RAPM_HALF_LIFE_DAYS = 90    # a game 90 days old counts half as much
MARGIN_CAP = 40             # cap blowouts so one game can't dominate a rating
RAPM_BENCH_WEIGHT = True    # weight players by minutes (past games) / typical role minutes (prediction)
RAPM_STATS_PRIOR = False    # deviations from a fantasy-points estimate: worse on 2022-24 CV, so off
RAPM_PRIOR_PENALTY = 1.0    # light penalty on the stats-prior coefficient

FEATURE_GROUPS = {
    "elo": ["elo_logit"],
    "form": [f"diff_form_{s}" for s in FORM_STATS],
    "context": ["diff_rest_days", "home_travel", "away_travel", "neutral", "away_at_ground", "is_final",
                "diff_short_turnaround", "diff_after_bye", "origin_period"],
    "player": [f"diff_{f}" for f in PLAYER_TEAM_FEATURES] + ["rapm_points"],
    "odds": ["open_logit", "open_line", "open_total"],
}

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


def rapm_features(matches, players, alpha=None, half_life=None, bench_weight=None, stats_prior=None):
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

    kickoff = games["start_time_utc"]
    fit, block, out = None, None, []
    recent = defaultdict(lambda: deque(maxlen=USUAL_WINDOW))
    for g in games.itertuples():
        if (g.season, g.round) != block:  # new round (or a postponed game): refit on earlier results
            block = (g.season, g.round)
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

        def value(entries, kind):
            if fit is None:
                return 0.0
            coef, gamma = fit[kind]
            s_start, s_bench = fit["share"]
            return float(sum((s_start if st else s_bench) * (coef[j] + gamma * rt) for j, st, rt in entries))

        for team in (g.home_team, g.away_team):
            lineup, prev = lineups.get((g.match_id, team), []), recent[team]
            latest = {e[0]: e for lineup_prev in prev for e in lineup_prev}  # most recent entry per player
            counts = Counter(e[0] for lineup_prev in prev for e in lineup_prev)
            missing = [latest[j] for j, k in counts.items() if k >= USUAL_MIN and j not in {e[0] for e in lineup}]
            total = value(lineup, "margin")
            out.append({"match_id": g.match_id, "team": team, "rapm_total": total,
                        "rapm_vs_usual": total - (np.mean([value(l, "margin") for l in prev]) if prev else total),
                        "rapm_missing": value(missing, "margin"),
                        "rapm_attack": value(lineup, "attack"), "rapm_defence": value(lineup, "defence")})
        for team in (g.home_team, g.away_team):
            recent[team].append(lineups.get((g.match_id, team), []))
    return pd.DataFrame(out).set_index(["match_id", "team"])


def player_team_features(matches, players, origin):
    """Rate every named player before each match, then aggregate the named 17 to team level."""
    p = players.merge(matches[["match_id", "start_time_utc"]], on="match_id", how="left")
    p["pos_group"] = p["position"].map(POS_GROUP).fillna("bench")
    p["fantasy"] = p["fantasyPointsTotal"].astype(float)
    history, group_avgs = player_history(p)

    p = p.join(rate_players(p[["player_id", "pos_group", "start_time_utc"]], history, group_avgs))

    # Line-up: the named 17 (known before kickoff), whether or not each player got minutes.
    named = p[~p["position"].isin(NOT_NAMED)].sort_values(["start_time_utc", "match_id", "player_id"])

    team = named.pivot_table(index=["match_id", "team"], columns="pos_group", values="rating",
                             aggfunc="sum", fill_value=0)
    team.columns = [f"rating_{c}" for c in team.columns]
    team["rating_total"] = team.sum(axis=1)
    team["rookies"] = named.assign(r=named["n_prior"] < ROOKIE_GAMES).groupby(["match_id", "team"])["r"].sum()
    team["spine_ids"] = named[named["pos_group"] == "spine"].groupby(["match_id", "team"])["player_id"].agg(frozenset)
    team["halfback_id"] = named[named["position"] == "Halfback"].groupby(["match_id", "team"])["player_id"].first()
    team = team.join(lineup_changes(named, history, group_avgs, origin_squads(origin)))
    team = team.join(rapm_features(matches, p))
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
    # Expected points of the match relative to average, from both teams' attack and defence ratings.
    m["rapm_points"] = m[["home_rapm_attack", "away_rapm_attack", "home_rapm_defence", "away_rapm_defence"]].sum(axis=1)
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
    matches = matches[pd.to_datetime(matches["start_time_utc"], utc=True) >= SIX_AGAIN_START]
    team_stats = pd.read_csv(PROCESSED / "team_match_stats.csv")
    team_stats = team_stats[team_stats["match_id"].isin(matches["match_id"])]
    players = pd.read_csv(PROCESSED / "player_match_stats.csv")
    players = players[players["match_id"].isin(matches["match_id"])]
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
