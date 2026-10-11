"""
Weather at each game's kickoff from Open-Meteo (free, no key; data CC BY 4.0, open-meteo.com), for the
weather experiments (experiments.py --only weather, PLAN_WEB.md step 5).

The weather nrl.com records is patchy (missing for almost all of 2023 and 2024), so the wet-conditions
flag mostly comes from the ground conditions. These are consistent for every game:

- `archive`: the reanalysis (ERA5 blend) for the hours around kickoff: what the weather was. In live
  use the game-day refresh would read Open-Meteo's forecast for the same hours, which a few hours
  ahead is close to this.
- `day1` ... `day7`: what the forecast issued N days earlier said for those hours (Open-Meteo's
  previous-runs archive, from 2024 only): what a prediction made earlier in the week would know.

Per game: rain in the 2 hours before and the 2 after kickoff (mm), mean wind over the 2 hours from
kickoff (km/h) and the temperature at kickoff (C). Roofed venues get no rain or wind.

Usage:
    python src/weather.py   ->  data/raw/weather/kickoff_weather.csv (cached; delete it to refetch)
"""

import time

import numpy as np
import pandas as pd
import requests

from features import CITY_COORDS
from ingest import PROCESSED, ROOT

OUT = ROOT / "data" / "raw" / "weather" / "kickoff_weather.csv"
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
PREVIOUS = "https://previous-runs-api.open-meteo.com/v1/forecast"
FORECAST_FROM = 2024  # the previous-runs archive starts in 2024
LEADS = range(1, 8)
VARS = ("precipitation", "wind_speed_10m", "temperature_2m")
VENUE_CITY = {"Optus Stadium": "Perth"}  # games the draw lists without a city
ROOFED = {"Allegiant Stadium", "Marvel Stadium", "One NZ Stadium"}
RAIN_HOURS = range(-2, 2)  # the hours starting 2 before kickoff up to the hour 1 after
GAME_HOURS = range(0, 2)


def city(name):
    return name.split(",")[0].strip()


def get(url, params, tries=4):
    for attempt in range(tries):
        r = requests.get(url, params=params, timeout=120)
        if r.status_code == 429 and attempt < tries - 1:  # Open-Meteo's per-minute limit
            time.sleep(60)
            continue
        r.raise_for_status()
        return pd.DataFrame(r.json()["hourly"]).assign(time=lambda d: pd.to_datetime(d["time"], utc=True)).set_index("time")


def hourly(url, lat, lon, start, end, variables):
    return get(url, {"latitude": lat, "longitude": lon, "start_date": start, "end_date": end,
                     "hourly": ",".join(variables), "timezone": "UTC"})


def summarise(h, kickoff, suffix=""):
    k = kickoff.floor("h")
    pick = lambda var, hours: h[f"{var}{suffix}"].reindex([k + pd.Timedelta(hours=i) for i in hours])
    return {"rain_mm": pick("precipitation", RAIN_HOURS).sum(min_count=1),
            "wind_kmh": pick("wind_speed_10m", GAME_HOURS).mean(),
            "temp_c": pick("temperature_2m", [0]).iloc[0]}


def fetch(matches):
    rows = []
    for (c, season), games in matches.groupby([matches["venue_city"].map(city), "season"]):
        lat, lon = CITY_COORDS[c]
        start = (games["start_time_utc"].min() - pd.Timedelta(days=1)).strftime("%Y-%m-%d")
        end = (games["start_time_utc"].max() + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
        sources = {"archive": hourly(ARCHIVE, lat, lon, start, end, VARS)}
        if season >= FORECAST_FROM:
            prev = hourly(PREVIOUS, lat, lon, start, end, [f"{v}_previous_day{n}" for v in VARS for n in LEADS])
            sources.update({f"day{n}": prev for n in LEADS})
        for _, g in games.iterrows():
            for source, h in sources.items():
                suffix = "" if source == "archive" else f"_previous_{source}"
                w = summarise(h, g["start_time_utc"], suffix)
                if g["venue"] in ROOFED:
                    w.update(rain_mm=0.0, wind_kmh=0.0)
                rows.append({"match_id": g["match_id"], "source": source, **w})
        print(f"  {c} {season}: {len(games)} games")
    return pd.DataFrame(rows)


def load(refresh=False):
    """One row per game and source (archive, day1..day7), cached in data/raw/weather/; games not in
    the cache yet are fetched and added."""
    m = pd.read_csv(PROCESSED / "matches.csv", parse_dates=["start_time_utc"])
    m["venue_city"] = m["venue_city"].fillna(m["venue"].map(VENUE_CITY))
    old = pd.read_csv(OUT) if OUT.exists() and not refresh else pd.DataFrame(columns=["match_id"])
    todo = m[m["venue_city"].notna() & ~m["match_id"].isin(old["match_id"])]
    if todo.empty:
        return old
    out = pd.concat([old, fetch(todo)], ignore_index=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False)
    return out


def features(w, source="archive"):
    """Model inputs from one source, by match_id: rain as log(1 + mm) and as a flag (1 mm or more),
    wind and temperature."""
    s = w[w["source"] == source].set_index("match_id")
    return pd.DataFrame({"rain": np.log1p(s["rain_mm"]), "rain_flag": (s["rain_mm"] >= 1).astype(float),
                         "wind": s["wind_kmh"], "temp": s["temp_c"]})


if __name__ == "__main__":
    w = load(refresh=True)
    print(w.groupby("source")[["rain_mm", "wind_kmh", "temp_c"]].describe().T.round(1))
