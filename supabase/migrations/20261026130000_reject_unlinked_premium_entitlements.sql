-- Premium must be backed by a trusted provider, an explicit manual grant, or an authorized personal-build override.
-- A legacy premium row with no provider, expiry, subscription record, payment event, or admin override is not a valid entitlement.
BEGIN;

CREATE OR REPLACE FUNCTION public.vow_is_premium(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vow_user_entitlements e
    WHERE e.user_id = p_user_id
      AND (
        (e.personal_build_override AND e.personal_build_plan = 'premium')
        OR (
          NOT e.personal_build_override
          AND e.plan = 'premium'
          AND e.provider = 'manual'
          AND e.status IN ('active', 'trialing')
        )
        OR (
          NOT e.personal_build_override
          AND e.plan = 'premium'
          AND e.provider IN ('google_play', 'apple', 'stripe')
          AND e.status IN ('active', 'trialing')
          AND e.current_period_end IS NOT NULL
          AND e.current_period_end > now()
        )
        OR (
          NOT e.personal_build_override
          AND e.plan = 'premium'
          AND e.provider IN ('google_play', 'apple', 'stripe')
          AND e.status = 'grace'
          AND e.grace_until IS NOT NULL
          AND e.grace_until > now()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.vow_get_effective_entitlement()
RETURNS TABLE(plan text, status text, provider text, current_period_end timestamptz)
LANGUAGE sql
SECURITY INVOKER
SET search_path = 'pg_catalog', 'public'
AS $$
  SELECT
    CASE
      WHEN e.personal_build_override THEN COALESCE(e.personal_build_plan, 'free')
      WHEN e.provider IS NULL AND e.plan = 'premium' THEN 'free'
      ELSE e.plan
    END,
    CASE
      WHEN e.personal_build_override THEN 'active'
      WHEN e.provider = 'manual'
        AND e.plan = 'premium'
        AND e.status IN ('active', 'trialing') THEN 'active'
      WHEN e.provider IN ('google_play', 'apple', 'stripe')
        AND e.plan = 'premium'
        AND e.status IN ('active', 'trialing')
        AND e.current_period_end IS NOT NULL
        AND e.current_period_end > now() THEN 'active'
      WHEN e.provider IN ('google_play', 'apple', 'stripe')
        AND e.plan = 'premium'
        AND e.status = 'grace'
        AND e.grace_until IS NOT NULL
        AND e.grace_until > now() THEN 'active'
      ELSE 'inactive'
    END,
    e.provider,
    e.current_period_end
  FROM public.vow_user_entitlements e
  WHERE e.user_id = (select auth.uid())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.vow_is_premium(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vow_is_premium(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.vow_get_effective_entitlement() TO authenticated;

-- Remove only clearly orphaned, unbilled Premium state. Keep any row with a
-- recognized provider, subscription link, payment ledger event, or explicit override.
UPDATE public.vow_user_entitlements e
SET plan = 'free',
    status = 'inactive',
    personal_build_plan = 'free',
    updated_at = now()
WHERE e.plan = 'premium'
  AND e.status IN ('active', 'trialing')
  AND e.provider IS NULL
  AND e.current_period_end IS NULL
  AND NOT e.personal_build_override
  AND e.stripe_customer_id IS NULL
  AND e.stripe_subscription_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.vow_subscription_records s WHERE s.user_id = e.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.vow_payment_events p WHERE p.user_id = e.user_id
  );

COMMIT;
NOTIFY pgrst, 'reload schema';
