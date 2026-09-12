alter table public.goals
  add column if not exists planning_mode text default 'adaptive',
  add column if not exists horizon_source text default 'system';

alter table public.goals
  drop constraint if exists goals_planning_mode_check;

alter table public.goals
  add constraint goals_planning_mode_check
  check (planning_mode = any (array['one_time','project','recurring','mastery','performance','event','adaptive']));

alter table public.sessions
  alter column scheduled_at drop not null;
