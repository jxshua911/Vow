-- VOW adversarial hardening: close quota race windows at the database boundary.
-- 1) Enforce the one-active-goal free entitlement inside the goal INSERT transaction.
-- 2) Make AI cooldown check + consumption atomic.

CREATE OR REPLACE FUNCTION public.vow_guard_goal_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Never trust a client-supplied owner on a top-level goal.
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Goal ownership must match the authenticated user';
  END IF;

  -- Keep the existing entitlement policy, but execute it in the same
  -- transaction as the goal INSERT so the advisory lock covers the write.
  IF NEW.status IN ('active', 'locked') THEN
    result := public.vow_consume_entitlement('create_goal', jsonb_build_object('goal_id', NEW.id));
    IF coalesce((result->>'allowed')::boolean, false) = false THEN
      RAISE EXCEPTION 'VOW_ACTIVE_GOAL_LIMIT_REACHED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vow_goal_entitlement_guard ON public.goals;
CREATE TRIGGER vow_goal_entitlement_guard
BEFORE INSERT ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.vow_guard_goal_entitlement();

-- Atomic AI cooldown consumption. The lock is held for the entire statement
-- transaction, and the usage row is inserted only when the cooldown has elapsed.
CREATE OR REPLACE FUNCTION public.vow_consume_ai_cooldown(
  p_user_id uuid,
  p_kind text,
  p_cooldown_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  latest_at timestamptz;
  remaining integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;
  IF p_kind NOT IN ('plan', 'clarify', 'chat') THEN
    RAISE EXCEPTION 'Unknown AI usage kind';
  END IF;
  IF p_cooldown_seconds < 0 OR p_cooldown_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid cooldown';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ai-cooldown:' || p_user_id::text || ':' || p_kind));

  SELECT created_at
  INTO latest_at
  FROM public.vow_ai_usage
  WHERE user_id = p_user_id
    AND kind = p_kind
  ORDER BY created_at DESC
  LIMIT 1;

  IF latest_at IS NOT NULL THEN
    remaining := p_cooldown_seconds - floor(extract(epoch FROM (now() - latest_at)))::integer;
    IF remaining > 0 THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'retry_after_seconds', remaining,
        'kind', p_kind
      );
    END IF;
  END IF;

  INSERT INTO public.vow_ai_usage(user_id, kind)
  VALUES (p_user_id, p_kind);

  RETURN jsonb_build_object(
    'allowed', true,
    'kind', p_kind
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vow_consume_ai_cooldown(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vow_consume_ai_cooldown(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.vow_consume_ai_cooldown(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.vow_consume_ai_cooldown(uuid, text, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
