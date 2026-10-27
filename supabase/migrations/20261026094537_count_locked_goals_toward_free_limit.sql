-- Locked goals occupy the Free active-goal slot too; keep the transition guard and quota calculation consistent.
BEGIN;

CREATE OR REPLACE FUNCTION public.vow_consume_entitlement(
  p_feature text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan text := 'free';
  v_status text := 'inactive';
  v_used integer := 0;
  v_limit integer := NULL;
  v_active_goals integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || COALESCE(p_feature, ''), 0));

  SELECT plan, status INTO v_plan, v_status
  FROM public.vow_get_effective_entitlement()
  LIMIT 1;

  IF v_plan IS NULL THEN v_plan := 'free'; v_status := 'inactive'; END IF;

  IF p_feature = 'create_goal' THEN
    SELECT count(*)::integer INTO v_active_goals
    FROM public.goals WHERE user_id = v_user_id AND status IN ('active', 'locked');

    IF v_status = 'active' AND v_plan = 'premium' THEN
      RETURN jsonb_build_object('allowed', true, 'feature', p_feature, 'used', v_active_goals, 'limit', NULL);
    END IF;

    IF v_active_goals >= 1 THEN
      RETURN jsonb_build_object('allowed', false, 'feature', p_feature, 'reason', 'active_goal_limit', 'used', v_active_goals, 'limit', 1);
    END IF;

    RETURN jsonb_build_object('allowed', true, 'feature', p_feature, 'used', v_active_goals, 'limit', 1);
  END IF;

  IF p_feature = 'planning_action' THEN
    IF v_status = 'active' AND v_plan = 'premium' THEN
      RETURN jsonb_build_object('allowed', true, 'feature', p_feature, 'used', 0, 'limit', NULL);
    END IF;

    SELECT count(*)::integer INTO v_used
    FROM public.vow_ai_usage_events
    WHERE user_id = v_user_id
      AND mode IN ('goal-clarify', 'goal-plan')
      AND outcome = 'success'
      AND created_at >= date_trunc('month', now());

    v_limit := 3;
    IF v_used >= v_limit THEN
      RETURN jsonb_build_object('allowed', false, 'feature', p_feature, 'reason', 'usage_limit', 'used', v_used, 'limit', v_limit);
    END IF;

    RETURN jsonb_build_object('allowed', true, 'feature', p_feature, 'used', v_used, 'limit', v_limit);
  END IF;

  IF p_feature = 'adaptive_replan' THEN
    IF v_status = 'active' AND v_plan = 'premium' THEN
      RETURN jsonb_build_object('allowed', true, 'feature', p_feature, 'used', 0, 'limit', NULL);
    END IF;

    SELECT count(*)::integer INTO v_used
    FROM public.vow_ai_usage_events
    WHERE user_id = v_user_id
      AND mode = 'chat'
      AND outcome = 'success'
      AND created_at >= date_trunc('month', now());

    v_limit := 1;
    IF v_used >= v_limit THEN
      RETURN jsonb_build_object('allowed', false, 'feature', p_feature, 'reason', 'usage_limit', 'used', v_used, 'limit', v_limit);
    END IF;

    RETURN jsonb_build_object('allowed', true, 'feature', p_feature, 'used', v_used, 'limit', v_limit);
  END IF;

  IF p_feature IN ('advanced_review', 'deep_analysis', 'full_methodology') THEN
    IF v_status = 'active' AND v_plan = 'premium' THEN
      RETURN jsonb_build_object('allowed', true, 'feature', p_feature, 'used', 0, 'limit', NULL);
    END IF;
    RETURN jsonb_build_object('allowed', false, 'feature', p_feature, 'reason', 'premium_required', 'used', 0, 'limit', 0);
  END IF;

  RAISE EXCEPTION 'Unknown entitlement feature: %', p_feature;
END;
$$;

REVOKE ALL ON FUNCTION public.vow_consume_entitlement(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vow_consume_entitlement(text, jsonb) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
