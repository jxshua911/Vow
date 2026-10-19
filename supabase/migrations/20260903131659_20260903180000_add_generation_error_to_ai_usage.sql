ALTER TABLE public.vow_ai_usage
  ADD COLUMN IF NOT EXISTS generation_error text;
