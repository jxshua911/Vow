-- AI guardrail limits must never be user-writable. The authenticated role only receives EXECUTE on the guardrail RPCs; it must never receive table DML on configuration or accounting tables.

revoke all on table public.vow_ai_guardrail_config from public, anon, authenticated;
revoke all on table public.vow_ai_budget_buckets from public, anon, authenticated;
revoke all on table public.vow_ai_request_leases from public, anon, authenticated;

-- Explicitly remove any accidental function-level grants that could expose a config mutator.
revoke all on function public.vow_claim_ai_guardrail(uuid, numeric) from public, anon;
revoke all on function public.vow_release_ai_guardrail(uuid) from public, anon;
revoke all on function public.vow_record_ai_usage(text, text, integer, text) from public, anon;

-- Keep only the intended authenticated RPC surface.
grant execute on function public.vow_claim_ai_guardrail(uuid, numeric) to authenticated;
grant execute on function public.vow_release_ai_guardrail(uuid) to authenticated;
grant execute on function public.vow_record_ai_usage(text, text, integer, text) to authenticated;

comment on table public.vow_ai_guardrail_config is
  'Server-owned AI safety limits. No public, anon, or authenticated table DML is permitted; changes require privileged database administration.';
