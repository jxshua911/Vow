-- Preserve a selected weekday even when a session has no fixed clock time.
-- Nullable and additive so existing sessions remain unchanged.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS day_of_week text;
