import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline"))


@pytest.fixture(autouse=True)
def no_weather_downloads(monkeypatch):
    """Live jobs fetch the weather for the site (fetch_weather.py) after they run: never from a test.
    Tests of the weather replace `hourly` themselves; elsewhere a fetch is a warning in the run record."""
    import fetch_weather

    def blocked(*args, **kwargs):
        raise RuntimeError("no Open-Meteo downloads in tests")
    monkeypatch.setattr(fetch_weather, "hourly", blocked)
