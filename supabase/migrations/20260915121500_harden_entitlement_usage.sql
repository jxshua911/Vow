-- Prevent concurrent requests from spending the same free entitlement twice.
CREATE OR REPLACE FUNCTION public.vow_consume_entitlement(p_feature text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); premium boolean; period date := date_trunc('month', now())::date; used integer; limit_value integer; active_goals integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_feature NOT IN ('create_goal','planning_action','adaptive_replan','advanced_review','deep_analysis','full_methodology') THEN RAISE EXCEPTION 'Unknown entitlement feature'; END IF;
  premium := public.vow_is_premium(uid);
  IF premium THEN RETURN jsonb_build_object('allowed', true, 'plan', 'premium', 'feature', p_feature); END IF;

  -- Serialise quota checks for this user/feature/month.
  PERFORM pg_advisory_xact_lock(hashtext(uid::text || ':' || p_feature || ':' || period::text));

  IF p_feature = 'create_goal' THEN
    SELECT count(*)::integer INTO active_goals FROM public.goals WHERE user_id = uid AND status IN ('active','locked');
    IF active_goals >= 1 THEN RETURN jsonb_build_object('allowed', false, 'reason', 'active_goal_limit', 'used', active_goals, 'limit', 1); END IF;
    RETURN jsonb_build_object('allowed', true, 'feature', p_feature);
  END IF;
  IF p_feature IN ('deep_analysis','full_methodology') THEN RETURN jsonb_build_object('allowed', false, 'reason', 'premium_required'); END IF;

  limit_value := CASE p_feature WHEN 'planning_action' THEN 10 WHEN 'adaptive_replan' THEN 1 WHEN 'advanced_review' THEN 1 END;
  SELECT count(*)::integer INTO used FROM public.vow_entitlement_usage WHERE user_id = uid AND feature = p_feature AND period_start = period;
  IF used >= limit_value THEN RETURN jsonb_build_object('allowed', false, 'reason', 'usage_limit', 'feature', p_feature, 'used', used, 'limit', limit_value); END IF;

  INSERT INTO public.vow_entitlement_usage(user_id, feature, period_start, metadata) VALUES (uid, p_feature, period, coalesce(p_metadata, '{}'::jsonb));
  RETURN jsonb_build_object('allowed', true, 'feature', p_feature, 'used', used + 1, 'limit', limit_value);
END; $$;
