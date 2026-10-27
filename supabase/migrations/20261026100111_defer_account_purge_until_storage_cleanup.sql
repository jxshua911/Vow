-- Permanent account purge must remove private Storage objects through the Storage API first.
-- The client is instructed to call the service-role-only purge Edge Function after expiry.
BEGIN;

CREATE OR REPLACE FUNCTION public.vow_restore_or_purge_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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

  IF settings_row.account_status <> 'deleted' THEN
    RETURN jsonb_build_object('status', 'active');
  END IF;

  IF settings_row.deletion_expires_at IS NOT NULL
     AND settings_row.deletion_expires_at > now() THEN
    UPDATE public.user_settings
       SET account_status = 'active',
           deleted_at = NULL,
           deletion_expires_at = NULL,
           updated_at = now()
     WHERE user_id = uid;

    RETURN jsonb_build_object('status', 'restored');
  END IF;

  -- Do not purge relational data here: the Edge Function must first remove
  -- this user's private goal-resource objects via the Supabase Storage API.
  RETURN jsonb_build_object('status', 'purge_required');
END;
$$;

CREATE OR REPLACE FUNCTION public.vow_purge_expired_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings_row public.user_settings%rowtype;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED';
  END IF;

  SELECT *
    INTO settings_row
    FROM public.user_settings
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'already_purged');
  END IF;

  IF settings_row.account_status <> 'deleted'
     OR settings_row.deletion_expires_at IS NULL
     OR settings_row.deletion_expires_at > now() THEN
    RAISE EXCEPTION 'ACCOUNT_PURGE_NOT_ELIGIBLE';
  END IF;

  PERFORM public.delete_user_account_data(p_user_id);
  RETURN jsonb_build_object('status', 'purged');
END;
$$;

REVOKE ALL ON FUNCTION public.vow_purge_expired_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vow_purge_expired_account(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.vow_restore_or_purge_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vow_restore_or_purge_account() TO authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
