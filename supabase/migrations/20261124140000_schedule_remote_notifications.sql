BEGIN;

ALTER TABLE public.reminder_preferences
  ADD COLUMN IF NOT EXISTS sessions_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_reviews_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deadlines_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS streaks_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.vow_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('session','weekly_review','deadline','streak')),
  dedupe_key text NOT NULL UNIQUE,
  scheduled_at timestamptz NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','processing','sent','skipped','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vow_notification_queue_due_idx
  ON public.vow_notification_queue (scheduled_at, status)
  WHERE status IN ('scheduled','processing');

ALTER TABLE public.vow_notification_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vow_notification_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.vow_notification_queue TO service_role;

CREATE OR REPLACE FUNCTION public.vow_sync_session_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  reminders_enabled boolean := false;
  reminder_timezone text := 'UTC';
  quiet_start_time time;
  quiet_end_time time;
  fire_at timestamptz;
  local_fire_time time;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at
    OR OLD.title IS DISTINCT FROM NEW.title
  ) THEN
    UPDATE public.vow_notification_queue
       SET status = 'cancelled', updated_at = now()
     WHERE dedupe_key = 'session:' || NEW.id::text
       AND status IN ('scheduled','processing');
  END IF;

  IF NEW.status <> 'scheduled' OR NEW.scheduled_at IS NULL OR NEW.scheduled_at <= now() THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(rp.enabled, false) AND COALESCE(rp.sessions_enabled, true),
         COALESCE(NULLIF(rp.timezone, ''), 'UTC'),
         rp.quiet_start,
         rp.quiet_end
    INTO reminders_enabled, reminder_timezone, quiet_start_time, quiet_end_time
    FROM public.reminder_preferences rp
   WHERE rp.user_id = NEW.user_id;

  IF NOT COALESCE(reminders_enabled, false) THEN
    RETURN NEW;
  END IF;

  fire_at := GREATEST(NEW.scheduled_at - interval '15 minutes', now());
  local_fire_time := fire_at AT TIME ZONE reminder_timezone;
  IF quiet_start_time IS NOT NULL AND quiet_end_time IS NOT NULL AND
     CASE WHEN quiet_start_time < quiet_end_time
       THEN local_fire_time >= quiet_start_time AND local_fire_time < quiet_end_time
       ELSE local_fire_time >= quiet_start_time OR local_fire_time < quiet_end_time
     END THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.vow_notification_queue (
    user_id, category, dedupe_key, scheduled_at, title, body, data, status, attempts, updated_at
  )
  VALUES (
    NEW.user_id,
    'session',
    'session:' || NEW.id::text,
    fire_at,
    'Your VOW session is coming up',
    NEW.title,
    jsonb_build_object('sessionId', NEW.id::text, 'goalId', NEW.goal_id::text),
    'scheduled',
    0,
    now()
  )
  ON CONFLICT (dedupe_key) DO UPDATE
    SET scheduled_at = EXCLUDED.scheduled_at,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        data = EXCLUDED.data,
        status = 'scheduled',
        attempts = 0,
        last_error = NULL,
        delivered_at = NULL,
        updated_at = now();

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS vow_sync_session_notification ON public.sessions;
CREATE TRIGGER vow_sync_session_notification
AFTER INSERT OR UPDATE OF status, scheduled_at, title
ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.vow_sync_session_notification();

