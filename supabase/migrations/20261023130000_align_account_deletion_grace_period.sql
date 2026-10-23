-- Keep all account-deletion entry points aligned with the canonical 30-day grace period.
-- The current Android client uses vow-account-delete; these RPCs remain compatible
-- for older clients and must not create a conflicting 14-day deletion schedule.
BEGIN;

CREATE OR REPLACE FUNCTION public.vow_request_account_deletion()
RETURNS TABLE(delete_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_requested_at timestamptz := now();
  v_delete_at timestamptz := now() + interval '30 days';
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND';
  END IF;

  INSERT INTO public.user_settings
    (user_id, timezone, notification_frequency, coaching_tone, onboarding_complete,
     account_status, deleted_at, deletion_expires_at, updated_at)
  VALUES
    (v_user_id, 'UTC', 'weekly', 'honest_encouraging', false,
     'deleted', v_requested_at, v_delete_at, v_requested_at)
  ON CONFLICT (user_id) DO UPDATE SET
    account_status = 'deleted',
    deleted_at = EXCLUDED.deleted_at,
    deletion_expires_at = EXCLUDED.deletion_expires_at,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.vow_account_deletion_requests(user_id, requested_at, delete_at, cancelled_at)
  VALUES (v_user_id, v_requested_at, v_delete_at, NULL)
  ON CONFLICT (user_id) DO UPDATE SET
    requested_at = EXCLUDED.requested_at,
    delete_at = EXCLUDED.delete_at,
    cancelled_at = NULL;

  RETURN QUERY SELECT v_delete_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vow_cancel_account_deletion()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_request_cancelled boolean := false;
  v_settings_restored boolean := false;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  UPDATE public.vow_account_deletion_requests
     SET cancelled_at = now()
   WHERE user_id = v_user_id
     AND cancelled_at IS NULL
     AND delete_at > now();
  v_request_cancelled := FOUND;

  UPDATE public.user_settings
     SET account_status = 'active',
         deleted_at = NULL,
         deletion_expires_at = NULL,
         updated_at = now()
   WHERE user_id = v_user_id
     AND account_status = 'deleted'
     AND deletion_expires_at > now();
  v_settings_restored := FOUND;

  RETURN v_request_cancelled OR v_settings_restored;
END;
$function$;

REVOKE ALL ON FUNCTION public.vow_request_account_deletion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vow_request_account_deletion() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.vow_cancel_account_deletion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vow_cancel_account_deletion() TO authenticated, service_role;

COMMIT;
