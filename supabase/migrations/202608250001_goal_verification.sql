-- VOW goal verification foundation
-- Keeps external evidence separate from user-reported completion.

create table if not exists public.goal_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  source text not null check (source in ('self_report','google_calendar','strava','health_connect','focus_session','journal')),
  evidence_type text not null,
  evidence jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) not null default 0.0 check (confidence >= 0 and confidence <= 1),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (goal_id, source, evidence_type, observed_at)
);

create index if not exists goal_evidence_goal_id_idx on public.goal_evidence(goal_id);
create index if not exists goal_evidence_user_id_idx on public.goal_evidence(user_id);
create index if not exists goal_evidence_observed_at_idx on public.goal_evidence(observed_at desc);

alter table public.goal_evidence enable row level security;

create policy "Users can read their own goal evidence"
on public.goal_evidence for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own goal evidence"
on public.goal_evidence for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own goal evidence"
on public.goal_evidence for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own goal evidence"
on public.goal_evidence for delete
to authenticated
using (auth.uid() = user_id);
