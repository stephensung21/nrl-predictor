"""
Pre-kickoff team lists from the Internet Archive (item 40).

nrl.com's match pages only show the final teams now, but the Internet Archive kept snapshots of
many of them during the week before each game. For every NRL game in the chosen seasons this
finds the EARLIEST archived snapshot taken at least MIN_HOURS_BEFORE kickoff that already shows
both teams' lists (usually the Tuesday announcement: jerseys 1-17 named, 18-22 reserves), and
saves that list. It is what was known when the opening prices were up, unlike the final named 17
used for training.

Snapshots are cached in data/raw/teamlists/, so reruns only fetch what's missing.

Usage:
    python src/teamlists.py                    # 2023-2026 -> data/processed/pre_kickoff_teamlists.csv
    python src/teamlists.py --seasons 2025
"""

import argparse
import glob
import html
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
RAW_NRL = ROOT / "data" / "raw" / "nrl"
CACHE = ROOT / "data" / "raw" / "teamlists"
OUT = ROOT / "data" / "processed" / "pre_kickoff_teamlists.csv"
SEASONS = [2023, 2024, 2025, 2026]
MIN_HOURS_BEFORE = 24       # as Footy Tipper: the list as it stood at least a day before kickoff
MAX_DAYS_BEFORE = 7
MAX_TRIES = 4               # snapshots tried per game
WORKERS = 4                 # games fetched at once
PAUSE = 1.0                 # seconds between one worker's requests
session = requests.Session()
session.headers.update({"User-Agent": "nrl-predictor research (team-list history)"})


def get(url, tries=4):
    for attempt in range(tries):
        try:
            r = session.get(url, timeout=90)
            if r.status_code == 429:
                time.sleep(30 * (attempt + 1))
                continue
            r.raise_for_status()
            return r
        except requests.RequestException:
            time.sleep(5 * (attempt + 1))
    return None


def season_games(season):
    games = []
    for f in glob.glob(str(RAW_NRL / str(season) / "*.json")):
        d = json.load(open(f, encoding="utf-8"))
        if isinstance(d, dict):
            url = d["url"].replace("http://", "https://")
            games.append({"match_id": int(d["matchId"]), "url": url, "kickoff": pd.to_datetime(d["startTime"], utc=True),
                          "slug": Path(f).stem, "round_path": url.rstrip("/").rsplit("/", 1)[0]})
    return pd.DataFrame(games)


def snapshots(round_path):
    """Archived (timestamp, url) pairs under one round's pages."""
    path = round_path.replace("https://www.", "")
    r = get(f"http://web.archive.org/cdx/search/cdx?url={path}/*&output=json&fl=timestamp,original"
            "&filter=statuscode:200")
    time.sleep(PAUSE)
    rows = r.json()[1:] if r is not None and r.text.strip() else []
    return pd.DataFrame(rows, columns=["ts", "original"])


def parse(page):
    m = re.search(r'id="vue-match-centre"[^>]*q-data="([^"]*)"', page)
    if not m:
        return None
    d = json.loads(html.unescape(m.group(1)))
    return d.get("match", d)


def announcement(kickoff):
    """Team lists are announced on the Tuesday of game week at about 4pm Sydney time: the latest
    such Tuesday before kickoff (for a Monday game, the Tuesday six days earlier)."""
    local = kickoff.tz_convert("Australia/Sydney")
    tuesday = (local - pd.Timedelta(days=(local.weekday() - 1) % 7)).normalize() + pd.Timedelta(hours=15)
    if tuesday >= local:
        tuesday -= pd.Timedelta(days=7)
    return tuesday.tz_convert("UTC")


def find_list(game, snaps):
    """Earliest snapshot >= MIN_HOURS_BEFORE before kickoff with both teams' lists (cached)."""
    cache = CACHE / str(game.kickoff.year) / f"{game.slug}.json"
    if cache.exists():
        return json.load(open(cache, encoding="utf-8"))
    base = snaps["original"].str.replace("http://", "https://").str.replace(":80/", "/")
    mine = snaps[base.str.rstrip("/").eq(game.url.rstrip("/"))].copy()
    mine["t"] = pd.to_datetime(mine["ts"], format="%Y%m%d%H%M%S", utc=True)
    hours = (game.kickoff - mine["t"]).dt.total_seconds() / 3600
    mine = mine[(hours >= MIN_HOURS_BEFORE) & (hours <= MAX_DAYS_BEFORE * 24)
                & (mine["t"] >= announcement(game.kickoff))].sort_values("t")
    found, failed = {"match_id": int(game.match_id), "snapshot": None}, False
    for snap in mine.drop_duplicates("ts").head(MAX_TRIES).itertuples():
        r = get(f"http://web.archive.org/web/{snap.ts}id_/{game.url}")
        time.sleep(PAUSE)
        failed |= r is None
        d = parse(r.text) if r is not None else None
        if not d or d.get("matchState") not in ("Upcoming", "Pre Game"):
            continue
        teams = [d.get("homeTeam", {}), d.get("awayTeam", {})]
        if all(sum(1 for p in t.get("players", []) if p.get("number", 99) <= 17) >= 17 for t in teams):
            found = {"match_id": int(game.match_id), "snapshot": snap.ts, "updated": d.get("updated"),
                     "teams": [{"team": t["nickName"], "players": [
                         {k: p.get(k) for k in ("playerId", "firstName", "lastName", "number", "position")}
                         for p in t["players"]]} for t in teams]}
            break
    if found["snapshot"] or not failed:  # don't cache "nothing found" after a failed request
        cache.parent.mkdir(parents=True, exist_ok=True)
        json.dump(found, open(cache, "w", encoding="utf-8"))
    return found


def build_table(seasons):
    rows = []
    for season in seasons:
        games = season_games(season)
        for f in glob.glob(str(CACHE / str(season) / "*.json")):
            d = json.load(open(f, encoding="utf-8"))
            if not d.get("snapshot"):
                continue
            kickoff = games.set_index("match_id").loc[d["match_id"], "kickoff"]
            snap = pd.to_datetime(d["snapshot"], format="%Y%m%d%H%M%S", utc=True)
            for t in d["teams"]:
                for p in t["players"]:
                    rows.append({"match_id": d["match_id"], "season": season, "team": t["team"],
                                 "player_id": p["playerId"], "player_name": f"{p['firstName']} {p['lastName']}",
                                 "jersey_number": p["number"], "position": p["position"],
                                 "snapshot_utc": snap, "list_updated_utc": d.get("updated"),
                                 "hours_before": (kickoff - snap).total_seconds() / 3600})
    out = pd.DataFrame(rows)
    out.to_csv(OUT, index=False)
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seasons", type=int, nargs="+", default=SEASONS)
    args = parser.parse_args()
    for season in args.seasons:
        games = season_games(season)
        found = 0
        for round_path, g in games.groupby("round_path"):
            snaps = snapshots(round_path)
            with ThreadPoolExecutor(WORKERS) as pool:
                found += sum(bool(r.get("snapshot")) for r in pool.map(lambda game: find_list(game, snaps),
                                                                      list(g.itertuples())))
            print(f"{season} {round_path.rsplit('/', 1)[-1]}: {found} lists so far", flush=True)
        print(f"{season}: pre-kickoff lists for {found} of {len(games)} games", flush=True)
    out = build_table(args.seasons)
    print(f"wrote {OUT.name}: {out['match_id'].nunique()} games")


if __name__ == "__main__":
    main()
