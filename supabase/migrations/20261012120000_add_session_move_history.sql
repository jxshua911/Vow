-- Record each successful session move so weekly reviews count moves in the week they happened.
create table if not exists public.vow_session_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  from_date timestamptz not null,
  to_date timestamptz not null,
  moved_at timestamptz not null default now()
);

create index if not exists vow_session_moves_user_moved_at_idx
  on public.vow_session_moves (user_id, moved_at);
create index if not exists vow_session_moves_session_id_idx
  on public.vow_session_moves (session_id);

alter table public.vow_session_moves enable row level security;

drop policy if exists "Users can read their own session move history" on public.vow_session_moves;
create policy "Users can read their own session move history"
  on public.vow_session_moves for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can record their own session moves" on public.vow_session_moves;
create policy "Users can record their own session moves"
  on public.vow_session_moves for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

grant select, insert on public.vow_session_moves to authenticated;
