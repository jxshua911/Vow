create table if not exists public.goal_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  source text not null default 'manual',
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.goal_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  hypothesis text not null,
  approach text not null,
  status text not null default 'active',
  outcome text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.operating_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern_key text not null,
  title text not null,
  description text not null,
  confidence numeric not null default 0,
  evidence_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint operating_patterns_unique unique(user_id, pattern_key)
);

create table if not exists public.recovery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  reason text not null,
  strategy text not null,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.accountability_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  check_in_frequency text not null default 'weekly',
  commitment_note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.goal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null default 'general',
  template_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete cascade,
  prompt text not null,
  response text,
  checkin_type text not null default 'progress',
  created_at timestamptz not null default now()
);

create table if not exists public.vow_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_key text not null,
  memory text not null,
  source text not null default 'user',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vow_memory_unique unique(user_id,memory_key)
);

create index if not exists goal_evidence_goal_idx on public.goal_evidence(goal_id,occurred_at desc);
create index if not exists goal_experiments_goal_idx on public.goal_experiments(goal_id,created_at desc);
create index if not exists recovery_events_user_idx on public.recovery_events(user_id,created_at desc);
create index if not exists ai_checkins_user_idx on public.ai_checkins(user_id,created_at desc);

alter table public.goal_evidence enable row level security;
alter table public.goal_experiments enable row level security;
alter table public.operating_patterns enable row level security;
alter table public.recovery_events enable row level security;
alter table public.accountability_settings enable row level security;
alter table public.goal_templates enable row level security;
alter table public.ai_checkins enable row level security;
alter table public.vow_memory enable row level security;

grant select,insert,update,delete on public.goal_evidence to authenticated;
grant select,insert,update,delete on public.goal_experiments to authenticated;
grant select,insert,update,delete on public.operating_patterns to authenticated;
grant select,insert,update,delete on public.recovery_events to authenticated;
grant select,insert,update,delete on public.accountability_settings to authenticated;
grant select,insert,update,delete on public.goal_templates to authenticated;
grant select,insert,update,delete on public.ai_checkins to authenticated;
grant select,insert,update,delete on public.vow_memory to authenticated;

create policy "Users manage own goal evidence" on public.goal_evidence for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users manage own goal experiments" on public.goal_experiments for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users manage own operating patterns" on public.operating_patterns for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users manage own recovery events" on public.recovery_events for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users manage own accountability" on public.accountability_settings for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users manage own goal templates" on public.goal_templates for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users view shared goal templates" on public.goal_templates for select to authenticated using (user_id is null or (select auth.uid())=user_id);
create policy "Users manage own AI checkins" on public.ai_checkins for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users manage own VOW memory" on public.vow_memory for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
