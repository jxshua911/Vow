-- Allow a plan to be organised by week/day without inventing a clock time.
ALTER TABLE public.goal_plan_items
  ALTER COLUMN scheduled_at DROP NOT NULL;

DO $migration$
DECLARE
  ddl text;
  original_guard text := 'IF nullif(trim(item->>''day_of_week''),'''') IS NULL OR nullif(trim(item->>''scheduled_at''),'''') IS NULL THEN RAISE EXCEPTION ''PLAN_ITEM_SCHEDULE_INVALID''; END IF;';
  optional_guard text := 'IF nullif(trim(item->>''day_of_week''),'''') IS NULL THEN RAISE EXCEPTION ''PLAN_ITEM_SCHEDULE_INVALID''; END IF;';
BEGIN
  ddl := pg_get_functiondef('private.lock_goal_plan_secure(uuid,jsonb,jsonb,jsonb,jsonb)'::regprocedure);
  IF position(original_guard IN ddl) = 0 THEN
    RAISE EXCEPTION 'Could not find expected schedule validation in private.lock_goal_plan_secure; refusing to modify function';
  END IF;
  ddl := replace(ddl, original_guard, optional_guard);
  EXECUTE ddl;
END;
$migration$;
