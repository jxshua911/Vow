-- Persist the exact VOW AI generation failure reason for durable fallback diagnostics.
-- generation_error is intentionally nullable and remains NULL for successful Groq generations.
ALTER TABLE public.vow_ai_usage
  ADD COLUMN IF NOT EXISTS generation_error text;
