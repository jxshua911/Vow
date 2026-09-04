-- Prevent two scheduled commitments for the same VOW user from occupying the exact same timestamp.
-- This keeps generated goal plans and calendar sync from stacking unrelated goals at one time.
create unique index if not exists sessions_user_scheduled_unique
  on public.sessions (user_id, scheduled_at)
  where status = 'scheduled';

create unique index if not exists goal_plan_items_user_scheduled_unique
  on public.goal_plan_items (user_id, scheduled_at)
  where status = 'scheduled';
