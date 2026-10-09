BEGIN;

ALTER TABLE public.vow_subscription_records
  ADD COLUMN IF NOT EXISTS grace_until timestamptz;

ALTER TABLE public.vow_user_entitlements
  ADD COLUMN IF NOT EXISTS grace_until timestamptz;

CREATE OR REPLACE FUNCTION public.vow_set_subscription_record(
  p_user_id uuid,
  p_provider text,
  p_product_id text,
  p_billing_period text,
  p_provider_purchase_id text,
  p_provider_event_id text,
  p_status text,
  p_purchased_at timestamptz,
  p_current_period_end timestamptz,
  p_auto_renewing boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_id uuid;
  v_grace_until timestamptz;
BEGIN
  IF p_user_id IS NULL
     OR p_provider NOT IN ('google_play','apple','stripe','manual')
     OR p_billing_period NOT IN ('monthly','yearly')
     OR p_status NOT IN ('active','grace','paused','cancelled','expired','pending','revoked')
     OR p_product_id IS NULL
     OR length(p_product_id) > 200
  THEN RAISE EXCEPTION 'INVALID_SUBSCRIPTION_RECORD'; END IF;

  v_grace_until := CASE
    WHEN p_status = 'grace' AND p_current_period_end IS NOT NULL
      THEN p_current_period_end + interval '3 days'
    ELSE NULL
  END;

  INSERT INTO public.vow_subscription_records
    (user_id,provider,product_id,billing_period,provider_purchase_id,provider_event_id,
     status,purchased_at,current_period_end,auto_renewing,grace_until)
  VALUES
    (p_user_id,p_provider,p_product_id,p_billing_period,nullif(p_provider_purchase_id,''),
     nullif(p_provider_event_id,''),p_status,p_purchased_at,p_current_period_end,
     p_auto_renewing,v_grace_until)
  ON CONFLICT (provider, provider_purchase_id) DO UPDATE SET
    product_id=excluded.product_id,
    billing_period=excluded.billing_period,
    provider_event_id=coalesce(excluded.provider_event_id,public.vow_subscription_records.provider_event_id),
    status=excluded.status,
    purchased_at=excluded.purchased_at,
    current_period_end=excluded.current_period_end,
    auto_renewing=excluded.auto_renewing,
    grace_until=excluded.grace_until,
    updated_at=now()
  RETURNING id INTO v_id;

  IF v_id IS NULL AND p_provider_event_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.vow_subscription_records
    WHERE provider=p_provider AND provider_event_id=p_provider_event_id LIMIT 1;
  END IF;

  IF v_id IS NULL THEN RAISE EXCEPTION 'SUBSCRIPTION_RECORD_WRITE_FAILED'; END IF;

  INSERT INTO public.vow_payment_events
    (user_id,provider,provider_event_id,event_type,amount_minor,currency,status,metadata)
  VALUES
    (p_user_id,p_provider,coalesce(nullif(p_provider_event_id,''),'subscription:'||v_id::text),
     'subscription_state',null,null,p_status,
     jsonb_build_object('product_id',p_product_id,'billing_period',p_billing_period,'grace_until',v_grace_until))
  ON CONFLICT (provider, provider_event_id) DO NOTHING;

  INSERT INTO public.vow_user_entitlements
    (user_id,plan,status,provider,current_period_end,grace_until,updated_at)
  VALUES
    (p_user_id,
     CASE WHEN p_status IN ('active','grace') THEN 'premium' ELSE 'free' END,
     CASE
       WHEN p_status='active' AND (p_current_period_end IS NULL OR p_current_period_end>now()) THEN 'active'
       WHEN p_status='grace' AND v_grace_until>now() THEN 'active'
       ELSE 'inactive'
     END,
     p_provider,p_current_period_end,v_grace_until,now())
  ON CONFLICT (user_id) DO UPDATE SET
    plan=excluded.plan,
    status=excluded.status,
    provider=excluded.provider,
    current_period_end=excluded.current_period_end,
    grace_until=excluded.grace_until,
    updated_at=now();

  RETURN v_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.vow_get_effective_entitlement()
RETURNS TABLE(plan text,status text,provider text,current_period_end timestamptz)
LANGUAGE sql
SET search_path TO 'pg_catalog','public'
AS $function$
  SELECT e.plan,
    CASE
      WHEN e.plan='premium' AND e.status='active'
       AND (e.current_period_end IS NULL OR e.current_period_end>now() OR e.grace_until>now())
        THEN 'active'
      ELSE 'inactive'
    END,
    e.provider,e.current_period_end
  FROM public.vow_user_entitlements e
  WHERE e.user_id=(select auth.uid())
  LIMIT 1
$function$;

COMMIT;
