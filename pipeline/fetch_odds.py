"""
Betr's NRL prices from The Odds API (PLAN_WEB.md §1.2 step 4, §1.6).

The with-odds models were trained on the aussportsbetting.com sheet's opening prices, from BlueBet
since April 2024. BlueBet took over Betr in July 2024 and now trades as Betr on BlueBet's own
platform (bluebet.com.au redirects to betr.com.au), so Betr (`betr_au`) is the same book. The sheet
only updates now and then, so the pipeline takes Betr's prices from The Odds API: every fetch is kept
as a timestamped snapshot, and a game's opening price is the first snapshot before kickoff that has
it. The sheet is still used for past games and, when it has a game, for its opening price.

One call (head to head, line and total from one bookmaker) costs 3 credits and returns every NRL game
listed; a call that returns no games costs nothing. The free plan has 500 credits a month, and each
live pipeline job fetches once, plus an odds-only job on Sunday night when the next round's markets
open (13 a week, ~170 credits a month). The fetch is skipped while
the last call left fewer than MIN_CREDITS.

Snapshots go in data/pipeline/live/<season>/odds_snapshots.csv (committed with the other records);
each raw response is also saved in data/raw/odds_api/<season>/.

Needs ODDS_API_KEY in the environment or in a .env file at the repo root (ignored by git).

Usage:
    python pipeline/fetch_odds.py      # fetch once and print each game's opening and latest prices
"""

import json
import os

import numpy as np
import pandas as pd
import requests

from common import ROOT, Records
import config
from ingest import TEAM_STATE, two_way_prob

API = "https://api.the-odds-api.com/v4/sports/rugbyleague_nrl/odds"
BOOKMAKER = "betr_au"
MIN_CREDITS = 50
CREDITS_RECHECK = pd.Timedelta(days=7)  # try again after this long: the monthly quota may have reset
RAW = ROOT / "data" / "raw" / "odds_api"
MARKETS = {"h2h": ["home_odds", "away_odds"],
           "line": ["home_line", "home_line_odds", "away_line_odds"],
           "total": ["total", "over_odds", "under_odds"]}
SNAPSHOT_COLS = ["captured_at", "event_id", "commence_time", "home_team", "away_team", "bookmaker",
                 "last_update", *[c for cols in MARKETS.values() for c in cols], "issues"]


def api_key():
    key = os.environ.get("ODDS_API_KEY")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            name, sep, value = line.partition("=")
            if sep and name.strip() == "ODDS_API_KEY":
                key = value.strip().strip("\"'")
    return key or None


def team(name):
    """Our name for a team from its full name in the API ('Manly Warringah Sea Eagles' -> 'Sea Eagles').
    An unknown team stops the run rather than dropping its games, as in ingest.load_odds."""
    found = [t for t in TEAM_STATE if name.endswith(t)]
    if len(found) != 1:
        raise ValueError(f"Unknown team name from The Odds API: {name!r} (add it to ingest.TEAM_STATE)")
    return found[0]


# ---------------------------------------------------------------- one response -> snapshot rows

def parse(events, captured_at):
    """One row per game Betr prices, with the impossible-price check (PLAN_WEB.md note 4): a market
    that fails it is blanked and named in `issues`, so it can never become an opening price."""
    rows = []
    for e in events:
        book = next((b for b in e.get("bookmakers", []) if b["key"] == BOOKMAKER), None)
        if book is None:
            continue
        row = {"captured_at": captured_at, "event_id": e["id"], "commence_time": e["commence_time"],
               "home_team": team(e["home_team"]), "away_team": team(e["away_team"]), "bookmaker": BOOKMAKER,
               "last_update": book.get("last_update")}
        markets = {m["key"]: {o["name"]: o for o in m["outcomes"]} for m in book.get("markets", [])}
        h2h, spreads, totals = (markets.get(k, {}) for k in ("h2h", "spreads", "totals"))
        home, away = h2h.get(e["home_team"], {}), h2h.get(e["away_team"], {})
        row["home_odds"], row["away_odds"] = home.get("price"), away.get("price")
        home, away = spreads.get(e["home_team"], {}), spreads.get(e["away_team"], {})
        row["home_line"], row["home_line_odds"], row["away_line_odds"] = home.get("point"), home.get("price"), away.get("price")
        row["away_line"] = away.get("point")
        over, under = totals.get("Over", {}), totals.get("Under", {})
        row["total"], row["over_odds"], row["under_odds"] = over.get("point"), over.get("price"), under.get("price")
        row["under_total"] = under.get("point")
        rows.append(check_prices(row))
    return pd.DataFrame(rows).reindex(columns=SNAPSHOT_COLS)


