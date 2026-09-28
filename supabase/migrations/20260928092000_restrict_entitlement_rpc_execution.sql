-- Ensure entitlement RPCs are callable only by authenticated users.
revoke all on function public.vow_consume_entitlement(text, jsonb) from public, anon;
revoke all on function public.vow_get_entitlement_snapshot() from public, anon;
revoke all on function public.file_consume_entitlement(text, jsonb) from public, anon;

grant execute on function public.vow_consume_entitlement(text, jsonb) to authenticated;
grant execute on function public.vow_get_entitlement_snapshot() to authenticated;
grant execute on function public.file_consume_entitlement(text, jsonb) to authenticated;
