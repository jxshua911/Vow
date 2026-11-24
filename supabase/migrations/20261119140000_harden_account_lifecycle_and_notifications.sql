BEGIN;

-- Persist the Android notification channel selected by each device so remote
-- FCM messages use the same sound/vibration settings as local reminders.
ALTER TABLE public.vow_push_devices
  ADD COLUMN IF NOT EXISTS channel_id text NOT NULL DEFAULT 'vow-reminders-sound-vibrate-v1';

DROP FUNCTION IF EXISTS public.vow_touch_push_device(text, text);
CREATE OR REPLACE FUNCTION public.vow_touch_push_device(
  p_token text,
  p_build_tier text,
  p_channel_id text DEFAULT 'vow-reminders-sound-vibrate-v1'
)
RETURNS void
LANGUAGE sql
SET search_path = 'public'
AS $function$
  INSERT INTO public.vow_push_devices (user_id, token, platform, build_tier, channel_id, updated_at, last_seen_at)
  VALUES (
    (SELECT auth.uid()),
    p_token,
    'android',
    p_build_tier,
    CASE
      WHEN p_channel_id IN (
        'vow-reminders-sound-vibrate-v1',
        'vow-reminders-silent-vibrate-v1',
        'vow-reminders-sound-quiet-v1',
        'vow-reminders-silent-quiet-v1'
      ) THEN p_channel_id
      ELSE 'vow-reminders-sound-vibrate-v1'
    END,
    now(),
    now()
  )
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        build_tier = EXCLUDED.build_tier,
        channel_id = EXCLUDED.channel_id,
        updated_at = now(),
        last_seen_at = now();
$function$;

REVOKE ALL ON FUNCTION public.vow_touch_push_device(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vow_touch_push_device(text, text, text) TO authenticated;

-- A pending deletion must never be cancelled implicitly by opening the app.
-- Only the explicit vow_restore_account RPC below can restore it.
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

  IF NOT FOUND OR settings_row.account_status <> 'deleted' THEN
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

  IF NOT FOUND OR settings_row.account_status <> 'deleted' THEN
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
         updated_at = now()
   WHERE user_id = uid;

  RETURN jsonb_build_object('status', 'restored');
END;
$function$;

REVOKE ALL ON FUNCTION public.vow_restore_or_purge_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vow_restore_or_purge_account() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.vow_restore_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vow_restore_account() TO authenticated;

-- Pending deletion must block every authenticated data path immediately,
-- including sessions that were already open on another device.
DO $policy$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND c.relrowsecurity
       AND EXISTS (
         SELECT 1
           FROM pg_attribute a
          WHERE a.attrelid = c.oid
            AND a.attname = 'user_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
       )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS vow_active_account_guard ON public.%I', target.relname);
    EXECUTE format(
      'CREATE POLICY vow_active_account_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.vow_account_is_active()) WITH CHECK (public.vow_account_is_active())',
      target.relname
    );
  END LOOP;
END;
$policy$;

-- Storage is private and user-scoped too; pending accounts cannot fetch or
-- upload objects during the grace period.
DROP POLICY IF EXISTS vow_active_account_guard ON storage.objects;
CREATE POLICY vow_active_account_guard ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.vow_account_is_active())
  WITH CHECK (public.vow_account_is_active());

-- Generate a high-entropy internal cron secret once and keep it in Supabase Vault.
DO $vault$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'vow_account_purge_cron_secret'
  ) THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'vow_account_purge_cron_secret',
      'Internal authentication for VOW expired-account purge cron'
    );
  END IF;
END;
$vault$;

CREATE OR REPLACE FUNCTION public.vow_validate_account_purge_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p_secret IS NOT NULL
     AND length(p_secret) >= 40
     AND EXISTS (
       SELECT 1
         FROM vault.decrypted_secrets
        WHERE name = 'vow_account_purge_cron_secret'
          AND decrypted_secret = p_secret
     );
$function$;

REVOKE ALL ON FUNCTION public.vow_validate_account_purge_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vow_validate_account_purge_cron_secret(text) TO service_role;

-- Run every 15 minutes. The Edge Function first removes the user's private
-- Storage objects, then calls Auth Admin deleteUser; Auth foreign keys cascade
-- the remaining relational data and invalidate all sessions.
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'vow-account-purge-expired';

SELECT cron.schedule(
  'vow-account-purge-expired',
  '*/15 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://vqsrdausvmfjayffxiuh.supabase.co/functions/v1/vow-account-purge-expired',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-vow-account-purge-secret',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vow_account_purge_cron_secret')
      ),
      body := jsonb_build_object('source', 'pg_cron'),
      timeout_milliseconds := 10000
    );
  $cron$
);

COMMIT;
