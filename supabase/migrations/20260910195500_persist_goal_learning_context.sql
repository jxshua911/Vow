alter table public.goals
  add column if not exists goal_context_json jsonb not null default '{}'::jsonb;

create index if not exists goals_goal_context_json_gin_idx
  on public.goals using gin (goal_context_json);
