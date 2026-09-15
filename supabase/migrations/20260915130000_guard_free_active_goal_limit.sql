-- Enforce the free-tier active-goal limit at the database boundary.
-- The client entitlement check remains for a friendly UX, but direct PostgREST
-- writes and concurrent requests must not be able to bypass the one-goal limit.
CREATE OR REPLACE FUNCTION public.vow_guard_goal_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NEW.status IN ('active', 'locked')
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status, 'draft') NOT IN ('active', 'locked')) THEN
    result := public.vow_consume_entitlement(
      'create_goal',
      jsonb_build_object('goal_id', NEW.id, 'surface', 'db_guard')
    );

    IF COALESCE((result->>'allowed')::boolean, false) = false THEN
      RAISE EXCEPTION 'VOW_FREE_ACTIVE_GOAL_LIMIT';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vow_goal_entitlement_guard ON public.goals;

CREATE TRIGGER vow_goal_entitlement_guard
  BEFORE INSERT OR UPDATE OF status ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.vow_guard_goal_entitlement();
