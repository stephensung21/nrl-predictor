"""
Scraping guards (src/scrape.py, pipeline/run.py): a blocked or broken nrl.com is an error, never "nothing
there"; one page failing doesn't lose the others; rebuilding a season never drops a game the tables
already have; the results job still grades what it has, then fails so the alert goes out; and the
predict job picks up games finished since Monday. Nothing here touches the network.
"""

import json
import sys
from pathlib import Path

import pandas as pd
import pytest
import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "pipeline"))

import scrape  # noqa: E402
from common import Records  # noqa: E402


class Resp:
    def __init__(self, status, text=""):
        self.status_code, self.text = status, text

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code} error")


def page(element_id, data):
    return f"<html><div id='{element_id}' q-data='{json.dumps(data)}'></div></html>"


@pytest.fixture
def site(monkeypatch):
    """nrl.com stand-in: url -> Resp, recording every request. No waiting between tries."""
    pages, asked = {}, []
    monkeypatch.setattr(scrape.time, "sleep", lambda s: None)

    def get(url, timeout):
        asked.append(url)
        return pages.get(url, Resp(500))
    monkeypatch.setattr(scrape.session, "get", get)
    return pages, asked


def test_a_missing_season_is_nothing_but_a_blocked_or_changed_site_is_an_error(site):
    pages, asked = site
    pages["https://x/404"] = Resp(404)
    pages["https://x/403"] = Resp(403)
    pages["https://x/changed"] = Resp(200, "<html>no data here</html>")
    pages["https://x/ok"] = Resp(200, page("vue-draw", {"fixtures": []}))
    assert scrape.get_q_data("https://x/404", "vue-draw", missing_ok=True) is None
    assert asked.count("https://x/404") == 1  # not retried
    with pytest.raises(scrape.FetchError, match="403"):
        scrape.get_q_data("https://x/403", "vue-draw", missing_ok=True)
    with pytest.raises(scrape.FetchError, match="404"):
        scrape.get_q_data("https://x/404", "vue-draw")  # a match page that should exist
    with pytest.raises(scrape.FetchError, match="no #vue-draw data"):
        scrape.get_q_data("https://x/changed", "vue-draw")
    assert asked.count("https://x/403") == 3
    assert scrape.get_q_data("https://x/ok", "vue-draw") == {"fixtures": []}


def test_an_unpublished_draw_is_empty_but_a_blocked_one_raises(site):
    pages, _ = site
    url = "https://www.nrl.com/draw/?competition=111&round=1&season={}"
    pages[url.format(2028)] = Resp(404)
    pages[url.format(2027)] = Resp(403)
    assert scrape.fetch_fixtures(2028) == []
    with pytest.raises(scrape.FetchError):
        scrape.fetch_fixtures(2027)


def test_one_page_failing_keeps_the_others_and_names_the_missing_game(site, tmp_path):
    pages, _ = site
    good, bad = "/draw/nrl-premiership/2027/round-1/storm-v-broncos/", "/draw/nrl-premiership/2027/round-1/eels-v-panthers/"
    pages[scrape.match_url(good)] = Resp(200, page("vue-match-centre", {"match": {"matchId": 1}}))
    pages[scrape.match_url(bad)] = Resp(503)
    with pytest.raises(scrape.FetchError, match="1 finished game.*eels-v-panthers"):
        scrape.fetch_matches(2027, [good, bad], tmp_path)
    assert json.loads(scrape.raw_path(2027, good, tmp_path).read_text()) == {"matchId": 1}
    assert not scrape.raw_path(2027, bad, tmp_path).exists()


def match_page(match_id, home, away):
    return {"matchId": match_id, "roundNumber": 1, "roundTitle": "Round 1", "startTime": f"2027-03-0{match_id}T08:00:00Z",
            "homeTeam": {"nickName": home, "score": 20, "players": []}, "awayTeam": {"nickName": away, "score": 10, "players": []},
            "stats": {"groups": [], "players": {"homeTeam": [], "awayTeam": []}}}


