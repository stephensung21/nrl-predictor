-- What drove each prediction, and the match brief every LLM text is written from (PLAN_WEB.md §7.1,
-- §7.4; src/explain.py, pipeline/brief.py). Both are written with the prediction they belong to, from
-- the same frozen models and inputs, and never recomputed.

-- One row per prediction and model input, plus a '(baseline)' row (the home side's average edge) and a
-- '(calibration)' row (the win model's gap between its raw parts and the published probability).
-- Positive numbers favour the home team. margin_pts add up exactly to the predicted margin.
create table prediction_drivers (
  run_id text not null,
  match_id bigint not null,
  variant text not null check (variant in ('with_odds', 'no_odds')),
  driver_group text not null,       -- market, strength, lineup, stars, form, context, conditions, baseline, calibration, other
  feature text not null,            -- the model input
  value double precision,           -- its value for this game (null for baseline and calibration)
  margin_pts double precision not null,   -- points of predicted home margin
  win_logodds double precision not null,  -- log-odds of a home win, before calibration
  primary key (run_id, match_id, feature),
  foreign key (run_id, match_id) references predictions (run_id, match_id)
);

-- The facts pack for one prediction: sections such as prediction, drivers, market, elo, form,
-- team_news and conditions, each present only when it has data.
create table match_briefs (
  run_id text not null,
  match_id bigint not null,
  brief_version text not null,
  brief jsonb not null,
  created_at timestamptz not null,
  primary key (run_id, match_id),
  foreign key (run_id, match_id) references predictions (run_id, match_id)
);

-- Each text points at the brief it was written from (null for texts written before briefs, and for
-- round recaps); the full match summary and post-mortems are new kinds.
alter table summaries add column brief_run_id text;
alter table summaries add constraint summaries_brief_fkey
  foreign key (brief_run_id, match_id) references match_briefs (run_id, match_id);
alter table summaries drop constraint summaries_kind_check;
alter table summaries add constraint summaries_kind_check
  check (kind in ('match_preview', 'match_summary', 'match_postmortem', 'round_recap', 'model_review'));

-- Each game's drivers from its prediction of record, summed by group: what the match page shows.
create view record_drivers with (security_invoker = true) as
select d.match_id, d.run_id, d.variant, d.driver_group,
       sum(d.margin_pts) as margin_pts, sum(d.win_logodds) as win_logodds
from prediction_drivers d
join prediction_of_record r on r.run_id = d.run_id and r.match_id = d.match_id
group by d.match_id, d.run_id, d.variant, d.driver_group;

-- Each game's brief from its prediction of record.
create view record_briefs with (security_invoker = true) as
select b.*
from match_briefs b
join prediction_of_record r on r.run_id = b.run_id and r.match_id = b.match_id;

alter table prediction_drivers enable row level security;
alter table match_briefs enable row level security;
create policy "anyone reads drivers" on prediction_drivers for select to anon, authenticated, analyst using (true);
create policy "anyone reads briefs" on match_briefs for select to anon, authenticated, analyst using (true);

-- Supabase grants new tables to anon and authenticated by default: start from nothing, as in
-- 20261011000000_model_data.sql.
revoke all on prediction_drivers, match_briefs, record_drivers, record_briefs from anon, authenticated;
grant select on prediction_drivers, match_briefs, record_drivers, record_briefs to anon, authenticated, analyst;
