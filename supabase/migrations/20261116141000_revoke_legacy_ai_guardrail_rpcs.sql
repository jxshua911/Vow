-- Disable the legacy authenticated AI guardrail and telemetry RPC entry points.
-- vow-goal-ai now uses the service-role-only internal RPCs.

begin;

revoke all on function public.vow_claim_ai_guardrail(uuid, numeric)
  from public, anon, authenticated;
revoke all on function public.vow_release_ai_guardrail(uuid)
  from public, anon, authenticated;
revoke all on function public.vow_record_ai_usage(text, text, integer, text)
  from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
