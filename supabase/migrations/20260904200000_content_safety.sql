create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  severity text not null check (severity in ('ambiguous', 'high', 'critical')),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  action text not null,
  strike_number integer,
  created_at timestamptz not null default now()
);

alter table public.moderation_events enable row level security;

revoke all on table public.moderation_events from anon, authenticated;

create index if not exists moderation_events_user_severity_created_idx
  on public.moderation_events(user_id, severity, created_at desc);
