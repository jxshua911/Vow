-- Remove service-role access to the obsolete user-context AI RPCs as well.
-- All trusted calls now use the explicit internal RPCs.

begin;

revoke all on function public.vow_claim_ai_guardrail(uuid, numeric)
  from service_role;
revoke all on function public.vow_release_ai_guardrail(uuid)
  from service_role;
revoke all on function public.vow_record_ai_usage(text, text, integer, text)
  from service_role;

commit;

notify pgrst, 'reload schema';