def check_prices(row):
    issues = []

    def bad(market, why):
        issues.append(f"{market}: {why}")
        for c in MARKETS[market]:
            row[c] = np.nan

    for market, (a, b) in (("h2h", ("home_odds", "away_odds")), ("line", ("home_line_odds", "away_line_odds")),
                           ("total", ("over_odds", "under_odds"))):
        pa, pb = row.get(a), row.get(b)
        if pa is None or pb is None:
            if pa is not None or pb is not None:
                bad(market, "one side missing")
            else:
                for c in MARKETS[market]:
                    row[c] = np.nan
        elif min(pa, pb) <= 1:
            bad(market, f"price at or below 1 ({pa}, {pb})")
        elif 1 / pa + 1 / pb < 1:
            bad(market, f"implied probabilities add to {1 / pa + 1 / pb:.1%}")
    if pd.notna(row["home_line"]) and row.get("away_line") is not None and row["home_line"] != -row["away_line"]:
        bad("line", f"handicaps not opposite ({row['home_line']}, {row['away_line']})")
    if pd.notna(row["total"]) and row.get("under_total") is not None and row["total"] != row["under_total"]:
        bad("total", f"over and under at different totals ({row['total']}, {row['under_total']})")
    row["issues"] = "; ".join(issues)
    return row


# ---------------------------------------------------------------- snapshots -> prices per game

def game_prices(snaps):
    """Each game's opening and latest price per market, from snapshots taken before its kickoff: the
    first snapshot with a valid price is the opening one (as the sheet's 'Open' columns, which the
    with-odds models were trained on), the latest one is the closing price so far."""
    if snaps is None:
        return None
    s = snaps.copy()
    for col in ("captured_at", "commence_time"):
        s[col] = pd.to_datetime(s[col], utc=True)
    s = s[s["captured_at"] < s["commence_time"]].sort_values("captured_at")
    out = s.groupby("event_id")[["commence_time", "home_team", "away_team"]].last()
    for cols in MARKETS.values():
        valid = s.dropna(subset=cols).groupby("event_id")[cols]
        out = out.join(valid.first().add_prefix("open_")).join(valid.last().add_prefix("close_"))
    out["opened_at"] = s.dropna(subset=MARKETS["h2h"]).groupby("event_id")["captured_at"].first()
    for w in ("open", "close"):
        out[f"p_{w}"] = two_way_prob(out[f"{w}_home_odds"], out[f"{w}_away_odds"])
    return out.rename(columns={"open_home_line": "open_line", "close_home_line": "close_line"}).reset_index()


def match_events(events, fixtures):
    """nrl.com's match id for each of the API's games (event_id, commence_time, home_team,
    away_team): the same two teams and a kickoff within 36 hours. `flipped` marks games the API lists
    the other way round from nrl.com, whose prices must be turned round to nrl.com's home team."""
    fx = fixtures[["match_id", "start_time_utc", "home_team", "away_team"]].copy()
    fx["start_time_utc"] = pd.to_datetime(fx["start_time_utc"], utc=True)
    ev = events[["event_id", "commence_time", "home_team", "away_team"]].drop_duplicates("event_id").copy()
    ev["commence_time"] = pd.to_datetime(ev["commence_time"], utc=True)
    rows = []
    for e in ev.itertuples():
        near = fx[(fx["start_time_utc"] - e.commence_time).abs() <= pd.Timedelta(hours=36)]
        for flipped, home, away in ((False, e.home_team, e.away_team), (True, e.away_team, e.home_team)):
            hit = near[(near["home_team"] == home) & (near["away_team"] == away)]
            if len(hit):
                rows.append({"event_id": e.event_id, "match_id": int(hit["match_id"].iloc[0]), "flipped": flipped})
                break
    return pd.DataFrame(rows, columns=["event_id", "match_id", "flipped"])


