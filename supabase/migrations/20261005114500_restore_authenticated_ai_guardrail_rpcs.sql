begin;

-- These user-scoped RPCs derive the caller from auth.uid() and are invoked by
-- vow-goal-ai with the authenticated user's JWT. Keep access limited to
-- authenticated callers; never expose the SECURITY DEFINER functions to anon
-- or PUBLIC.
revoke execute on function public.vow_claim_ai_guardrail(uuid, numeric) from public, anon;
revoke execute on function public.vow_record_ai_usage(text, text, integer, text) from public, anon;
revoke execute on function public.vow_release_ai_guardrail(uuid) from public, anon;

grant execute on function public.vow_claim_ai_guardrail(uuid, numeric) to authenticated;
grant execute on function public.vow_record_ai_usage(text, text, integer, text) to authenticated;
grant execute on function public.vow_release_ai_guardrail(uuid) to authenticated;

commit;
