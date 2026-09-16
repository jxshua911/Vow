-- VOW adversarial hardening: minimise the public attack surface of entitlement helpers.

-- The client only needs to inspect its own entitlement. Do not expose an
-- arbitrary-user premium oracle through a SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION public.vow_is_premium(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.vow_user_entitlements
      WHERE user_id = p_user_id
        AND plan = 'premium'
        AND status IN ('active','trialing')
        AND (current_period_end IS NULL OR current_period_end > now())
    )
  END;
$$;

-- SECURITY DEFINER helpers should never be executable by anonymous/public users.
REVOKE ALL ON FUNCTION public.vow_is_premium(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vow_is_premium(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.vow_get_entitlement_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vow_get_entitlement_snapshot() TO authenticated;

REVOKE ALL ON FUNCTION public.vow_consume_entitlement(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vow_consume_entitlement(text, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
