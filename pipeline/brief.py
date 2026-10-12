"""
Match briefs (PLAN_WEB.md §7.4): one structured fact pack per prediction, which every LLM-written text
(previews now; later full match summaries, post-mortems and the chat) is written from and checked
against. Code decides the facts, Claude only words them.

A brief is assembled when a game is predicted, from the same inputs, and frozen with that prediction
(one per run and game). It is built from sections, each a function returning its facts or None when
the data isn't there; a missing section is left out, never filled with zeros. Code does every
calculation (differences, percentages, which side a driver favours), so the text never needs to.

To add a data source: write a section function, add it to SECTIONS and bump BRIEF_VERSION.
"""

import json

import numpy as np
import pandas as pd

from common import load_matches, results_and_odds
import explain
from elo import load_params, run_elo
from features import NOT_NAMED
from ingest import PROCESSED, load_odds
import predict

BRIEF_VERSION = "2"  # 2: the star-absence driver names its players
SYDNEY = "Australia/Sydney"
TOP_DRIVERS = 3  # features listed under each driver group


def r1(x):
    return None if x is None or pd.isna(x) else round(float(x), 1)


def pct(p):
    return None if p is None or pd.isna(p) else int(round(100 * float(p)))


def favours(points, g):
    """The team a home-positive number favours (None for a zero)."""
    return g["home_team"] if points > 0 else g["away_team"] if points < 0 else None


# ---------------------------------------------------------------- sections

def prediction_section(ctx):
    p, g = ctx["pred"], ctx["game"]
    home = float(p["home_win_prob"])
    tip_home = home >= 0.5
    out = {"model_tip": p["tip"] if "tip" in p else (g["home_team"] if tip_home else g["away_team"]),
           "model_win_chance_pct": pct(max(home, 1 - home)),
           "home_win_chance_pct": pct(home),
           "predicted_score": f"{g['home_team']} {int(p['home_score'])} - {int(p['away_score'])} {g['away_team']}",
           "predicted_margin_pts": abs(r1(p["margin"])),
           "margin_favours": favours(p["margin"], g),
           "predicted_total_pts": r1(p["total"]),
           "model": p["model"],
           "model_version": p.get("model_version")}
    if p["model"] == "with odds" and not pd.isna(p.get("no_odds_home_win_prob")):
        out["no_odds_model_home_win_chance_pct"] = pct(p["no_odds_home_win_prob"])
    return out


def drivers_section(ctx):
    """What drove the prediction, in points of predicted margin, biggest first, each with the side it
    favours (explain.py). The baseline is the home side's average edge."""
    d = ctx.get("drivers")
    if d is None or d.empty:
        return None
    g = ctx["game"]
    groups = explain.by_group(d)
    base = groups.loc[groups["group"] == "baseline", "margin_pts"].sum()
    rest = groups[~groups["group"].isin(["baseline", "calibration"])].sort_values("margin_pts", key=abs,
                                                                                    ascending=False)
    out = []
    for grp in rest.itertuples():
        if abs(grp.margin_pts) < 0.05:
            continue
        feats = d[d["group"] == grp.group].assign(label=lambda x: x["feature"].map(
            lambda f: explain.FEATURE_LABELS.get(f, f)))
        feats = feats.groupby("label", as_index=False)["margin_pts"].sum()             .sort_values("margin_pts", key=abs, ascending=False).head(TOP_DRIVERS)
        parts = [{"input": f.label, "points": abs(r1(f.margin_pts)), "favours": favours(f.margin_pts, g)}
                 for f in feats.itertuples() if abs(f.margin_pts) >= 0.05]
        stars = star_names(d[d["group"] == grp.group])
        out.append({"driver": grp.label, "points": abs(r1(grp.margin_pts)), "favours": favours(grp.margin_pts, g),
                    **({"parts": parts} if len(parts) > 1 else {}), **({"players_out": stars} if stars else {})})
    return {"unit": "points of predicted margin",
            "home_side_average_edge_pts": r1(base),
            "drivers": out}


