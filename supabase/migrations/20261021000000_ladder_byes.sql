-- The NRL ladder behind the "ladder" auto-tip and Auto Pick, now as the NRL keeps it: 2 points for
-- a bye as well as a win, and regular-season games only. Before this, byes earned nothing, so a
-- team that had had a bye sat lower than on the real ladder, and the finals counted too.
--
-- A bye is an earlier regular-season round with no game for the team. A game in any state counts
-- as having played (a postponed game keeps its round, so it isn't a bye). Every team with a game
-- this season gets a row, including one whose only earlier rounds were byes.
-- Mirrors nrlLadderBefore in web/lib/scoring.ts; both are checked against tests/tipping/cases.json.

create or replace function nrl_ladder_before(p_season int, p_round int)
returns table (team text, pts int, diff int) language sql stable as $$
  with sides as (
    select round, status, home_team as team,
           case when home_score > away_score then 2 when home_score = away_score then 1 else 0 end as pts,
           home_score - away_score as diff
    from matches where season = p_season and not is_final
    union all
    select round, status, away_team,
           case when away_score > home_score then 2 when home_score = away_score then 1 else 0 end,
           away_score - home_score
    from matches where season = p_season and not is_final
  ),
  earlier as (
    select count(distinct round) as n from matches where season = p_season and not is_final and round < p_round
  )
  select s.team,
         (coalesce(sum(s.pts) filter (where s.round < p_round and s.status = 'final'), 0)
          + 2 * ((select n from earlier) - count(distinct s.round) filter (where s.round < p_round)))::int,
         coalesce(sum(s.diff) filter (where s.round < p_round and s.status = 'final'), 0)::int
  from sides s
  group by s.team
$$;
