create index if not exists idx_session_actions_parent_scope
  on public.session_actions(parent_action_id, session_id, goal_id, user_id);

drop policy if exists select_own_session_actions on public.session_actions;
create policy select_own_session_actions
  on public.session_actions
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.sessions s
      where s.id = session_actions.session_id
        and s.user_id = (select auth.uid())
        and s.goal_id = session_actions.goal_id
    )
  );

drop policy if exists insert_own_session_actions on public.session_actions;
create policy insert_own_session_actions
  on public.session_actions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.sessions s
      where s.id = session_actions.session_id
        and s.user_id = (select auth.uid())
        and s.goal_id = session_actions.goal_id
    )
  );

drop policy if exists update_own_session_actions on public.session_actions;
create policy update_own_session_actions
  on public.session_actions
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.sessions s
      where s.id = session_actions.session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.sessions s
      where s.id = session_actions.session_id
        and s.user_id = (select auth.uid())
        and s.goal_id = session_actions.goal_id
    )
  );

drop policy if exists delete_own_session_actions on public.session_actions;
create policy delete_own_session_actions
  on public.session_actions
  for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.sessions s
      where s.id = session_actions.session_id
        and s.user_id = (select auth.uid())
    )
  );