@pytest.fixture
def tables(tmp_path, monkeypatch):
    """Processed tables holding two 2027 games and one 2026 game, and an empty raw cache."""
    out, raw = tmp_path / "processed", tmp_path / "raw"
    out.mkdir()
    monkeypatch.setattr(scrape, "OUT_DIR", out)
    monkeypatch.setattr(scrape, "RAW_DIR", raw)
    games = pd.DataFrame({"match_id": [1, 2, 9], "season": [2027, 2027, 2026], "round": 1, "start_time_utc": "2027",
                          "team": "Storm", "is_home": True})
    for name in ("matches", "team_match_stats", "player_match_stats"):
        games.to_csv(out / f"{name}.csv", index=False)
    (raw / "2027").mkdir(parents=True)
    return out, raw


def test_rebuilding_a_season_never_drops_a_game_and_writes_nothing_when_it_refuses(tables):
    out, raw = tables
    before = {p.name: p.read_text() for p in out.iterdir()}
    (raw / "2027" / "round-1_storm-v-broncos.json").write_text(json.dumps(match_page(1, "Storm", "Broncos")))
    with pytest.raises(RuntimeError, match="would drop 1 game"):
        scrape.build_tables([2027], merge=True)  # game 2's page is missing (a lost cache)
    assert {p.name: p.read_text() for p in out.iterdir()} == before
    (raw / "2027" / "round-1_eels-v-panthers.json").write_text(json.dumps(match_page(2, "Eels", "Panthers")))
    (raw / "2027" / "round-1_roosters-v-sharks.json").write_text(json.dumps(match_page(3, "Roosters", "Sharks")))
    scrape.build_tables([2027], merge=True)
    assert sorted(pd.read_csv(out / "matches.csv")["match_id"]) == [1, 2, 3, 9]


def live_results_run(monkeypatch, tmp_path, fetch_season):
    import run
    monkeypatch.setattr(scrape, "fetch_season", fetch_season)
    for name in ("fetch_origin", "build_tables", "build_origin_table"):
        monkeypatch.setattr(scrape, name, lambda *a, **k: None)
    monkeypatch.setattr(run.fetch_odds, "api_key", lambda: None)
    monkeypatch.setattr(run.fetch_sheet, "update", lambda: {"status": "skipped in tests"})
    graded = []
    monkeypatch.setattr(run, "grade_season", lambda *a: graded.append(True) or pd.DataFrame())
    records = Records(2027, replay=False, root=tmp_path)
    return run, records, graded


def test_the_results_job_grades_what_it_has_then_fails_when_nrl_com_did(monkeypatch, tmp_path):
    def blocked(season):
        raise scrape.FetchError("https://www.nrl.com/draw/...: 403 error")
    run, records, graded = live_results_run(monkeypatch, tmp_path, blocked)
    with pytest.raises(RuntimeError, match="nrl.com: .*403"):
        run.run_job("results", 2027, records=records)
    assert graded == [True]
    assert records.runs()[-1]["status"] == "failed"


def test_the_results_job_still_fails_when_there_is_nothing_to_grade(monkeypatch, tmp_path):
    import run
    run_mod, records, _ = live_results_run(monkeypatch, tmp_path, lambda s: (_ for _ in ()).throw(scrape.FetchError("down")))

    def nothing(*a):
        raise run.NothingToDo("no finished games with a prediction of record")
    monkeypatch.setattr(run, "grade_season", nothing)
    with pytest.raises(RuntimeError, match="nrl.com: down"):
        run_mod.run_job("results", 2027, records=records)


def test_the_predict_job_picks_up_games_finished_since_monday(monkeypatch):
    import run
    done = {}
    monkeypatch.setattr(scrape, "fetch_matches", lambda season, urls: done.setdefault("urls", urls))
    monkeypatch.setattr(scrape, "build_tables", lambda years, merge: done.setdefault("built", (years, merge)))
    draw = pd.DataFrame({"match_id": [1.0, None, None], "status": ["final", "final", "scheduled"],
                         "url": ["/r1/a/", "/r1/easter-monday/", "/r2/b/"]})
    out = {}
    run.catch_up(draw, 2027, out)
    assert done == {"urls": ["/r1/easter-monday/"], "built": ([2027], True)} and out["caught_up"] == 1

    def down(*a):
        raise scrape.FetchError("down")
    monkeypatch.setattr(scrape, "fetch_matches", down)
    out = {}
    run.catch_up(draw, 2027, out)  # only a warning: the predictions go ahead
    assert "caught_up" not in out and "FetchError: down" in out["warnings"][0]
    done.clear()
    run.catch_up(draw[draw["match_id"].notna()], 2027, {})
    assert done == {}
