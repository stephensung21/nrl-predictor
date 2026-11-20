-- The players page (/players; docs/superpowers/specs/2026-11-21-players-page-design.md): each player's
-- season of stats and the Model's rating of him, written by pipeline/players.py through publish.py.
-- Model data like the rest: anyone (and the analyst) reads; only the service key writes.

create table player_seasons (
  season int not null,
  player_id bigint not null,
  player_name text not null,
  team text not null references teams (name),
  position text not null check (position in ('Fullback', 'Winger', 'Centre', 'Five-Eighth', 'Halfback', 'Hooker',
                                            'Prop', '2nd Row', 'Lock', 'Interchange')),
  games int not null,
  minutes int not null default 0,
  tries int not null default 0,
  points int not null default 0,
  goals int not null default 0,
  conversions int not null default 0,
  conversion_attempts int not null default 0,
  penalty_goals int not null default 0,
  field_goals int not null default 0,
  run_metres int not null default 0,
  runs int not null default 0,
  post_contact_metres int not null default 0,
  line_breaks int not null default 0,
  line_break_assists int not null default 0,
  try_assists int not null default 0,
  tackle_breaks int not null default 0,
  offloads int not null default 0,
  kick_return_metres int not null default 0,
  kicks int not null default 0,
  kick_metres int not null default 0,
  forty_twenty int not null default 0,
  forced_drop_outs int not null default 0,
  bomb_kicks int not null default 0,
  grubber_kicks int not null default 0,
  tackles int not null default 0,
  missed_tackles int not null default 0,
  ineffective_tackles int not null default 0,
  intercepts int not null default 0,
  one_on_one_steals int not null default 0,
  errors int not null default 0,
  penalties int not null default 0,
  sin_bins int not null default 0,
  send_offs int not null default 0,
  fantasy_points double precision not null default 0,
  primary key (season, player_id)
);

-- The RAPM rating the model would give the player for his next game, as of the season's last decided
-- game (features.player_ratings): points of margin over a full game, and its attack/defence split.
create table player_ratings (
  season int not null,
  player_id bigint not null,
  rating double precision not null,
  attack double precision not null,
  defence double precision not null,
  as_of date not null,
  primary key (season, player_id),
  foreign key (season, player_id) references player_seasons (season, player_id)
);

alter table player_seasons enable row level security;
alter table player_ratings enable row level security;
create policy "anyone reads player seasons" on player_seasons for select to anon, authenticated, analyst using (true);
create policy "anyone reads player ratings" on player_ratings for select to anon, authenticated, analyst using (true);
revoke all on player_seasons, player_ratings from anon, authenticated;
grant select on player_seasons, player_ratings to anon, authenticated, analyst;
