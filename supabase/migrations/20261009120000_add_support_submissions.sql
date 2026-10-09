create table if not exists public.support_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  message text not null check (char_length(message) between 1 and 10000),
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  delivery_error text,
  created_at timestamptz not null default now()
);
alter table public.support_submissions enable row level security;
create policy "support_select_own" on public.support_submissions for select using (auth.uid() = user_id);
create policy "support_insert_own" on public.support_submissions for insert with check (auth.uid() = user_id);
revoke all on public.support_submissions from anon;
grant select, insert on public.support_submissions to authenticated;
