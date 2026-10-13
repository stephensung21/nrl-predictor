-- Late joiners, as the official NRL Tipping rules score them (docs/TIPPING_COMPARISON.md): a game
-- that kicked off before a tipper joined counts as a tip for the away team, and those tips earn at
-- most 4 points a round. Before this, a late joiner got their auto-tip for every earlier game, so a
-- "crowd" tipper joining in Round 10 took the comp's consensus on Rounds 1-9 for free.
--
-- "Joined" is `profiles.created_at`. The Model is never late: it tips every game it predicts.
-- The scoring mirrors web/lib/scoring.ts; both are checked against tests/tipping/cases.json.

-- At most this many points a round from games that kicked off before a tipper joined.
create function late_join_max_points() returns int language sql immutable as $$ select 4 $$;

-- The views are rebuilt from the bottom up, since `effective_tips` gains a column.
drop view round_scores;
drop view tip_results;
drop view effective_tips;

-- Every tipper's tip for every game that has locked: their own; the away team for a game that
-- kicked off before they joined; or their auto-tip.
create view effective_tips with (security_invoker = true) as
select p.id as user_id, m.id as match_id, m.season, m.round,
       case when t.team is not null then t.team
            when l.late then m.away_team
            else auto_tip(p.id, m.id) end as team,
       t.team is null as is_auto,
       t.margin,
       t.team is null and l.late as is_late
from profiles p
cross join matches m
left join tips t on t.user_id = p.id and t.match_id = m.id
cross join lateral (select not p.is_model and m.kickoff < p.created_at as late) l
where m.kickoff <= now() and m.status <> 'postponed';

-- Each tip marked correct once its game is decided. A draw, or a cancelled game, counts for both teams.
create view tip_results with (security_invoker = true) as
select e.*, m.status,
       m.status = 'cancelled'
         or m.home_score = m.away_score
         or e.team = case when m.home_score > m.away_score then m.home_team else m.away_team end as correct
from effective_tips e
join matches m on m.id = e.match_id
where m.status in ('final', 'cancelled');

-- Points, bonus point and margin score per tipper per round. `partial` while any of the round's
-- games is still to be decided; the bonus waits for the whole round. Late tips are auto-tips, so a
-- round with any never earns the bonus.
create view round_scores with (security_invoker = true) as
with tallies as (
  select user_id, season, round,
         count(*)::int as games,
         ((count(*) filter (where correct and not is_late))
          + least(late_join_max_points(), count(*) filter (where correct and is_late)))::int as correct,
         (count(*) filter (where is_auto))::int as auto_tips
  from tip_results
  group by user_id, season, round
),
undecided as (
  select season, round, count(*) as n
  from matches where status not in ('final', 'cancelled')
  group by season, round
),
-- Margins are signed from the home side, so tipping the wrong team counts against you:
-- Storm by 6 when the Broncos win by 4 is a margin score of 10.
featured as (
  select e.user_id, r.season, r.round,
         abs(case when e.team = m.home_team then 1 else -1 end * coalesce(e.margin, default_margin())
             - (m.home_score - m.away_score))::int as margin_score
  from rounds r
  join matches m on m.id = r.featured_match and m.status = 'final'
  join effective_tips e on e.match_id = m.id
)
select t.user_id, t.season, t.round, t.correct, t.games, t.auto_tips,
       (u.n is null and t.games >= bonus_min_games() and t.correct = t.games and t.auto_tips = 0)::int as bonus,
       coalesce(f.margin_score, 0) as margin_score,
       u.n is not null as partial
from tallies t
left join undecided u using (season, round)
left join featured f using (user_id, season, round);

revoke all on effective_tips, tip_results, round_scores from anon, authenticated;
grant select on effective_tips, tip_results, round_scores to authenticated;
revoke all on function late_join_max_points() from public, anon, authenticated;
grant execute on function late_join_max_points() to authenticated;
