-- VOW Free/Premium entitlement system.
-- Free remains useful; Premium removes meaningful usage ceilings.

CREATE TABLE IF NOT EXISTS public.vow_user_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','cancelled','inactive')),
  provider text CHECK (provider IS NULL OR provider IN ('stripe')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vow_user_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own VOW entitlement" ON public.vow_user_entitlements;
CREATE POLICY "Users can read their own VOW entitlement"
  ON public.vow_user_entitlements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.vow_entitlement_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL CHECK (feature IN ('planning_action','adaptive_replan','advanced_review')),
  period_start date NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vow_entitlement_usage_user_feature_period_idx
  ON public.vow_entitlement_usage(user_id, feature, period_start, created_at DESC);

ALTER TABLE public.vow_entitlement_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own VOW entitlement usage" ON public.vow_entitlement_usage;
CREATE POLICY "Users can read their own VOW entitlement usage"
  ON public.vow_entitlement_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.vow_is_premium(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vow_user_entitlements
    WHERE user_id = p_user_id
      AND plan = 'premium'
      AND status IN ('active','trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.vow_get_entitlement_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  premium boolean;
  period date := date_trunc('month', now())::date;
  active_goals integer;
  planning_used integer;
  replan_used integer;
  review_used integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  premium := public.vow_is_premium(uid);
  SELECT count(*)::integer INTO active_goals FROM public.goals WHERE user_id = uid AND status IN ('active','locked');
  SELECT count(*)::integer INTO planning_used FROM public.vow_entitlement_usage WHERE user_id = uid AND feature = 'planning_action' AND period_start = period;
  SELECT count(*)::integer INTO replan_used FROM public.vow_entitlement_usage WHERE user_id = uid AND feature = 'adaptive_replan' AND period_start = period;
  SELECT count(*)::integer INTO review_used FROM public.vow_entitlement_usage WHERE user_id = uid AND feature = 'advanced_review' AND period_start = period;

  RETURN jsonb_build_object(
    'plan', CASE WHEN premium THEN 'premium' ELSE 'free' END,
    'active_goals', active_goals,
    'active_goal_limit', CASE WHEN premium THEN NULL ELSE 1 END,
    'planning_used', planning_used,
    'planning_limit', CASE WHEN premium THEN NULL ELSE 10 END,
    'adaptive_replans_used', replan_used,
    'adaptive_replans_limit', CASE WHEN premium THEN NULL ELSE 1 END,
    'advanced_reviews_used', review_used,
    'advanced_reviews_limit', CASE WHEN premium THEN NULL ELSE 1 END,
    'period_start', period
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.vow_consume_entitlement(p_feature text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  premium boolean;
  period date := date_trunc('month', now())::date;
  used integer;
  limit_value integer;
  active_goals integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_feature NOT IN ('create_goal','planning_action','adaptive_replan','advanced_review','deep_analysis','full_methodology') THEN
    RAISE EXCEPTION 'Unknown entitlement feature';
  END IF;

  premium := public.vow_is_premium(uid);

  IF premium THEN
    RETURN jsonb_build_object('allowed', true, 'plan', 'premium', 'feature', p_feature);
  END IF;

  IF p_feature = 'create_goal' THEN
    SELECT count(*)::integer INTO active_goals FROM public.goals WHERE user_id = uid AND status IN ('active','locked');
    IF active_goals >= 1 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'active_goal_limit', 'used', active_goals, 'limit', 1);
    END IF;
    RETURN jsonb_build_object('allowed', true, 'feature', p_feature);
  END IF;

  IF p_feature = 'deep_analysis' OR p_feature = 'full_methodology' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'premium_required');
  END IF;

  limit_value := CASE p_feature
    WHEN 'planning_action' THEN 10
    WHEN 'adaptive_replan' THEN 1
    WHEN 'advanced_review' THEN 1
  END;

  SELECT count(*)::integer INTO used
  FROM public.vow_entitlement_usage
  WHERE user_id = uid AND feature = p_feature AND period_start = period;

  IF used >= limit_value THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'usage_limit', 'feature', p_feature, 'used', used, 'limit', limit_value);
  END IF;

  INSERT INTO public.vow_entitlement_usage(user_id, feature, period_start, metadata)
  VALUES (uid, p_feature, period, coalesce(p_metadata, '{}'::jsonb));

  RETURN jsonb_build_object('allowed', true, 'feature', p_feature, 'used', used + 1, 'limit', limit_value);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vow_get_entitlement_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vow_consume_entitlement(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vow_is_premium(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
