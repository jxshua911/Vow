begin;

alter policy "delete_own_goal_clarifications"
  on public.goal_clarification_answers
  to authenticated;

alter policy "insert_own_goal_clarifications"
  on public.goal_clarification_answers
  to authenticated;

alter policy "select_own_goal_clarifications"
  on public.goal_clarification_answers
  to authenticated;

alter policy "update_own_goal_clarifications"
  on public.goal_clarification_answers
  to authenticated;

alter policy "delete_own_goal_plan_items"
  on public.goal_plan_items
  to authenticated;

alter policy "insert_own_goal_plan_items"
  on public.goal_plan_items
  to authenticated;

alter policy "select_own_goal_plan_items"
  on public.goal_plan_items
  to authenticated;

alter policy "update_own_goal_plan_items"
  on public.goal_plan_items
  to authenticated;

commit;
