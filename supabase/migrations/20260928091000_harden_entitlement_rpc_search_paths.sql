-- Harden the exposed SECURITY DEFINER entitlement RPCs against mutable search paths.
-- auth.uid() is the only non-pg_catalog schema referenced by these functions;
-- application tables/functions are explicitly schema-qualified in their bodies.

alter function public.vow_consume_entitlement(text, jsonb)
  set search_path = pg_catalog, auth;

alter function public.vow_get_entitlement_snapshot()
  set search_path = pg_catalog, auth;

alter function public.file_consume_entitlement(text, jsonb)
  set search_path = pg_catalog, auth;

alter function public.vow_reserve_entitlement(text, jsonb)
  set search_path = pg_catalog, auth;

alter function public.vow_finalize_entitlement_reservation(uuid)
  set search_path = pg_catalog, auth;

alter function public.vow_release_entitlement_reservation(uuid)
  set search_path = pg_catalog, auth;
