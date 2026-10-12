-- The players behind the star-absence drivers, for the match page's "Star players out" (PLAN_WEB.md §7.1;
-- src/explain.py star_players): on each star-absence row, the missing stars it counts as a JSON array of
-- {"team", "name"}, home side first. Null on every other row, and on drivers recorded before names were.
alter table prediction_drivers add column players jsonb;

-- record_drivers gains the group's players: both star-absence rows' arrays joined, spine first (null when none).
create or replace view record_drivers with (security_invoker = true) as
select d.match_id, d.run_id, d.variant, d.driver_group,
       sum(d.margin_pts) as margin_pts, sum(d.win_logodds) as win_logodds,
       jsonb_path_query_array(jsonb_agg(d.players order by d.feature desc) filter (where d.players is not null), '$[*][*]') as players
from prediction_drivers d
join prediction_of_record r on r.run_id = d.run_id and r.match_id = d.match_id
group by d.match_id, d.run_id, d.variant, d.driver_group;
