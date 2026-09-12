alter table public.goals
  add column if not exists planning_mode text,
  add column if not exists horizon_source text;

alter table public.goals
  drop constraint if exists goals_planning_mode_check;

alter table public.goals
  add constraint goals_planning_mode_check
  check (planning_mode is null or planning_mode = any (array['one_time','project','recurring','mastery','performance','event','adaptive']));

alter table public.goals
  drop constraint if exists goals_horizon_source_check;

alter table public.goals
  add constraint goals_horizon_source_check
  check (horizon_source is null or horizon_source = any (array['user','system','goal']));
