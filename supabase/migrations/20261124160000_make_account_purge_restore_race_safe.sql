BEGIN;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS purge_started_at timestamptz;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_account_status_check;
ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_account_status_check
  CHECK (account_status IN ('active','deleted','purging'));

-- Claiming a purge is atomic with account restoration. Once a row is marked
-- purging, a concurrent restore cannot reopen an account while its data is
-- being removed. A stale claim can be retried after 30 minutes.
CREATE OR REPLACE FUNCTION public.vow_claim_expired_account_purge(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  settings_row public.user_settings%rowtype;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
    INTO settings_row
    FROM public.user_settings
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND OR settings_row.deletion_expires_at IS NULL
     OR settings_row.deletion_expires_at > now() THEN
    RETURN false;
  END IF;

  IF settings_row.account_status = 'deleted' THEN
    UPDATE public.user_settings
       SET account_status = 'purging',
           purge_started_at = now(),
           updated_at = now()
     WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  IF settings_row.account_status = 'purging'
     AND (settings_row.purge_started_at IS NULL
          OR settings_row.purge_started_at < now() - interval '30 minutes') THEN
    UPDATE public.user_settings
       SET purge_started_at = now(),
           updated_at = now()
     WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.vow_claim_expired_account_purge(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vow_claim_expired_account_purge(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.vow_restore_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  settings_row public.user_settings%rowtype;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
    INTO settings_row
    FROM public.user_settings
   WHERE user_id = uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'active');
  END IF;

  IF settings_row.account_status = 'purging' THEN
    RETURN jsonb_build_object('status', 'purging');
  END IF;

  IF settings_row.account_status <> 'deleted' THEN
    RETURN jsonb_build_object('status', 'active');
  END IF;

  IF settings_row.deletion_expires_at IS NULL
     OR settings_row.deletion_expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  UPDATE public.user_settings
     SET account_status = 'active',
         deleted_at = NULL,
         deletion_expires_at = NULL,
         purge_started_at = NULL,
         updated_at = now()
   WHERE user_id = uid;

  RETURN jsonb_build_object('status', 'restored');
END;
$function$;

CREATE OR REPLACE FUNCTION public.vow_restore_or_purge_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  settings_row public.user_settings%rowtype;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
    INTO settings_row
    FROM public.user_settings
   WHERE user_id = uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'active');
  END IF;

  IF settings_row.account_status = 'purging' THEN
    RETURN jsonb_build_object(
      'status', 'purge_pending',
      'deleted_at', settings_row.deleted_at,
      'deletion_expires_at', settings_row.deletion_expires_at
    );
  END IF;

  IF settings_row.account_status <> 'deleted' THEN
    RETURN jsonb_build_object('status', 'active');
  END IF;

  IF settings_row.deletion_expires_at IS NOT NULL
     AND settings_row.deletion_expires_at > now() THEN
    RETURN jsonb_build_object(
      'status', 'deletion_pending',
      'deleted_at', settings_row.deleted_at,
      'deletion_expires_at', settings_row.deletion_expires_at
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'purge_pending',
    'deleted_at', settings_row.deleted_at,
    'deletion_expires_at', settings_row.deletion_expires_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.vow_restore_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vow_restore_account() TO authenticated;

REVOKE ALL ON FUNCTION public.vow_restore_or_purge_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vow_restore_or_purge_account() TO authenticated, service_role;

COMMIT;
