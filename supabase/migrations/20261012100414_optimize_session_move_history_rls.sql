-- Avoid per-row re-evaluation of auth.uid() in session move history policies.
drop policy if exists "Users can read their own session move history" on public.vow_session_moves;
create policy "Users can read their own session move history"
  on public.vow_session_moves for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can record their own session moves" on public.vow_session_moves;
create policy "Users can record their own session moves"
  on public.vow_session_moves for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );
