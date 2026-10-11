"""
Tests for the site's weather (pipeline/fetch_weather.py) on made-up hourly data shaped like
Open-Meteo's, so they run offline: what a game's weather is, which games get a forecast or an
observation, roofed venues, and that a failed fetch only warns.
"""

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))

import fetch_weather  # noqa: E402
from common import Records  # noqa: E402

T = lambda s: pd.Timestamp(s, tz="UTC")  # noqa: E731


def fake_hourly(start, end, rain=0.0, code=3):
    """An Open-Meteo hourly table: 15 C rising 1 C an hour, light wind, `rain` mm an hour from 09:00."""
    t = pd.date_range(T(start), T(end) + pd.Timedelta(hours=23), freq="h")
    h = pd.DataFrame({"temperature_2m": 15.0 + t.hour, "precipitation": [rain if x.hour >= 9 else 0.0 for x in t],
                      "precipitation_probability": [80 if x.hour >= 9 else 10 for x in t],
                      "weather_code": [63 if rain and x.hour >= 9 else code for x in t],
                      "wind_speed_10m": 10.0 + (t.hour % 2), "wind_gusts_10m": 20.0 + t.hour,
                      "wind_direction_10m": 180}, index=t)
    return h


def test_a_game_s_weather_is_the_two_hours_from_kickoff():
    h = fake_hourly("2027-03-05", "2027-03-05", rain=1.5)
    w = fetch_weather.game_weather(h, T("2027-03-05 08:50"))  # the 08:00 and 09:00 hours
    assert w == {"temp_c": 23.0, "rain_mm": 1.5, "rain_chance": 80, "wind_kmh": 10.5, "gust_kmh": 29.0,
                 "wind_dir": 180, "weather_code": 63, "conditions": "Rain"}
    assert fetch_weather.game_weather(h, T("2027-04-01 08:00")) is None  # beyond the forecast


def fixture(mid, kickoff, venue="Accor Stadium", city="Sydney"):
    return {"match_id": mid, "season": 2027, "round": 1, "round_title": "Round 1", "is_final": False,
            "start_time_utc": kickoff, "venue": venue, "venue_city": city, "home_team": "Eels",
            "away_team": "Storm", "neutral": False, "url": f"/draw/{mid}/"}


def test_coming_games_get_forecasts_and_finished_ones_one_observation(tmp_path, monkeypatch):
    calls = []

    def hourly(url, lat, lon, start, end):
        calls.append((url, start, end))
        return fake_hourly(start, end)
    monkeypatch.setattr(fetch_weather, "hourly", hourly)
    rec = Records(2027, replay=False, root=tmp_path)
    rec.update_fixtures(pd.DataFrame([
        fixture(1, "2027-03-05T08:00:00Z"),                                   # played
        fixture(2, "2027-03-12T09:00:00Z"),                                   # next week
        fixture(3, "2027-03-13T05:00:00Z", "Marvel Stadium", "Melbourne"),    # roofed
        fixture(4, "2027-04-20T05:00:00Z")]))                                 # beyond the forecast
    now = T("2027-03-10 07:15")
    assert fetch_weather.record_weather(rec, now) == {"status": "ok", "forecasts": 2, "observed": 1}
    w = rec.weather().set_index(["match_id", "kind"])
    assert set(w.index) == {(1, "observed"), (2, "forecast"), (3, "forecast")}
    assert w.loc[(3, "forecast"), "roofed"] and pd.isna(w.loc[(3, "forecast"), "temp_c"])
    assert w.loc[(2, "forecast"), "conditions"] == "Overcast" and w.loc[(2, "forecast"), "source"] == "forecast"
    assert all(url == fetch_weather.FORECAST for url, *_ in calls)  # all within the forecast service's range

    # A later run refreshes the forecasts but doesn't observe game 1 again; game 2 is observed once over.
    fetch_weather.record_weather(rec, T("2027-03-12 12:30"))
    kinds = rec.weather().groupby("kind")["match_id"].apply(sorted).to_dict()
    assert kinds == {"forecast": [2, 3, 3], "observed": [1, 2]}


def test_backfill_uses_the_archive_for_old_games(tmp_path, monkeypatch):
    urls = []
    def hourly(url, lat, lon, start, end):
        urls.append(url)
        h = fake_hourly(start, end)
        return h.drop(columns="precipitation_probability") if url == fetch_weather.ARCHIVE else h
    monkeypatch.setattr(fetch_weather, "hourly", hourly)
    rec = Records(2026, replay=False, root=tmp_path)
    n = fetch_weather.backfill(2026, rec, now=T("2026-10-11"))
    w = rec.weather()
    assert n == len(w) > 200 and set(w["kind"]) == {"observed"}
    # Games from the last ~3 months come from the forecast service, older ones from the archive,
    # which has no chance of rain.
    old = w["source"] == "archive"
    assert old.any() and (~old & ~w["roofed"]).any() and w.loc[old, "rain_chance"].isna().all()
    assert w.loc[w["roofed"], "match_id"].nunique() >= 2  # Las Vegas
    assert fetch_weather.backfill(2026, rec, now=T("2026-10-11")) == 0


def test_a_failed_fetch_warns_and_the_job_carries_on(tmp_path):
    import run
    rec = Records(2027, replay=False, root=tmp_path)
    rec.update_fixtures(pd.DataFrame([fixture(2, "2027-03-12T09:00:00Z")]))
    job = {}
    run.weather_step(rec, T("2027-03-10 07:15"), job)  # conftest blocks Open-Meteo
    assert job["weather"]["status"] == "failed" and "weather fetch failed" in job["warnings"][0]
