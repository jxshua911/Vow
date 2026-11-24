BEGIN;

CREATE TABLE IF NOT EXISTS public.vow_ai_provider_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('mistral','groq','qwen','nova','openai')),
  model text NOT NULL,
  request_kind text NOT NULL CHECK (request_kind IN ('clarify','plan','plan_retry')),
  prompt_tokens integer CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens integer CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  total_tokens integer CHECK (total_tokens IS NULL OR total_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vow_ai_provider_usage_user_created_idx
  ON public.vow_ai_provider_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vow_ai_provider_usage_request_idx
  ON public.vow_ai_provider_usage (request_id, created_at);

ALTER TABLE public.vow_ai_provider_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vow_ai_provider_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.vow_ai_provider_usage TO service_role;

CREATE OR REPLACE FUNCTION public.vow_record_ai_provider_usage(
  p_request_id text,
  p_provider text,
  p_model text,
  p_request_kind text,
  p_prompt_tokens integer DEFAULT NULL,
  p_completion_tokens integer DEFAULT NULL,
  p_total_tokens integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_request_id IS NULL OR length(p_request_id) > 80
     OR p_provider NOT IN ('mistral','groq','qwen','nova','openai')
     OR p_request_kind NOT IN ('clarify','plan','plan_retry')
     OR p_model IS NULL OR length(p_model) = 0 OR length(p_model) > 128
     OR p_prompt_tokens < 0 OR p_completion_tokens < 0 OR p_total_tokens < 0
  THEN RAISE EXCEPTION 'INVALID_AI_PROVIDER_USAGE'; END IF;

  INSERT INTO public.vow_ai_provider_usage (
    request_id,user_id,provider,model,request_kind,prompt_tokens,completion_tokens,total_tokens
  ) VALUES (
    p_request_id,uid,p_provider,p_model,p_request_kind,p_prompt_tokens,p_completion_tokens,p_total_tokens
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.vow_record_ai_provider_usage(text,text,text,text,integer,integer,integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vow_record_ai_provider_usage(text,text,text,text,integer,integer,integer)
  TO authenticated;

COMMIT;
