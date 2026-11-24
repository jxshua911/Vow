BEGIN;

-- A queue item can target multiple registered devices. Keep delivery state per
-- device so a partial FCM failure retries only devices that have not succeeded.
CREATE TABLE IF NOT EXISTS public.vow_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.vow_notification_queue(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.vow_push_devices(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id, device_id)
);

CREATE INDEX IF NOT EXISTS vow_notification_deliveries_queue_status_idx
  ON public.vow_notification_deliveries (queue_id, status);
CREATE INDEX IF NOT EXISTS vow_notification_deliveries_user_created_idx
  ON public.vow_notification_deliveries (user_id, created_at DESC);

ALTER TABLE public.vow_notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vow_notification_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.vow_notification_deliveries TO service_role;

COMMIT;
