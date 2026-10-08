"""
Scrape NRL match data from nrl.com.

Based on the approach in NRL-Data (https://github.com/simpzboat/NRL-Data): the draw
page gives each round's fixtures, and each match-centre page embeds the full match
as JSON in the `q-data` attribute of #vue-match-centre. Reading that JSON (instead of
parsing the rendered HTML by position) gives labelled team and player stats and needs
no browser.

Usage (from the repo root):
    python src/scrape.py                       # 2021-2026, fetch + build CSVs
    python src/scrape.py --years 2025 2026
    python src/scrape.py --build-only          # rebuild CSVs from cached raw JSON

Raw JSON is cached in data/raw/nrl/<year>/, so reruns only fetch what's missing.
"""

import argparse
import json
import re
import time
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw" / "nrl"
OUT_DIR = ROOT / "data" / "processed"

COMPETITION_ID = 111  # NRL Telstra Premiership
MAX_ROUNDS = 35       # regular season + finals; empty rounds are skipped
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
DELAY = 0.5           # seconds between requests, to be polite to nrl.com

session = requests.Session()
session.headers.update(HEADERS)


def get_q_data(url, element_id):
    for attempt in range(3):
        try:
            resp = session.get(url, timeout=30)
            resp.raise_for_status()
            el = BeautifulSoup(resp.text, "html.parser").find(id=element_id)
            return json.loads(el["q-data"]) if el else None
        except (requests.RequestException, ValueError) as ex:
            print(f"  attempt {attempt + 1} failed for {url}: {ex}")
            time.sleep(2 * (attempt + 1))
    return None


def fetch_fixtures(year):
    """Return all completed matches for a season, one dict per match."""
    fixtures = []
    for rnd in range(1, MAX_ROUNDS + 1):
        url = f"https://www.nrl.com/draw/?competition={COMPETITION_ID}&round={rnd}&season={year}"
        data = get_q_data(url, "vue-draw")
        time.sleep(DELAY)
        matches = [f for f in (data or {}).get("fixtures", []) if f.get("type") == "Match"]
        # Past the last round the site returns the final round again, so stop on a repeat.
        if not matches or (fixtures and matches[0]["matchCentreUrl"] == fixtures[-1]["matchCentreUrl"]):
            break
        fixtures.extend(matches)
    return fixtures


def fetch_season(year):
    year_dir = RAW_DIR / str(year)
    year_dir.mkdir(parents=True, exist_ok=True)

    fixtures = fetch_fixtures(year)
    (year_dir / "fixtures.json").write_text(json.dumps(fixtures, indent=1), encoding="utf-8")
    print(f"{year}: {len(fixtures)} fixtures")

    for i, fx in enumerate(fixtures, 1):
        if fx.get("matchMode") != "Post":
            continue  # not played yet
        slug = fx["matchCentreUrl"].strip("/").split("/")
        path = year_dir / f"{slug[-2]}_{slug[-1]}.json"
        if path.exists():
            continue
        data = get_q_data(f"https://www.nrl.com{fx['matchCentreUrl']}", "vue-match-centre")
        time.sleep(DELAY)
        if not data or "match" not in data:
            print(f"  no match data: {fx['matchCentreUrl']}")
            continue
        path.write_text(json.dumps(data["match"]), encoding="utf-8")
        if i % 25 == 0:
            print(f"  {year}: {i}/{len(fixtures)}")


def snake(title):
    title = title.replace("%", "pct").replace("40/20", "forty_twenty").replace("20/40", "twenty_forty")
    return re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")


def team_stats(match, side):
    row = {}
    for group in match.get("stats", {}).get("groups", []):
        for stat in group["stats"]:
            name = snake(stat["title"])
            if name == "used":
                name = "interchanges_used"
            val = stat.get(f"{side}Value") or {}
            row[name] = val.get("value")
            if "numerator" in val:
                row[f"{name}_made"] = val["numerator"]
                row[f"{name}_attempts"] = val["denominator"]
    return row


def build_tables(years):
    matches, team_rows, player_rows = [], [], []
    for year in years:
        for path in sorted((RAW_DIR / str(year)).glob("*_*.json")):
            if path.name == "fixtures.json":
                continue
            m = json.loads(path.read_text(encoding="utf-8"))
            home, away = m["homeTeam"], m["awayTeam"]
            match_id = m["matchId"]
            title = m.get("roundTitle", "")
            is_final = not title.lower().startswith("round")
            matches.append({
                "match_id": match_id,
                "season": year,
                "round": m.get("roundNumber"),
                "round_title": title,
                "is_final": is_final,
                "start_time_utc": m.get("startTime"),
                "venue": m.get("venue"),
                "venue_city": m.get("venueCity"),
                "home_team": home["nickName"],
                "away_team": away["nickName"],
                "home_score": home.get("score"),
                "away_score": away.get("score"),
                "home_ht_score": home.get("scoring", {}).get("halfTimeScore"),
                "away_ht_score": away.get("scoring", {}).get("halfTimeScore"),
                "match_state": m.get("matchState"),
                "game_seconds": m.get("gameSeconds"),
                "attendance": m.get("attendance"),
                "ground_conditions": m.get("groundConditions"),
                "weather": m.get("weather"),
                "referee": next((f"{o['firstName']} {o['lastName']}" for o in m.get("officials", [])
                                 if o.get("position") == "Referee"), None),
                "url": m.get("url"),
            })

            for side, team, opp in (("home", home, away), ("away", away, home)):
                team_rows.append({
                    "match_id": match_id, "season": year, "round": m.get("roundNumber"),
                    "team": team["nickName"], "opponent": opp["nickName"], "is_home": side == "home",
                    "points_for": team.get("score"), "points_against": opp.get("score"),
                    **team_stats(m, side),
                })

                names = {p["playerId"]: p for p in team.get("players", [])}
                for ps in m.get("stats", {}).get("players", {}).get(f"{side}Team", []):
                    info = names.get(ps["playerId"], {})
                    player_rows.append({
                        "match_id": match_id, "season": year, "round": m.get("roundNumber"),
                        "team": team["nickName"], "opponent": opp["nickName"], "is_home": side == "home",
                        "player_id": ps["playerId"],
                        "player_name": f"{info.get('firstName', '')} {info.get('lastName', '')}".strip(),
                        "jersey_number": info.get("number"),
                        "position": info.get("position"),
                        **{k: v for k, v in ps.items() if k != "playerId"},
                    })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tables = {
        "matches": pd.DataFrame(matches).sort_values(["start_time_utc", "match_id"]),
        "team_match_stats": pd.DataFrame(team_rows).sort_values(["season", "round", "match_id", "is_home"]),
        "player_match_stats": pd.DataFrame(player_rows).sort_values(["season", "round", "match_id", "team"]),
    }
    for name, df in tables.items():
        df.to_csv(OUT_DIR / f"{name}.csv", index=False)
        print(f"wrote {name}.csv: {len(df)} rows, {df.shape[1]} columns")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", type=int, nargs="+", default=list(range(2021, 2027)))
    parser.add_argument("--build-only", action="store_true")
    args = parser.parse_args()

    if not args.build_only:
        for year in args.years:
            fetch_season(year)
    build_tables(args.years)


if __name__ == "__main__":
    main()