CREATE OR REPLACE FUNCTION public.vow_sync_user_session_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.vow_notification_queue
     SET status = 'cancelled', updated_at = now()
   WHERE user_id = NEW.user_id
     AND category = 'session'
     AND status IN ('scheduled','processing');

  IF NOT NEW.enabled THEN
    UPDATE public.vow_notification_queue
       SET status = 'cancelled', updated_at = now()
     WHERE user_id = NEW.user_id
       AND status IN ('scheduled','processing');
    RETURN NEW;
  END IF;

  IF NOT NEW.sessions_enabled THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.vow_notification_queue (
    user_id, category, dedupe_key, scheduled_at, title, body, data, status, attempts, updated_at
  )
  SELECT
    s.user_id,
    'session',
    'session:' || s.id::text,
    GREATEST(s.scheduled_at - interval '15 minutes', now()),
    'Your VOW session is coming up',
    s.title,
    jsonb_build_object('sessionId', s.id::text, 'goalId', s.goal_id::text),
    'scheduled',
    0,
    now()
  FROM public.sessions s
  WHERE s.user_id = NEW.user_id
    AND s.status = 'scheduled'
    AND s.scheduled_at > now()
    AND NOT (
      NEW.quiet_start IS NOT NULL AND NEW.quiet_end IS NOT NULL
      AND CASE WHEN NEW.quiet_start < NEW.quiet_end
        THEN (GREATEST(s.scheduled_at - interval '15 minutes', now()) AT TIME ZONE COALESCE(NULLIF(NEW.timezone, ''), 'UTC'))::time >= NEW.quiet_start
          AND (GREATEST(s.scheduled_at - interval '15 minutes', now()) AT TIME ZONE COALESCE(NULLIF(NEW.timezone, ''), 'UTC'))::time < NEW.quiet_end
        ELSE (GREATEST(s.scheduled_at - interval '15 minutes', now()) AT TIME ZONE COALESCE(NULLIF(NEW.timezone, ''), 'UTC'))::time >= NEW.quiet_start
          OR (GREATEST(s.scheduled_at - interval '15 minutes', now()) AT TIME ZONE COALESCE(NULLIF(NEW.timezone, ''), 'UTC'))::time < NEW.quiet_end
      END
    )
  ON CONFLICT (dedupe_key) DO UPDATE
    SET scheduled_at = EXCLUDED.scheduled_at,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        data = EXCLUDED.data,
        status = 'scheduled',
        attempts = 0,
        last_error = NULL,
        delivered_at = NULL,
        updated_at = now()
  WHERE public.vow_notification_queue.status IN ('cancelled','skipped','failed');

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS vow_sync_user_session_notifications ON public.reminder_preferences;
CREATE TRIGGER vow_sync_user_session_notifications
AFTER INSERT OR UPDATE OF enabled, sessions_enabled, timezone, quiet_start, quiet_end
ON public.reminder_preferences
FOR EACH ROW
EXECUTE FUNCTION public.vow_sync_user_session_notifications();

CREATE OR REPLACE FUNCTION public.vow_enqueue_periodic_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  inserted_count integer := 0;
  affected integer := 0;