def star_names(rows):
    """The missing stars behind a group's star-absence rows (explain.star_players), by team."""
    if "players" not in rows.columns:
        return {}
    out = {}
    for cell in rows["players"].dropna():
        for p in json.loads(cell):
            out.setdefault(p["team"], []).append(p["name"])
    return out


def market_section(ctx):
    p, g, row = ctx["pred"], ctx["game"], ctx["row"]
    opening = row.get("p_open")
    if opening is None or pd.isna(opening):
        return None
    home = float(p["home_win_prob"])
    out = {"opening_home_win_chance_pct": pct(opening), "opening_away_win_chance_pct": pct(1 - opening),
           "market_favourite": g["home_team"] if opening >= 0.5 else g["away_team"],
           "model_minus_market_home_pct_points": pct(home) - pct(opening)}
    if not pd.isna(row.get("open_line")):
        out["opening_line_home"] = r1(row["open_line"])
    if not pd.isna(row.get("open_total")):
        out["opening_total_pts"] = r1(row["open_total"])
    latest = ctx.get("latest_price")
    if latest is not None:
        h, a = latest["home_odds"], latest["away_odds"]
        market = (1 / h) / (1 / h + 1 / a)
        out["latest_price"] = {"bookmaker": "Betr", "home_odds": round(h, 2), "away_odds": round(a, 2),
                               "home_win_chance_pct": pct(market),
                               "moved_since_opening_home_pct_points": pct(market) - pct(opening)}
    return out


def elo_section(ctx):
    e, g = ctx.get("elo"), ctx["game"]
    if e is None:
        return None
    out = {"home_win_chance_by_elo_pct": pct(ctx["row"].get("elo_prob"))}
    for side in ("home", "away"):
        t = e.get(side)
        if t:
            out[g[f"{side}_team"]] = t
    gap = e.get("gap")
    if gap is not None:
        out["rating_gap"] = abs(gap)
        out["higher_rated"] = g["home_team"] if gap > 0 else g["away_team"]
    return out


def form_section(ctx):
    g, played = ctx["game"], ctx["played"]

    def form(team):
        games = played[(played["home_team"] == team) | (played["away_team"] == team)].tail(5)
        out = []
        for r in games.itertuples():
            us, them = (r.home_score, r.away_score) if r.home_team == team else (r.away_score, r.home_score)
            opp = r.away_team if r.home_team == team else r.home_team
            out.append(f"{'W' if us > them else 'L' if us < them else 'D'} {int(us)}-{int(them)} v {opp}")
        return out

    h, a = g["home_team"], g["away_team"]
    h2h = played[((played["home_team"] == h) & (played["away_team"] == a))
                 | ((played["home_team"] == a) & (played["away_team"] == h))].tail(3)
    out = {"last_5": {h: form(h), a: form(a)},
           "last_meetings": [f"{int(r.season)}: {r.home_team} {int(r.home_score)}-{int(r.away_score)} {r.away_team}"
                             for r in h2h.itertuples()]}
    return out if any(out["last_5"].values()) or out["last_meetings"] else None


def team_news_section(ctx):
    """Each side's named 17 against its last game: who's in and who's out (names only; how much it
    matters is in the drivers)."""
    news = ctx.get("team_news")
    if not news:
        return None
    return news


def conditions_section(ctx):
    row, w = ctx["row"], ctx.get("weather")
    out = {}
    if row.get("neutral") == 1:
        out["neutral_venue"] = True
    travelling = [ctx["game"][f"{side}_team"] for side in ("home", "away") if row.get(f"{side}_travel") == 1]
    if travelling:
        out["playing_outside_home_state"] = travelling
    rest = row.get("diff_rest_days")
    if rest is not None and not pd.isna(rest) and round(abs(rest)) >= 1:
        out["extra_rest_days"] = int(round(abs(rest)))
        out["more_rested"] = favours(rest, ctx["game"])
    if w is not None:
        if bool(w.get("roofed")):
            out["weather"] = "under a roof"
        else:
            out["weather"] = {k: (None if pd.isna(w.get(k)) else w.get(k)) for k in
                              ("kind", "conditions", "temp_c", "rain_mm", "rain_chance", "gust_kmh")}
    return out or None