def turn_round(snaps, flipped):
    """Snapshot prices from the other team's side: home and away swapped, the line negated."""
    s = snaps.copy()
    f = flipped.to_numpy(bool)
    s.loc[f, ["home_odds", "away_odds"]] = snaps.loc[f, ["away_odds", "home_odds"]].to_numpy()
    s.loc[f, ["home_line_odds", "away_line_odds"]] = snaps.loc[f, ["away_line_odds", "home_line_odds"]].to_numpy()
    s.loc[f, "home_line"] = -snaps.loc[f, "home_line"]
    return s


def for_fixtures(fixtures, prices):
    """The opening prices (p_open, open_line, open_total) for each fixture, by match id, turned round
    to nrl.com's home team where the API lists the game the other way round (match_events)."""
    cols = ["p_open", "open_line", "open_total"]
    if prices is None or prices.empty:
        return pd.DataFrame(columns=cols, index=pd.Index([], name="match_id"))
    m = prices.merge(match_events(prices, fixtures), on="event_id").drop_duplicates("match_id")
    out = pd.DataFrame({"p_open": np.where(m["flipped"], 1 - m["p_open"], m["p_open"]),
                        "open_line": np.where(m["flipped"], -m["open_line"], m["open_line"]),
                        "open_total": m["open_total"].to_numpy()}, index=pd.Index(m["match_id"], name="match_id"))
    return out.astype(float)


# ---------------------------------------------------------------- fetching

def fetch(key):
    """One call for every NRL game Betr prices. Returns the games and the credits left. Errors never
    carry the request URL, which holds the key (they end up in the committed run log)."""
    try:
        r = requests.get(API, params={"apiKey": key, "bookmakers": BOOKMAKER, "markets": "h2h,spreads,totals",
                                      "oddsFormat": "decimal", "dateFormat": "iso"}, timeout=30)
    except requests.RequestException as ex:
        raise RuntimeError(f"The Odds API request failed: {type(ex).__name__}") from None
    if not r.ok:
        raise RuntimeError(f"The Odds API returned {r.status_code}: {r.text[:200].replace(key, '***')}")
    remaining = r.headers.get("x-requests-remaining")
    return r.json(), (float(remaining) if remaining is not None else None)


def last_credits(records, now):
    """The credits left after the last fetch, if it was recent enough to trust."""
    for run in reversed(records.runs()):
        odds = run.get("odds") or {}
        if odds.get("credits_remaining") is not None:
            if now - pd.Timestamp(run["as_of"]) <= CREDITS_RECHECK:
                return odds["credits_remaining"]
            return None
    return None


def record_snapshot(records, now):
    """Fetch Betr's prices once and append them to the season's snapshots. Returns what happened, for
    the run record. A missing key or low credits is a skip, not an error; a failed call raises."""
    key = api_key()
    if not key:
        return {"status": "skipped", "reason": "no ODDS_API_KEY"}
    left = last_credits(records, now)
    if left is not None and left < MIN_CREDITS:
        return {"status": "skipped", "reason": f"only {left:.0f} credits left (minimum {MIN_CREDITS})"}
    events, left = fetch(key)
    raw = RAW / records.dir.name
    raw.mkdir(parents=True, exist_ok=True)
    (raw / f"{now:%Y%m%dT%H%M%SZ}.json").write_text(json.dumps(events), encoding="utf-8")
    snaps = parse(events, now.isoformat())
    if len(snaps):
        records.add_odds_snapshots(snaps)
    issues = [f"{r.home_team} v {r.away_team}: {r.issues}" for r in snaps.itertuples() if r.issues]
    return {"status": "ok", "games": len(events), "priced": int(len(snaps)), "credits_remaining": left,
            "issues": issues}


def main():
    records = Records(config.PREDICT_SEASON, replay=False)
    print(record_snapshot(records, pd.Timestamp.now(tz="UTC")))
    prices = game_prices(records.odds_snapshots())
    if prices is None or prices.empty:
        return
    cols = ["commence_time", "home_team", "away_team", "open_home_odds", "open_away_odds", "open_line",
            "open_total", "close_home_odds", "close_away_odds", "close_line", "close_total", "opened_at"]
    print(prices[cols].sort_values("commence_time").to_string(index=False))


if __name__ == "__main__":
    main()
