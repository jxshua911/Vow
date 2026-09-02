drop policy if exists "delete_own_goal_clarifications" on public.goal_clarification_answers;
drop policy if exists "insert_own_goal_clarifications" on public.goal_clarification_answers;
drop policy if exists "select_own_goal_clarifications" on public.goal_clarification_answers;
drop policy if exists "update_own_goal_clarifications" on public.goal_clarification_answers;
create policy "delete_own_goal_clarifications" on public.goal_clarification_answers for delete using ((select auth.uid()) = user_id);
create policy "select_own_goal_clarifications" on public.goal_clarification_answers for select using ((select auth.uid()) = user_id);
create policy "update_own_goal_clarifications" on public.goal_clarification_answers for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "insert_own_goal_clarifications" on public.goal_clarification_answers for insert with check (((select auth.uid()) = user_id) and exists (select 1 from public.goals g where g.id = goal_clarification_answers.goal_id and g.user_id = (select auth.uid())));

drop policy if exists "Users can create their goal resources" on public.goal_resources;
drop policy if exists "Users can delete their goal resources" on public.goal_resources;
drop policy if exists "Users can read their goal resources" on public.goal_resources;
drop policy if exists "Users can update their goal resources" on public.goal_resources;
create policy "Users can create their goal resources" on public.goal_resources for insert with check ((select auth.uid()) = user_id);
create policy "Users can delete their goal resources" on public.goal_resources for delete using ((select auth.uid()) = user_id);
create policy "Users can read their goal resources" on public.goal_resources for select using ((select auth.uid()) = user_id);
create policy "Users can update their goal resources" on public.goal_resources for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "delete_own_goal_plan_items" on public.goal_plan_items;
drop policy if exists "insert_own_goal_plan_items" on public.goal_plan_items;
drop policy if exists "select_own_goal_plan_items" on public.goal_plan_items;
drop policy if exists "update_own_goal_plan_items" on public.goal_plan_items;
create policy "delete_own_goal_plan_items" on public.goal_plan_items for delete using ((select auth.uid()) = user_id);
create policy "select_own_goal_plan_items" on public.goal_plan_items for select using ((select auth.uid()) = user_id);
create policy "update_own_goal_plan_items" on public.goal_plan_items for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "insert_own_goal_plan_items" on public.goal_plan_items for insert with check (((select auth.uid()) = user_id) and exists (select 1 from public.goals g where g.id = goal_plan_items.goal_id and g.user_id = (select auth.uid())));

create index if not exists goal_clarification_answers_user_id_idx on public.goal_clarification_answers(user_id);
notify pgrst, 'reload schema';