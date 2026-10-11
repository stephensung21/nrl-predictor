"""
Tests for publishing to the database (pipeline/publish.py), against a real Postgres with the Supabase
stub and every migration applied: TEST_DATABASE_URL if set (CI's Postgres service), otherwise PGlite
served over the Postgres protocol (web/tests/pglite_server.mjs; needs `npm ci` in web/).

- live: a season's records published twice give the same rows (safe to re-run); the views return the
  prediction of record and the live opening price; the Model tips only games not yet started.
- backfill (needs reports/predictions_2026.csv from `train.py --final`): the database's model_accuracy
  gives exactly grade.metrics' numbers for the 2026 final test, and the Model's tipping record matches.
"""

import json
import os
import shutil
import socket
import subprocess
import sys
import uuid
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))

import publish  # noqa: E402
from common import Records, load_matches  # noqa: E402

WEB = ROOT / "web"
STUB = (WEB / "tests" / "supabase_stub.sql").read_text(encoding="utf-8")
MIGRATIONS = [f.read_text(encoding="utf-8") for f in sorted((ROOT / "supabase" / "migrations").glob("*.sql"))]
T = lambda s: pd.Timestamp(s, tz="UTC")  # noqa: E731


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture
def db_url():
    """A fresh database with the stub and the migrations, for one test."""
    base = os.environ.get("TEST_DATABASE_URL")
    if base:
        name = f"publish_{uuid.uuid4().hex[:8]}"
        with psycopg.connect(base, autocommit=True) as c:
            c.execute(f"create database {name}")
        url = base.rsplit("/", 1)[0] + f"/{name}"
        with psycopg.connect(url, autocommit=True) as c:
            c.execute(STUB)
            for sql in MIGRATIONS:
                c.execute(sql)
        yield url
        with psycopg.connect(base, autocommit=True) as c:
            c.execute(f"drop database {name} with (force)")
        return
    if not shutil.which("node") or not (WEB / "node_modules" / "@electric-sql" / "pglite-socket").exists():
        pytest.skip("needs TEST_DATABASE_URL, or node and `npm ci` in web/ for PGlite")
    port = free_port()
    server = subprocess.Popen(["node", str(WEB / "tests" / "pglite_server.mjs"), str(port)], cwd=WEB,
                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        line = server.stdout.readline()
        assert line.startswith("ready"), line
        yield f"postgresql://postgres:postgres@127.0.0.1:{port}/postgres?sslmode=disable&gssencmode=disable"
    finally:
        server.terminate()
        server.wait(10)


def query(url, sql, params=None):
    with psycopg.connect(url, prepare_threshold=None) as c:
        return c.execute(sql, params).fetchall()


# ---------------------------------------------------------------- live records

@pytest.fixture
def records(tmp_path, monkeypatch):
    """A small live season: three real 2026 games (Tuesday and Wednesday predictions, one made after
    kickoff), a coming game the predict job has seen, a live price listed the other way round, a team
    list, and the run log, graded as the results job would."""
    monkeypatch.setattr(publish, "LIVE_LISTS", tmp_path / "lists")
    rec = Records(2026, replay=False, root=tmp_path / "records")
    m = load_matches()
    games = m[(m["season"] == 2026) & (m["round"] == 10)].head(3).copy()
    kick = pd.to_datetime(games["start_time_utc"], utc=True)
    soon = pd.Timestamp.now(tz="UTC").ceil("h") + pd.Timedelta(days=3)
    coming = {"match_id": 99, "season": 2026, "round": 30, "round_title": "Round 30", "is_final": False,
              "start_time_utc": soon.isoformat(), "venue": "AAMI Park", "venue_city": "Melbourne",
              "home_team": "Storm", "away_team": "Broncos", "neutral": False, "url": "/draw/x/"}
    rec.update_fixtures(pd.DataFrame([coming]))

    runs = [{"id": "tue", "job": "predict", "season": 2026, "mode": "live", "as_of": "2026-05-05T07:15:00+00:00",
             "started": "2026-05-05T07:15:01+00:00", "finished": "2026-05-05T07:16:00+00:00", "status": "ok",
             "round": 10, "games": 4, "model_version": "2026.1", "commit": "abc"},
            {"id": "wed", "job": "refresh", "season": 2026, "mode": "live", "as_of": "2026-05-06T23:15:00+00:00",
             "started": "2026-05-06T23:15:01+00:00", "finished": "2026-05-06T23:16:00+00:00", "status": "ok",
             "round": 10, "games": 4, "model_version": "2026.1", "commit": "abc"},
            {"id": "odds", "job": "odds", "season": 2026, "mode": "live", "as_of": "2026-05-03T11:15:00+00:00",
             "started": "2026-05-03T11:15:01+00:00", "status": "ok", "odds": {"status": "ok", "games": 1}}]
    for r in runs:
        rec.add_run(r)

    rows = []
    for run, made, p in (("tue", T("2026-05-05 07:15"), 0.60), ("wed", T("2026-05-06 23:15"), 0.62)):
        for mid in list(games["match_id"]) + [99]:
            rows.append({"run_id": run, "created_at": made, "match_id": mid, "home_win_prob": p, "margin": 3.0,
                         "total": 40.0, "home_score": 22, "away_score": 19, "model": "with odds",
                         "no_odds_home_win_prob": 0.55, "market_open_home_prob": 0.58, "model_version": "2026.1",
                         "inputs": run})
    late = dict(rows[0], run_id="late", created_at=kick.iloc[0] + pd.Timedelta(minutes=5), home_win_prob=0.99)
    rec.add_run(dict(runs[1], id="late", as_of=late["created_at"].isoformat()))
    rows.append(late)
    preds = pd.DataFrame(rows)
    preds["season"], preds["round"] = 2026, 10
    preds["start_time_utc"] = preds["match_id"].map(dict(zip(games["match_id"], kick))).fillna(soon)
    preds["home_team"], preds["away_team"] = "x", "y"
    rec.add_predictions(preds)

    from grade import grade, prediction_of_record
    rec.write_graded(grade(prediction_of_record(rec.predictions()), m))

    rec.add_odds_snapshots(pd.DataFrame([{
        "captured_at": "2026-05-03T11:15:00+00:00", "event_id": "e99", "commence_time": soon.isoformat(),
        "home_team": "Broncos", "away_team": "Storm", "bookmaker": "betr_au", "home_odds": 2.6, "away_odds": 1.5,
        "home_line": 6.5, "home_line_odds": 1.9, "away_line_odds": 1.9, "total": 44.5, "over_odds": 1.9,
        "under_odds": 1.9, "issues": ""}]))

    lists = tmp_path / "lists" / "2026" / "round-30"
    lists.mkdir(parents=True)
    pd.DataFrame([{"match_id": 99, "season": 2026, "team": "Storm", "player_id": n, "player_name": f"P{n}",
                   "jersey_number": n, "position": "Interchange", "list_updated_utc": "2026-05-05T06:00:00Z",
                   "fetched_utc": "2026-05-05 07:15:00+00:00"} for n in range(1, 18)]).to_csv(lists / "a.csv", index=False)
    return rec, games


def test_live_publishing_is_safe_to_rerun_and_the_views_read_it(db_url, records):
    rec, games = records
    first = publish.publish(publish.live_tables(2026, rec), db_url, 2026)
    second = publish.publish(publish.live_tables(2026, rec), db_url, 2026)
    assert first == second
    assert first["predictions"] == 9 and first["graded_games"] == 3 and first["team_lists"] == 17
    counts = query(db_url, "select (select count(*) from predictions), (select count(*) from pipeline_runs), "
                           "(select count(*) from matches where id = 99), (select count(*) from odds_snapshots)")
    assert counts == [(9, 4, 1, 1)]

    # The prediction of record is Wednesday's, not the one made after kickoff.
    record = query(db_url, "select match_id, run_id, home_win_prob from prediction_of_record order by match_id")
    assert {(r[1], r[2]) for r in record} == {("wed", 0.62)}

    # The live price was listed Broncos v Storm: turned round to nrl.com's Storm v Broncos.
    odds = query(db_url, "select open_source, home_odds_open, away_odds_open, open_line from match_odds where match_id = 99")
    assert odds == [("live", 1.5, 2.6, -6.5)]

    # The Model tips the coming game (Storm at 0.62), not the ones already played.
    tips = query(db_url, "select t.match_id, t.team from tips t join profiles p on p.id = t.user_id where p.is_model")
    assert tips == [(99, "Storm")]

    # The graded games add up to grade.metrics' numbers.
    from grade import metrics
    want = metrics(rec.graded()).loc["Model"]
    got = query(db_url, "select games, tips, log_loss, brier from model_accuracy where round is null and source = 'model'")
    assert got[0][:2] == (want["games"], want["tips"])
    np.testing.assert_allclose(got[0][2:], [want["log_loss"], want["brier"]], atol=1e-12)


def test_elo_is_the_engine_s_ratings(db_url, records):
    rec, _ = records
    publish.publish(publish.live_tables(2026, rec), db_url, 2026)
    from elo import load_params, run_elo
    from ingest import load_odds
    odds = load_odds()
    e = odds.join(run_elo(odds, **load_params(odds), after=True))
    last = e[(e["season"] == 2026) & e["home_score"].notna()].iloc[-1]
    got = query(db_url, "select rating_before, rating_after, win_prob from elo_ratings where team = %s and played_on = %s",
                (last["home_team"], last["date"].date()))
    np.testing.assert_allclose(got[0], [last["elo_home"], last["elo_home_after"], last["elo_prob"]], atol=1e-9)
    assert query(db_url, "select count(*) from elo_ratings where season = 2026")[0][0] == 2 * int(
        ((e["season"] == 2026) & e["home_score"].notna()).sum())


# ---------------------------------------------------------------- backfill

@pytest.mark.slow
@pytest.mark.skipif(not (ROOT / "reports" / "predictions_2026.csv").exists(),
                    reason="needs the final test's predictions (python src/train.py --final)")
def test_backfill_gives_the_final_test_s_numbers(db_url):
    """The 2026 final test, published as a backfill: the database's model_accuracy equals
    grade.metrics on the same predictions (which reproduces reports/final_2026.md, test_pipeline),
    and the Model's tipping record equals the graded tips."""
    tables = publish.backfill_tables(2026)
    counts = publish.publish(tables, db_url, 2026, backfill=True)
    assert counts["predictions"] == 213 and counts["model tips"] == 213

    from grade import grade, metrics
    preds = tables["predictions"].assign(start_time_utc=lambda d: d["created_at"] + pd.Timedelta(hours=1))
    want = metrics(grade(preds))
    got = pd.DataFrame(query(db_url, "select source, games, tips, accuracy, log_loss, brier, margin_mae, total_mae "
                                     "from model_accuracy where season = 2026 and round is null"),
                       columns=["source", "games", "tips", "accuracy", "log_loss", "brier", "margin_mae", "total_mae"])
    got = got.set_index("source")
    for mine, theirs in (("model", "Model"), ("market_open", "Market opening"), ("market_close", "Market closing"),
                         ("elo", "Elo")):
        for c in ["games", "tips", "accuracy", "log_loss", "brier", "margin_mae", "total_mae"]:
            w, g = want.loc[theirs, c], got.loc[mine, c]
            if pd.isna(w):
                assert g is None or pd.isna(g), (mine, c)
            else:
                assert float(g) == pytest.approx(float(w), abs=1e-9), (mine, c)

    model_correct = query(db_url, "select sum(correct) from round_scores s join profiles p on p.id = s.user_id "
                                  "where p.is_model and s.season = 2026")[0][0]
    assert model_correct == int(want.loc["Model", "tips"])
