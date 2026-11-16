-- Move entitlement reservation lifecycle and AI quality-alert writes behind
-- service-role-only RPCs. The Edge Function supplies only the user ID obtained
-- from auth.getUser(); clients cannot choose another user's identity.

begin;

create or replace function public.vow_reserve_entitlement_internal(
  p_user_id uuid,
  p_feature text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  uid uuid := p_user_id;
  period date := pg_catalog.date_trunc('month', pg_catalog.now())::date;
  used integer := 0;
  reserved integer := 0;
  limit_value integer;
  reservation_id uuid;
  expiry timestamptz := pg_catalog.now() + interval '15 minutes';
begin
  if uid is null then
    raise exception 'USER_ID_REQUIRED' using errcode = '22023';
  end if;
  if p_feature is null or p_feature not in ('planning_action', 'adaptive_replan') then
    raise exception 'Unknown entitlement feature' using errcode = '22023';
  end if;

  if public.vow_is_premium(uid) then
    return pg_catalog.jsonb_build_object(
      'allowed', true, 'plan', 'premium', 'feature', p_feature, 'reservation_id', null
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(uid::text || ':' || p_feature || ':' || period::text)
  );

  update public.vow_entitlement_reservations
  set status = 'released'
  where user_id = uid and feature = p_feature and period_start = period
    and status = 'reserved' and expires_at <= pg_catalog.now();

  limit_value := case p_feature
    when 'planning_action' then 3
    when 'adaptive_replan' then 1
  end;

  select count(*)::integer into used
  from public.vow_entitlement_usage
  where user_id = uid and feature = p_feature and period_start = period;

  select count(*)::integer into reserved
  from public.vow_entitlement_reservations
  where user_id = uid and feature = p_feature and period_start = period
    and status = 'reserved' and expires_at > pg_catalog.now();

  if used + reserved >= limit_value then
    return pg_catalog.jsonb_build_object(
      'allowed', false, 'feature', p_feature, 'reason', 'usage_limit',
      'used', used + reserved, 'limit', limit_value
    );
  end if;

  insert into public.vow_entitlement_reservations (
    user_id, feature, period_start, status, expires_at, metadata
  )
  values (
    uid, p_feature, period, 'reserved', expiry, pg_catalog.coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into reservation_id;

  return pg_catalog.jsonb_build_object(
    'allowed', true, 'feature', p_feature, 'used', used + reserved + 1,
    'limit', limit_value, 'reservation_id', reservation_id
  );
end;
$function$;

create or replace function public.vow_finalize_entitlement_reservation_internal(
  p_user_id uuid,
  p_reservation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  uid uuid := p_user_id;
  r public.vow_entitlement_reservations%rowtype;
begin
  if uid is null or p_reservation_id is null then
    raise exception 'USER_ID_AND_RESERVATION_REQUIRED' using errcode = '22023';
  end if;

  select * into r
  from public.vow_entitlement_reservations
  where id = p_reservation_id and user_id = uid
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('finalized', false, 'reason', 'reservation_not_found');
  end if;
  if r.status = 'committed' then
    return pg_catalog.jsonb_build_object('finalized', true, 'idempotent', true);
  end if;
  if r.status <> 'reserved' then
    return pg_catalog.jsonb_build_object('finalized', false, 'reason', 'reservation_not_active');
  end if;

  if r.expires_at <= pg_catalog.now() then
    update public.vow_entitlement_reservations set status = 'released' where id = r.id;
    return pg_catalog.jsonb_build_object('finalized', false, 'reason', 'reservation_expired');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(uid::text || ':' || r.feature || ':' || r.period_start::text)
  );

  insert into public.vow_entitlement_usage (user_id, feature, period_start, metadata)
  values (
    uid, r.feature, r.period_start,
    pg_catalog.coalesce(r.metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object('reservation_id', r.id)
  );

  update public.vow_entitlement_reservations
  set status = 'committed', finalized_at = pg_catalog.now()
  where id = r.id;

  return pg_catalog.jsonb_build_object('finalized', true, 'reservation_id', r.id);
end;
$function$;

create or replace function public.vow_release_entitlement_reservation_internal(
  p_user_id uuid,
  p_reservation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if p_user_id is null or p_reservation_id is null then
    return false;
  end if;

  update public.vow_entitlement_reservations
  set status = 'released'
  where id = p_reservation_id
    and user_id = p_user_id
    and status = 'reserved';

  return found;
end;
$function$;

create or replace function public.vow_record_ai_quality_alert_internal(
  p_user_id uuid,
  p_goal_id uuid,
  p_mode text,
  p_alert_type text,
  p_validation_code text,
  p_goal_title text,
  p_details jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED' using errcode = '22023';
  end if;
  if p_mode is null or p_mode not in ('goal-plan', 'goal-clarify', 'chat') then
    raise exception 'INVALID_AI_QUALITY_MODE' using errcode = '22023';
  end if;
  if p_alert_type is null or length(p_alert_type) > 80
     or p_validation_code is null or length(p_validation_code) > 120 then
    raise exception 'INVALID_AI_QUALITY_ALERT' using errcode = '22023';
  end if;

  insert into public.vow_ai_quality_alerts (
    user_id, goal_id, mode, alert_type, validation_code, goal_title, details
  )
  values (
    p_user_id, p_goal_id, p_mode, p_alert_type, p_validation_code,
    pg_catalog.left(pg_catalog.coalesce(p_goal_title, ''), 300),
    pg_catalog.coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.vow_reserve_entitlement_internal(uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.vow_finalize_entitlement_reservation_internal(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.vow_release_entitlement_reservation_internal(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.vow_record_ai_quality_alert_internal(uuid, uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.vow_reserve_entitlement_internal(uuid, text, jsonb)
  to service_role;
grant execute on function public.vow_finalize_entitlement_reservation_internal(uuid, uuid)
  to service_role;
grant execute on function public.vow_release_entitlement_reservation_internal(uuid, uuid)
  to service_role;
grant execute on function public.vow_record_ai_quality_alert_internal(uuid, uuid, text, text, text, text, jsonb)
  to service_role;

commit;

notify pgrst, 'reload schema';
