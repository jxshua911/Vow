-- The optional-time migration made goal_plan_items.scheduled_at nullable,
-- but the secure plan-lock RPC still required scheduled_at for every session.
-- Keep a session's title mandatory while allowing its time to remain unset.
DO $migration$
DECLARE
  ddl text;
  required_guard text := 'IF nullif(trim(session_item->>''title''),'''') IS NULL OR nullif(trim(session_item->>''scheduled_at''),'''') IS NULL THEN RAISE EXCEPTION ''SESSION_QUALITY_REJECTED''; END IF;';
  optional_guard text := 'IF nullif(trim(session_item->>''title''),'''') IS NULL THEN RAISE EXCEPTION ''SESSION_QUALITY_REJECTED''; END IF;';
BEGIN
  ddl := pg_get_functiondef('private.lock_goal_plan_secure(uuid,jsonb,jsonb,jsonb,jsonb)'::regprocedure);
  IF position(required_guard IN ddl) = 0 THEN
    IF position(optional_guard IN ddl) > 0 THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Could not find expected session schedule validation in private.lock_goal_plan_secure; refusing to modify function';
  END IF;
  ddl := replace(ddl, required_guard, optional_guard);
  EXECUTE ddl;
END;
$migration$;