SECTIONS = {"prediction": prediction_section, "drivers": drivers_section, "market": market_section,
            "elo": elo_section, "form": form_section, "team_news": team_news_section,
            "conditions": conditions_section}


# ---------------------------------------------------------------- shared lookups

def elo_before(games, odds=None):
    """Each team's Elo rating going into each game (by match id), its change over its last five games
    and over the season so far: from every result before the game's date (the odds sheet, plus scraped
    results it doesn't have yet when called with common.results_and_odds)."""
    odds = load_odds() if odds is None else odds
    params = load_params(odds)
    hist = odds.join(run_elo(odds, **params, after=True))
    long = pd.concat([
        hist[["date", "season", "home_team", "elo_home", "elo_home_after", "home_score"]].set_axis(
            ["date", "season", "team", "before", "after", "score"], axis=1),
        hist[["date", "season", "away_team", "elo_away", "elo_away_after", "away_score"]].set_axis(
            ["date", "season", "team", "before", "after", "score"], axis=1)]).sort_values("date", kind="stable")
    long = long[long["score"].notna()]
    out = {}
    for g in games.itertuples():
        day = pd.Timestamp(g.start_time_utc).tz_convert(SYDNEY).tz_localize(None).normalize()
        teams = {}
        for side, team in (("home", g.home_team), ("away", g.away_team)):
            t = long[(long["team"] == team) & (long["date"] < day)]
            if t.empty:
                continue
            now = t["after"].iloc[-1]
            if t["season"].iloc[-1] != g.season:  # off-season pull towards 1500, as run_elo does
                now += params["regress"] * (1500 - now)
            this = t[t["season"] == g.season]
            teams[side] = {"rating": int(round(now)),
                           "change_last_5_games": int(round(now - t["before"].iloc[-5:].iloc[0])) if len(t) >= 5 else None,
                           "change_this_season": int(round(now - this["before"].iloc[0])) if len(this) else 0}
        if len(teams) == 2:
            teams["gap"] = teams["home"]["rating"] - teams["away"]["rating"]
        out[g.match_id] = teams
    return out


def team_news(fixtures, lists, players=None):
    """Per game and team: the named 17's ins and outs against the team's previous game."""
    players = pd.read_csv(PROCESSED / "player_match_stats.csv", usecols=["match_id", "team", "player_id",
                                                                           "player_name", "position"]) \
        if players is None else players
    named = predict.named_17(lists)
    matches = load_matches()[["match_id", "start_time_utc"]]
    played = players[~players["position"].isin(NOT_NAMED)].merge(matches, on="match_id")
    played["start_time_utc"] = pd.to_datetime(played["start_time_utc"], utc=True)
    out = {}
    for g in fixtures.itertuples():
        kick = pd.Timestamp(g.start_time_utc)
        game = {}
        for team in (g.home_team, g.away_team):
            now = named[(named["match_id"] == g.match_id) & (named["team"] == team)]
            before = played[(played["team"] == team) & (played["start_time_utc"] < kick)]
            if now.empty or before.empty:
                continue
            last = before[before["match_id"] == before.sort_values("start_time_utc")["match_id"].iloc[-1]]
            name = dict(zip(last["player_id"], last["player_name"])) | dict(zip(now["player_id"], now["player_name"]))
            ins, outs = set(now["player_id"]) - set(last["player_id"]), set(last["player_id"]) - set(now["player_id"])
            game[team] = {"in": sorted(name[p] for p in ins), "out": sorted(name[p] for p in outs)}
        out[g.match_id] = game
    return out


