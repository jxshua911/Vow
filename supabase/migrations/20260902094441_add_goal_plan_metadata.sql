alter table public.goals add column if not exists plan_json jsonb;
alter table public.goals add column if not exists plan_version integer;
alter table public.goals add column if not exists plan_generated_at timestamptz;
alter table public.goals add column if not exists planning_horizon_weeks integer;
alter table public.goals add column if not exists planning_timezone text;
notify pgrst, 'reload schema';
