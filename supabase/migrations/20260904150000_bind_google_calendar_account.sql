-- Bind each VOW user to the exact Google account that authorised Calendar access.
-- Existing connections remain valid, but require re-authentication before calendar reads/writes
-- can be safely associated with a specific Google identity.
ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS google_account_id text,
  ADD COLUMN IF NOT EXISTS google_account_email text;

CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_connections_google_account_id_key
  ON public.google_calendar_connections (google_account_id)
  WHERE google_account_id IS NOT NULL;