def latest_prices(records, now, fixtures):
    """Betr's latest head-to-head price before `now` for each fixture, turned to nrl.com's home team."""
    import paper
    snaps = records.odds_snapshots()
    if snaps is None or snaps.empty:
        return {}
    s = paper.oriented_snapshots(snaps, fixtures)
    s = s[(s["captured_at"] <= now) & s["home_odds"].notna() & s["away_odds"].notna()]
    last = s.sort_values("captured_at").groupby("match_id").tail(1)
    return {int(r.match_id): {"home_odds": float(r.home_odds), "away_odds": float(r.away_odds)}
            for r in last.itertuples()}


def latest_weather(records, now):
    w = records.weather()
    if w.empty:
        return {}
    w = w[pd.to_datetime(w["fetched_at"], utc=True) <= now]
    return {int(r["match_id"]): r for r in w.drop_duplicates("match_id", keep="last").to_dict("records")}


# ---------------------------------------------------------------- building

def build(pred, row, drivers=None, played=None, elo=None, news=None, latest_price=None, weather=None):
    """One brief from one prediction (a predictions-record row) and its model row (the features)."""
    game = {"home_team": pred["home_team"], "away_team": pred["away_team"]}
    kick = pd.Timestamp(pred["start_time_utc"])
    ctx = {"pred": pred, "row": row, "game": game, "drivers": drivers, "elo": elo, "team_news": news,
           "latest_price": latest_price, "weather": weather,
           "played": pd.DataFrame(columns=["home_team", "away_team"]) if played is None else played}
    sections = {}
    for name, fn in SECTIONS.items():
        facts = fn(ctx)
        if facts is not None:
            sections[name] = facts
    return {"brief_version": BRIEF_VERSION, "run_id": pred.get("run_id"), "match_id": int(pred["match_id"]),
            "season": int(pred["season"]), "round": int(pred["round"]),
            "created_at": str(pred.get("created_at")),
            "game": {**game, "kickoff_sydney": kick.tz_convert(SYDNEY).strftime("%a %d %b %Y, %I:%M %p")},
            "sections": sections}


def build_round(out, rows, lists, drivers, fixtures, records=None, now=None):
    """Briefs for a run's predictions (`out` as recorded, `rows` the model rows by match id)."""
    matches = load_matches()
    kickoffs = pd.to_datetime(matches["start_time_utc"], utc=True)
    elo = elo_before(out, results_and_odds(records))
    news = team_news(out, lists)
    prices = latest_prices(records, now, fixtures) if records is not None else {}
    weather = latest_weather(records, now) if records is not None else {}
    briefs = []
    for pred in out.to_dict("records"):
        mid = int(pred["match_id"])
        kick = pd.Timestamp(pred["start_time_utc"])
        played = matches[matches["home_score"].notna() & (kickoffs < kick)]
        briefs.append(build(pred, rows.loc[mid].to_dict(), drivers[drivers["match_id"] == mid], played,
                            elo.get(mid), news.get(mid), prices.get(mid), weather.get(mid)))
    return briefs


# ---------------------------------------------------------------- the grounding check

def numbers(text):
    """Every number written in a text, as floats (thousands separators and signs dropped)."""
    import re
    return [float(n.replace(",", "")) for n in re.findall(r"\d[\d,]*(?:\.\d+)?", text)]


def brief_numbers(brief):
    """Every number a text written from this brief may use: each value in it (and inside its strings,
    e.g. "W 24-16"), rounded to whole numbers and one decimal as well."""
    found = set()

    def walk(x):
        if isinstance(x, dict):
            for k, v in x.items():
                walk(k)
                walk(v)
        elif isinstance(x, (list, tuple)):
            for v in x:
                walk(v)
        elif isinstance(x, bool) or x is None:
            return
        elif isinstance(x, (int, float, np.integer, np.floating)):
            if not pd.isna(x):
                v = abs(float(x))
                found.update({v, round(v), round(v, 1), float(int(v))})
        elif isinstance(x, str):
            for v in numbers(x):
                found.update({v, round(v), round(v, 1)})

    walk(brief)
    return found


def ungrounded(text, brief):
    """Numbers in the text that the brief doesn't contain (the grounding check, PLAN_WEB.md §7.4)."""
    allowed = brief_numbers(brief)
    return [n for n in numbers(text) if n not in allowed]
