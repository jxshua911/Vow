-- Permit plan items that have no fixed day or time.
-- Existing rows are preserved; scheduled_at is already nullable.
ALTER TABLE public.goal_plan_items
  ALTER COLUMN day_of_week DROP NOT NULL;
