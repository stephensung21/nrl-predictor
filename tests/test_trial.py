"""
Tests for the website trial (pipeline/trial.py): the timetable, what's visible as the trial plays out
(nothing ahead of its time: no round before it opens, no price before it's captured, no result before
its refresh), and publishing to a database, which must refuse the real one. Uses the trial's records
in data/pipeline/trial/ (from `trial.py setup`), moved to a fixed start.
"""

import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))

import trial  # noqa: E402
from common import load_matches  # noqa: E402
from ingest import load_odds  # noqa: E402
from test_publish import close, connection, db_url, publish_to, query  # noqa: E402,F401

pytestmark = pytest.mark.skipif(not (trial.TRIAL / "trial.json").exists(), reason="no trial set up")
SYD = lambda s: pd.Timestamp(s, tz=trial.SYDNEY)  # noqa: E731


def games():
    m = load_matches()
    g = m[(m["season"] == 2026) & m["round"].isin(trial.ROUNDS)][["match_id", "round", "start_time_utc"]]
    return g.assign(start_time_utc=pd.to_datetime(g["start_time_utc"], utc=True))


def trial_from(start):
    t = trial.load_trial()
    t["timetable"] = trial.timetable(games(), start)
    return t


@pytest.fixture(scope="module")
def odds():
    return load_odds()


def test_timetable_compresses_each_round_into_two_days_in_real_order():
    g = games()
    t = trial.timetable(g, "2026-10-15").merge(g, on=["match_id", "round"])
    assert len(t) == 24
    for i, (rnd, r) in enumerate(t.groupby("round")):
        assert (r["opens_at"] == SYD("2026-10-15 09:00") + pd.Timedelta(days=3 * i)).all()
        local = r["kickoff"].dt.tz_convert(trial.SYDNEY)
        assert sorted(local.dt.strftime("%H:%M").value_counts().items()) == [(h, 2) for h in trial.GAME_TIMES]
        assert set((local.dt.normalize() - r["opens_at"].dt.tz_convert(trial.SYDNEY).dt.normalize()).dt.days) == {1, 2}
        # the real order kept
        assert list(r.sort_values("kickoff")["match_id"]) == list(r.sort_values(["start_time_utc", "match_id"])["match_id"])
    assert (t["results_at"] >= t["kickoff"] + pd.Timedelta(hours=2)).all()
    assert set(t["results_at"].dt.hour) <= set(trial.RESULT_HOURS_UTC)
    assert (t["results_at"] - t["kickoff"] < pd.Timedelta(hours=24)).all()


def test_nothing_shows_before_its_time(odds):
    t = trial_from("2026-10-15")
    assert set(trial.visible(t, SYD("2026-10-15 08:59"), odds)) == {"model_versions"}

    opened = trial.visible(t, SYD("2026-10-15 09:00"), odds)
    m = opened["matches"]
    assert len(m) == 8 and set(m["round"]) == {1} and (m["status"] == "scheduled").all()
    assert m["home_score"].isna().all()
    assert (opened["predictions"]["created_at"] == SYD("2026-10-15 09:00")).all()
    assert len(opened["odds_snapshots"]) == 8  # opening prices only
    assert len(opened["elo_ratings"]) == 0 and opened["graded_games"].empty
    assert opened["rounds"]["featured_match"].isin(m["id"]).all()
    assert len(opened["prediction_drivers"]) > 0
    assert (opened["team_lists"]["fetched_at"] == SYD("2026-10-15 09:00")).all()  # Tuesday's only

    first = t["timetable"].sort_values("kickoff").iloc[0]
    before = trial.visible(t, first["results_at"] - pd.Timedelta(seconds=1), odds)
    after = trial.visible(t, first["results_at"], odds)
    assert (before["matches"]["status"] == "scheduled").all()
    done = after["matches"][after["matches"]["status"] == "final"]
    assert list(done["id"]) == [first["match_id"]]
    real = load_matches().set_index("match_id").loc[first["match_id"]]
    assert (done["home_score"].iloc[0], done["away_score"].iloc[0]) == (real["home_score"], real["away_score"])
    assert len(after["elo_ratings"]) == 2 and len(after["graded_games"]) == 1
    assert len(after["odds_snapshots"]) == len(before["odds_snapshots"])  # closed before the result
    closing = trial.visible(t, first["kickoff"] - pd.Timedelta(minutes=31), odds)["odds_snapshots"]
    assert len(closing) == 8

    end = trial.visible(t, SYD("2026-11-01 12:00"), odds)
    assert len(end["matches"]) == 24 and (end["matches"]["status"] == "final").all()
    assert len(end["graded_games"]) == 24 and set(end["rounds"]["round"]) == {1, 2, 3}
    # Elo dated on the trial's days, one rating per team per game
    assert len(end["elo_ratings"]) == 48
    assert set(pd.to_datetime(end["elo_ratings"]["played_on"]).dt.month) == {10}


def test_margin_games_follow_the_rule():
    r = trial.load_trial()["rounds"].sort_values("round")
    for prev, cur in zip(r.iloc[:-1].itertuples(), r.iloc[1:].itertuples()):
        assert not {cur.home_team, cur.away_team} & {prev.home_team, prev.away_team}


def test_publishes_to_a_trial_database_and_refuses_the_real_one(db_url, odds):
    # Round 1 opened yesterday, so now is somewhere in its games, as the real clock sees it.
    today = pd.Timestamp.now(tz=trial.SYDNEY).normalize().tz_localize(None)
    t = trial_from(today - pd.Timedelta(days=1))
    now = pd.Timestamp.now(tz="UTC")
    conn = connection(db_url)
    trial.check_trial_db(conn.cursor())  # empty: fine
    counts = publish_to(db_url, trial.visible(t, now, odds), trial.SEASON)
    assert counts["predictions"] == 8
    assert query(db_url, "select count(*) from prediction_of_record")[0][0] == 8
    coming = (t["timetable"].query("round == 1")["kickoff"] > now).sum()
    assert counts["model tips"] == coming
    opening = query(db_url, "select home_odds_open from match_odds order by match_id")
    assert len(opening) == 8 and all(o[0] is not None for o in opening)
    # Published again later: the same rows plus what's new, nothing lost.
    publish_to(db_url, trial.visible(t, now + pd.Timedelta(days=3), odds), trial.SEASON)
    assert query(db_url, "select count(*) from matches")[0][0] == 16

    conn.execute("insert into matches (id, season, round, kickoff, home_team, away_team, status) "
                 "values (1, 2026, 4, now(), 'Storm', 'Broncos', 'scheduled')")
    with pytest.raises(SystemExit, match="isn't the trial's"):
        trial.check_trial_db(conn.cursor())
