create table if not exists public.vow_ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('plan','clarify','chat')),
  created_at timestamptz not null default now()
);
create index if not exists vow_ai_usage_user_created_idx on public.vow_ai_usage(user_id, created_at desc);
alter table public.vow_ai_usage enable row level security;
drop policy if exists "Users can read their own AI usage" on public.vow_ai_usage;
create policy "Users can read their own AI usage" on public.vow_ai_usage for select using ((select auth.uid()) = user_id);

alter table public.goals add column if not exists plan_json jsonb;
alter table public.goals add column if not exists plan_version integer;
alter table public.goals add column if not exists plan_generated_at timestamptz;
alter table public.goals add column if not exists planning_horizon_weeks integer;
alter table public.goals add column if not exists planning_timezone text;
notify pgrst, 'reload schema';
