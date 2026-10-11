create table if not exists public.support_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Not provided' check (char_length(name) <= 120),
  email text not null default '' check (char_length(email) <= 254),
  issue text not null default 'Support request' check (char_length(issue) <= 120),
  message text not null check (char_length(message) between 1 and 10000),
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  delivery_error text,
  created_at timestamptz not null default now()
);

create index if not exists support_submissions_user_created_idx
  on public.support_submissions (user_id, created_at desc);

create index if not exists support_submissions_delivery_status_idx
  on public.support_submissions (delivery_status, created_at desc);

alter table public.support_submissions enable row level security;

drop policy if exists support_select_own on public.support_submissions;
create policy support_select_own
  on public.support_submissions
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.support_submissions from anon, authenticated;
grant select on public.support_submissions to authenticated;
grant all on public.support_submissions to service_role;
