-- Revoke direct authenticated access to the legacy entitlement reservation
-- and AI quality telemetry RPCs after vow-goal-ai has moved to internal RPCs.

begin;

revoke all on function public.vow_reserve_entitlement(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.vow_finalize_entitlement_reservation(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.vow_release_entitlement_reservation(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.vow_record_ai_quality_alert(uuid, uuid, text, text, text, text, jsonb)
  from public, anon, authenticated, service_role;

commit;

notify pgrst, 'reload schema';
