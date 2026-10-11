-- Live edges (pipeline/edges.py): for each game still to kick off, the Model's fair odds beside Betr's
-- latest price, the expected edge on each side (probability x odds - 1), and the bet paper trading would
-- place. Head to head only, the market whose edge held up out of sample. The rule is paper.py's: the
-- side with the bigger edge (home on a tie) when it's at least min_bet_edge(), on the prediction of
-- record's probability. tests/test_publish.py checks this gives edges.py's numbers.

-- Paper trading's threshold (paper.MIN_EDGE).
create function min_bet_edge() returns double precision language sql immutable as $$ select 0.02::double precision $$;

-- The edges as they stood at `p_at`: games kicking off after it, priced from the last snapshot taken by
-- then (and before kickoff). A game Betr hasn't priced keeps its fair odds, with no edge or bet.
create function edges_at(p_at timestamptz)
returns table (match_id bigint, season int, round int, kickoff timestamptz, home_team text, away_team text,
               home_prob double precision, fair_home double precision, fair_away double precision,
               price_at timestamptz, home_odds double precision, away_odds double precision,
               market_home_prob double precision, home_edge double precision, away_edge double precision,
               bet_side text, bet_team text, bet_edge double precision)
language sql stable security invoker set search_path = public as $$
  with latest as (
    select distinct on (s.match_id) s.match_id, s.captured_at, s.home_odds, s.away_odds
    from odds_snapshots s join matches m on m.id = s.match_id
    where s.captured_at <= p_at and s.captured_at < m.kickoff
      and s.home_odds is not null and s.away_odds is not null
    order by s.match_id, s.captured_at desc
  ),
  e as (
    select m.id as match_id, m.season, m.round, m.kickoff, m.home_team, m.away_team,
           p.home_win_prob as home_prob, l.captured_at as price_at, l.home_odds, l.away_odds,
           p.home_win_prob * l.home_odds - 1 as home_edge,
           (1 - p.home_win_prob) * l.away_odds - 1 as away_edge
    from matches m
    join prediction_of_record p on p.match_id = m.id
    left join latest l on l.match_id = m.id
    where m.kickoff > p_at
  )
  select match_id, season, round, kickoff, home_team, away_team, home_prob,
         1 / home_prob, 1 / (1 - home_prob),
         price_at, home_odds, away_odds,
         (1 / home_odds) / (1 / home_odds + 1 / away_odds),
         home_edge, away_edge,
         b.side,
         case b.side when 'home' then home_team when 'away' then away_team end,
         case when b.side is not null then greatest(home_edge, away_edge) end
  from e
  cross join lateral (
    select case when home_edge >= away_edge and home_edge >= min_bet_edge() then 'home'
                when away_edge > home_edge and away_edge >= min_bet_edge() then 'away' end as side
  ) b
  order by kickoff, match_id
$$;

-- What the website reads: the edges now.
create view match_edges with (security_invoker = true) as select * from edges_at(now());

-- Model data, so anyone may read it (as the other model views). Supabase's defaults would grant more
-- on new objects, so start from nothing.
revoke all on function min_bet_edge(), edges_at(timestamptz) from public, anon, authenticated;
grant execute on function min_bet_edge(), edges_at(timestamptz) to anon, authenticated, analyst;
revoke all on match_edges from anon, authenticated;
grant select on match_edges to anon, authenticated, analyst;
