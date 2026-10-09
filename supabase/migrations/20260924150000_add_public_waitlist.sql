create table if not exists public.vow_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'website',
  consented_at timestamptz not null default now(),
  launch_date date not null default date '2026-10-29',
  created_at timestamptz not null default now(),
  constraint vow_waitlist_email_format check (
    email ~* '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
  ),
  constraint vow_waitlist_source_length check (char_length(source) between 1 and 80)
);

create unique index if not exists vow_waitlist_email_unique
  on public.vow_waitlist (lower(email));

alter table public.vow_waitlist enable row level security;

drop policy if exists "waitlist_public_insert" on public.vow_waitlist;
create policy "waitlist_public_insert"
  on public.vow_waitlist
  for insert
  to anon, authenticated
  with check (
    email ~* '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
    and char_length(source) between 1 and 80
  );

revoke all on table public.vow_waitlist from anon, authenticated;
grant insert on table public.vow_waitlist to anon, authenticated;