BEGIN
  -- Weekly review: Sunday at 18:00 in the user's own timezone.
  WITH eligible AS (
    SELECT rp.user_id, COALESCE(NULLIF(rp.timezone, ''), NULLIF(us.timezone, ''), 'UTC') AS tz, rp.quiet_start, rp.quiet_end
      FROM public.reminder_preferences rp
      JOIN public.user_settings us ON us.user_id = rp.user_id
     WHERE rp.enabled = true
       AND rp.weekly_reviews_enabled = true
       AND us.account_status = 'active'
       AND EXISTS (SELECT 1 FROM public.goals g WHERE g.user_id = rp.user_id AND g.status IN ('active','locked'))
  ), due AS (
    SELECT user_id, tz, quiet_start, quiet_end, now() AT TIME ZONE tz AS local_now
      FROM eligible
  ), inserted AS (
    INSERT INTO public.vow_notification_queue (user_id, category, dedupe_key, scheduled_at, title, body, data)
    SELECT user_id, 'weekly_review',
      'weekly-review:' || user_id::text || ':' || date_trunc('week', local_now)::date::text,
      now(), 'Your weekly review is ready',
      'Take a moment to review your progress and set your next commitments.',
      '{}'::jsonb
    FROM due
    WHERE extract(dow FROM local_now) = 0
      AND local_now::time >= time '18:00'
      AND local_now::time < time '18:05'
      AND NOT (quiet_start IS NOT NULL AND quiet_end IS NOT NULL AND
        CASE WHEN quiet_start < quiet_end
          THEN local_now::time >= quiet_start AND local_now::time < quiet_end
          ELSE local_now::time >= quiet_start OR local_now::time < quiet_end
        END)
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO affected FROM inserted;
  inserted_count := inserted_count + affected;

  -- Goal deadlines: one reminder at 09:00 local time on the day before.
  WITH eligible AS (
    SELECT rp.user_id, COALESCE(NULLIF(rp.timezone, ''), NULLIF(us.timezone, ''), 'UTC') AS tz, rp.quiet_start, rp.quiet_end
      FROM public.reminder_preferences rp
      JOIN public.user_settings us ON us.user_id = rp.user_id
     WHERE rp.enabled = true
       AND rp.deadlines_enabled = true
       AND us.account_status = 'active'
  ), due AS (
    SELECT user_id, tz, quiet_start, quiet_end, (now() AT TIME ZONE tz)::date AS local_date,
           (now() AT TIME ZONE tz)::time AS local_time
      FROM eligible
  ), inserted AS (
    INSERT INTO public.vow_notification_queue (user_id, category, dedupe_key, scheduled_at, title, body, data)
    SELECT g.user_id, 'deadline',
      'deadline:' || g.id::text || ':' || g.deadline::text,
      now(), 'A goal deadline is approaching',
      'Your goal "' || left(g.title, 100) || '" is due tomorrow.',
      jsonb_build_object('goalId', g.id::text)
    FROM due d
    JOIN public.goals g ON g.user_id = d.user_id
    WHERE d.local_time >= time '09:00' AND d.local_time < time '09:05'
      AND NOT (d.quiet_start IS NOT NULL AND d.quiet_end IS NOT NULL AND
        CASE WHEN d.quiet_start < d.quiet_end
          THEN d.local_time >= d.quiet_start AND d.local_time < d.quiet_end
          ELSE d.local_time >= d.quiet_start OR d.local_time < d.quiet_end
        END)
      AND g.status IN ('active','locked')
      AND g.deadline = d.local_date + 1
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO affected FROM inserted;
  inserted_count := inserted_count + affected;

  -- Streak/progress nudge: Monday at 19:00 local, at most once per user/week.
  WITH eligible AS (
    SELECT rp.user_id, COALESCE(NULLIF(rp.timezone, ''), NULLIF(us.timezone, ''), 'UTC') AS tz, rp.quiet_start, rp.quiet_end
      FROM public.reminder_preferences rp
      JOIN public.user_settings us ON us.user_id = rp.user_id
     WHERE rp.enabled = true
       AND rp.streaks_enabled = true
       AND us.account_status = 'active'
       AND EXISTS (SELECT 1 FROM public.goals g WHERE g.user_id = rp.user_id AND g.status IN ('active','locked'))
       AND NOT EXISTS (
         SELECT 1 FROM public.sessions s
          WHERE s.user_id = rp.user_id
            AND s.status = 'completed'
            AND COALESCE(s.completed_at, s.updated_at) >= now() - interval '7 days'
       )
  ), due AS (
    SELECT user_id, now() AT TIME ZONE tz AS local_now FROM eligible
  ), inserted AS (
    INSERT INTO public.vow_notification_queue (user_id, category, dedupe_key, scheduled_at, title, body, data)
    SELECT user_id, 'streak',
      'streak:' || user_id::text || ':' || date_trunc('week', local_now)::date::text,
      now(), 'Keep your momentum alive',
      'You have not logged a completed session this week. Choose one small next step.',
      '{}'::jsonb
    FROM due
    WHERE extract(dow FROM local_now) = 1
      AND local_now::time >= time '19:00'
      AND local_now::time < time '19:05'
      AND NOT (quiet_start IS NOT NULL AND quiet_end IS NOT NULL AND
        CASE WHEN quiet_start < quiet_end
          THEN local_now::time >= quiet_start AND local_now::time < quiet_end
          ELSE local_now::time >= quiet_start OR local_now::time < quiet_end
        END)
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO affected FROM inserted;
  inserted_count := inserted_count + affected;

  RETURN inserted_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.vow_enqueue_periodic_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vow_enqueue_periodic_notifications() TO service_role;

CREATE OR REPLACE FUNCTION public.vow_claim_due_notifications(p_limit integer DEFAULT 50)
RETURNS SETOF public.vow_notification_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH due AS (
    SELECT id
      FROM public.vow_notification_queue
     WHERE (
       (status = 'scheduled' AND scheduled_at <= now())
       OR (status = 'processing' AND updated_at < now() - interval '10 minutes')
     )
       AND attempts < 5
     ORDER BY scheduled_at
     FOR UPDATE SKIP LOCKED
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  )
  UPDATE public.vow_notification_queue q
     SET status = 'processing',
         attempts = q.attempts + 1,
         updated_at = now()
    FROM due
   WHERE q.id = due.id
  RETURNING q.*;
$function$;

REVOKE ALL ON FUNCTION public.vow_claim_due_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vow_claim_due_notifications(integer) TO service_role;

DO $vault$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'vow_notification_dispatch_secret') THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'vow_notification_dispatch_secret',
      'Internal authentication for VOW notification dispatcher cron'
    );
  END IF;
END;
$vault$;

CREATE OR REPLACE FUNCTION public.vow_validate_notification_dispatch_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p_secret IS NOT NULL
     AND length(p_secret) >= 40
     AND EXISTS (
       SELECT 1 FROM vault.decrypted_secrets
        WHERE name = 'vow_notification_dispatch_secret'
          AND decrypted_secret = p_secret
     );
$function$;

REVOKE ALL ON FUNCTION public.vow_validate_notification_dispatch_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vow_validate_notification_dispatch_secret(text) TO service_role;

SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'vow-dispatch-notifications';

SELECT cron.schedule(
  'vow-dispatch-notifications',
  '*/5 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://vqsrdausvmfjayffxiuh.supabase.co/functions/v1/vow-dispatch-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-vow-notification-secret',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vow_notification_dispatch_secret')
      ),
      body := jsonb_build_object('source', 'pg_cron'),
      timeout_milliseconds := 20000
    );
  $cron$
);

COMMIT;
