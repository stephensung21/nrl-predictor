"""
Tests for the website trial (pipeline/trial.py): the timetable, what's visible as the trial plays out
(nothing ahead of its time: no round before it opens, no price before it's captured, no result before
its refresh), and publishing to a database, which must refuse the real one. Uses the trial's records
in data/pipeline/trial/ (from `trial.py setup`), moved to a fixed start.
"""

import json
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


def test_timetable_keeps_each_games_weekday_and_time_one_round_a_week():
    g = games()
    t = trial.timetable(g, "2026-10-20").merge(g, on=["match_id", "round"])
    assert len(t) == 16
    for i, (rnd, r) in enumerate(t.groupby("round")):
        tuesday = SYD("2026-10-20") + pd.Timedelta(weeks=i)
        assert (r["opens_at"] == pd.Timestamp(tuesday.date()).tz_localize("UTC") + pd.Timedelta("07:15:00")).all()
        local = r["kickoff"].dt.tz_convert(trial.SYDNEY)
        real = r["start_time_utc"].dt.tz_convert(trial.SYDNEY)
        assert (local.dt.strftime("%H:%M") == real.dt.strftime("%H:%M")).all()
        assert ((local > r["opens_at"]) & (local < tuesday + pd.Timedelta(days=7))).all()
        moved = local.dt.dayofweek != real.dt.dayofweek
        # only Round 1's 3:30pm Las Vegas game moves, to the Saturday, clear of the 4:05pm game
        assert moved.sum() == (1 if rnd == 1 else 0)
        ordered = local.sort_values()
        assert (ordered.diff().dropna() >= trial.GAP).all()
    assert (t["results_at"] >= t["kickoff"] + pd.Timedelta(hours=2)).all()
    assert set(t["results_at"].dt.hour) <= set(trial.RESULT_HOURS_UTC)
    assert (t["results_at"] - t["kickoff"] < pd.Timedelta(hours=24)).all()
    with pytest.raises(SystemExit, match="Monday"):
        trial.timetable(g, "2026-10-19")


def test_nothing_shows_before_its_time(odds):
    t = trial_from("2026-10-20")
    opens = t["timetable"]["opens_at"].min()
    assert set(trial.visible(t, opens - pd.Timedelta(minutes=1), odds)) == {"model_versions"}

    opened = trial.visible(t, opens, odds)
    m = opened["matches"]
    assert len(m) == 8 and set(m["round"]) == {1} and (m["status"] == "scheduled").all()
    assert m["home_score"].isna().all()
    assert (opened["predictions"]["created_at"] == opens).all()
    assert len(opened["odds_snapshots"]) == 8  # opening prices only
    assert len(opened["elo_ratings"]) == 0 and opened["graded_games"].empty
    assert opened["rounds"]["featured_match"].isin(m["id"]).all()
    assert len(opened["prediction_drivers"]) > 0
    assert (opened["team_lists"]["fetched_at"] == opens).all()  # Tuesday's only
    stars = opened["prediction_drivers"].dropna(subset=["players"])
    assert len(stars) > 0 and stars["driver_group"].eq("stars").all()

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

    end = trial.visible(t, SYD("2026-11-03 12:00"), odds)
    assert len(end["matches"]) == 16 and (end["matches"]["status"] == "final").all()
    assert len(end["graded_games"]) == 16 and set(end["rounds"]["round"]) == {1, 2}
    # Elo dated on the trial's days, one rating per team per game
    assert len(end["elo_ratings"]) == 32
    assert set(pd.to_datetime(end["elo_ratings"]["played_on"]).dt.month) == {10, 11}


def test_margin_games_follow_the_rule():
    r = trial.load_trial()["rounds"].sort_values("round")
    for prev, cur in zip(r.iloc[:-1].itertuples(), r.iloc[1:].itertuples()):
        assert not {cur.home_team, cur.away_team} & {prev.home_team, prev.away_team}


def test_publishes_to_a_trial_database_and_refuses_the_real_one(db_url, odds):
    # Round 1 opened on the last Tuesday at least two days ago, so now is somewhere in its week.
    today = pd.Timestamp.now(tz=trial.SYDNEY).normalize().tz_localize(None)
    t = trial_from(today - pd.Timedelta(days=(today.dayofweek - 1) % 7 + 7 * ((today.dayofweek - 1) % 7 < 2)))
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
    # the star players out reach the match page's view, home side first, as the trial recorded them
    shown = query(db_url, "select match_id, players from record_drivers where driver_group = 'stars' "
                          "and players is not null order by match_id")
    d = t["drivers"].dropna(subset=["players"]).sort_values("feature", ascending=False)         .groupby("match_id")["players"].apply(lambda cells: [p for c in cells for p in json.loads(c)])
    assert shown and {m: p for m, p in shown} == {m: d[m] for m, _ in shown}
    # Published again later: the same rows plus what's new, nothing lost.
    publish_to(db_url, trial.visible(t, now + pd.Timedelta(days=7), odds), trial.SEASON)
    assert query(db_url, "select count(*) from matches")[0][0] == 16

    conn.execute("insert into matches (id, season, round, kickoff, home_team, away_team, status) "
                 "values (1, 2026, 3, now(), 'Storm', 'Broncos', 'scheduled')")
    with pytest.raises(SystemExit, match="isn't the trial's"):
        trial.check_trial_db(conn.cursor())
