create table if not exists public.vow_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, terms_version)
);

alter table public.vow_terms_acceptances enable row level security;

drop policy if exists "Users can view their own terms acceptances" on public.vow_terms_acceptances;
create policy "Users can view their own terms acceptances"
on public.vow_terms_acceptances
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can record their own terms acceptance" on public.vow_terms_acceptances;
create policy "Users can record their own terms acceptance"
on public.vow_terms_acceptances
for insert
to authenticated
with check (user_id = auth.uid());

revoke update, delete on public.vow_terms_acceptances from anon, authenticated;
grant select, insert on public.vow_terms_acceptances to authenticated;
