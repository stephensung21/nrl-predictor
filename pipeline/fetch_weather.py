"""
Weather for each game, for the website (PLAN_WEB.md step 5). Not a model input: weather as features
didn't help the backtest (IMPROVEMENTS.md item 45), so the models never read this.

From Open-Meteo (free, no key; data CC BY 4.0, open-meteo.com), at the venue's city:
- `forecast`: before kickoff, for games up to 16 days away. Refetched by every live job, so the latest
  forecast replaces the last on the site (every one is kept in the records).
- `observed`: once a game is over, what the weather was (the forecast service's own analysis for
  games in the last ~3 months; the reanalysis archive for older ones, as `--backfill` uses).

Per game, over the 2 hours from kickoff: the temperature at kickoff, rain (mm), the highest chance
of rain (forecasts only), mean wind and the strongest gust (km/h), the wind direction at kickoff, and
the most severe WMO weather code with its description. Roofed venues are marked and get no weather.

Every live job (not the odds job) runs this first, like the odds; a failure is only a warning.

Usage:
    python pipeline/fetch_weather.py                  # forecasts and observations for the live season
    python pipeline/fetch_weather.py --backfill 2026  # observed weather for a season's played games
"""

import argparse

import pandas as pd
import requests

from common import Records, load_matches
import config
from features import CITY_COORDS
from weather import ROOFED, VENUE_CITY, city

FORECAST = "https://api.open-meteo.com/v1/forecast"
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
VARS = ["temperature_2m", "precipitation", "precipitation_probability", "weather_code", "wind_speed_10m",
        "wind_gusts_10m", "wind_direction_10m"]
GAME_HOURS = 2
FORECAST_DAYS = 16          # how far ahead Open-Meteo forecasts
FORECAST_PAST_DAYS = 90     # how far back its forecast service goes (about 92 days)
OBSERVE_AFTER = pd.Timedelta(hours=3)  # kickoff to observing: the game is over
COLS = ["match_id", "kind", "fetched_at", "source", "roofed", "temp_c", "rain_mm", "rain_chance", "wind_kmh",
        "gust_kmh", "wind_dir", "weather_code", "conditions"]

# WMO weather codes, as Open-Meteo gives them.
CONDITIONS = {
    0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Light showers", 81: "Showers",
    82: "Heavy showers", 85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorm",
    96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
}


def hourly(url, lat, lon, start, end):
    r = requests.get(url, timeout=60, params={
        "latitude": lat, "longitude": lon, "start_date": start, "end_date": end, "timezone": "UTC",
        "hourly": ",".join(VARS if url == FORECAST else [v for v in VARS if v != "precipitation_probability"])})
    r.raise_for_status()
    h = pd.DataFrame(r.json()["hourly"])
    h["time"] = pd.to_datetime(h["time"], utc=True)
    return h.set_index("time")


def game_weather(h, kickoff):
    """One game's weather from the hourly table: the GAME_HOURS hours from kickoff."""
    k = kickoff.floor("h")
    g = h.reindex([k + pd.Timedelta(hours=i) for i in range(GAME_HOURS)])
    if g["temperature_2m"].isna().all():
        return None  # beyond the forecast
    code = g["weather_code"].max()
    chance = g["precipitation_probability"].max() if "precipitation_probability" in g else None
    num = lambda x, n=1: None if pd.isna(x) else round(float(x), n)  # noqa: E731
    return {"temp_c": num(g["temperature_2m"].iloc[0]), "rain_mm": num(g["precipitation"].sum(min_count=1)),
            "rain_chance": None if chance is None or pd.isna(chance) else int(chance),
            "wind_kmh": num(g["wind_speed_10m"].mean()), "gust_kmh": num(g["wind_gusts_10m"].max()),
            "wind_dir": None if pd.isna(g["wind_direction_10m"].iloc[0]) else int(g["wind_direction_10m"].iloc[0]),
            "weather_code": None if pd.isna(code) else int(code),
            "conditions": None if pd.isna(code) else CONDITIONS.get(int(code))}


def fetch(games, kind, now):
    """Weather rows for the games (match_id, start_time_utc, venue, venue_city), one request per city."""
    games = games.assign(start_time_utc=pd.to_datetime(games["start_time_utc"], utc=True),
                         venue_city=games["venue_city"].fillna(games["venue"].map(VENUE_CITY)))
    rows = []
    for mid in games.loc[games["venue"].isin(ROOFED), "match_id"]:
        rows.append({"match_id": mid, "kind": kind, "fetched_at": now, "source": None, "roofed": True})
    outdoor = games[~games["venue"].isin(ROOFED) & games["venue_city"].map(city).isin(CITY_COORDS)]
    for c, g in outdoor.groupby(outdoor["venue_city"].map(city)):
        lat, lon = CITY_COORDS[c]
        start, end = g["start_time_utc"].min(), g["start_time_utc"].max() + pd.Timedelta(hours=GAME_HOURS)
        recent = start >= now - pd.Timedelta(days=FORECAST_PAST_DAYS)
        url = FORECAST if recent else ARCHIVE
        h = hourly(url, lat, lon, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
        for _, game in g.iterrows():
            w = game_weather(h, game["start_time_utc"])
            if w:
                rows.append({"match_id": game["match_id"], "kind": kind, "fetched_at": now,
                             "source": "forecast" if url == FORECAST else "archive", "roofed": False, **w})
    return pd.DataFrame(rows, columns=COLS)


def record_weather(records, now):
    """Forecasts for the coming games the predict job has seen, and the observed weather for games
    that have finished since. Returns a summary for the run record."""
    fixtures = records.fixtures()
    if fixtures.empty:
        return {"status": "no fixtures yet"}
    kickoff = pd.to_datetime(fixtures["start_time_utc"], utc=True)
    seen = records.weather()
    observed = set(seen.loc[seen["kind"] == "observed", "match_id"])
    coming = fixtures[(kickoff > now) & (kickoff <= now + pd.Timedelta(days=FORECAST_DAYS))]
    over = fixtures[(kickoff + OBSERVE_AFTER <= now) & ~fixtures["match_id"].isin(observed)]
    rows = pd.concat([fetch(coming, "forecast", now), fetch(over, "observed", now)], ignore_index=True)
    if not rows.empty:
        records.add_weather(rows)
    return {"status": "ok", "forecasts": int((rows["kind"] == "forecast").sum()),
            "observed": int((rows["kind"] == "observed").sum())}


def backfill(season, records=None, now=None):
    """Observed weather for every played game of a season (from the scraped matches), for the site's
    history. Games already observed are skipped."""
    records = records or Records(season, replay=False)
    now = now or pd.Timestamp.now(tz="UTC")
    m = load_matches()
    m = m[(m["season"] == season) & m["home_score"].notna()]
    seen = records.weather()
    m = m[~m["match_id"].isin(seen.loc[seen["kind"] == "observed", "match_id"])]
    rows = fetch(m, "observed", now)
    if not rows.empty:
        records.add_weather(rows)
    return len(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--backfill", type=int, metavar="SEASON", help="observed weather for a season's played games")
    args = parser.parse_args()
    if args.backfill:
        print(f"{backfill(args.backfill)} games")
    else:
        print(record_weather(Records(config.PREDICT_SEASON, replay=False), pd.Timestamp.now(tz="UTC")))
