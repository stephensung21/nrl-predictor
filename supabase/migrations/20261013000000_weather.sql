-- Weather for each game, for the website (PLAN_WEB.md step 5; pipeline/fetch_weather.py). Not a model
-- input. The latest forecast before kickoff, and what the weather was once the game is over, from
-- Open-Meteo (CC BY 4.0: the site credits open-meteo.com wherever it shows them).

create table weather (
  match_id bigint not null references matches (id),
  kind text not null check (kind in ('forecast', 'observed')),
  fetched_at timestamptz not null,
  source text check (source in ('forecast', 'archive')),  -- Open-Meteo's forecast service or reanalysis
  roofed boolean not null default false,  -- a roofed venue: no weather
  temp_c real,               -- at kickoff
  rain_mm real,              -- over the 2 hours from kickoff
  rain_chance int check (rain_chance between 0 and 100),  -- highest hourly chance; forecasts only
  wind_kmh real,             -- mean over the 2 hours
  gust_kmh real,             -- strongest gust
  wind_dir int check (wind_dir between 0 and 360),         -- degrees the wind comes from, at kickoff
  weather_code int,          -- the most severe WMO code over the 2 hours
  conditions text,           -- its description ("Light rain")
  primary key (match_id, kind)
);

-- One row per game: what the weather was if known, otherwise the latest forecast.
create view match_weather with (security_invoker = true) as
  select distinct on (match_id) *
  from weather
  order by match_id, (kind = 'observed') desc;

alter table weather enable row level security;
create policy "anyone reads weather" on weather for select to anon, authenticated, analyst using (true);

-- Supabase grants new tables to anon and authenticated by default: start from nothing, as in
-- 20261011000000_model_data.sql.
revoke all on weather, match_weather from anon, authenticated;
grant select on weather, match_weather to anon, authenticated, analyst;
