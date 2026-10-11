-- Launch monetisation: three completed plan generations per calendar month.
-- This is additive so previously applied migrations remain reproducible.

create or replace function public.vow_get_entitlement_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text := 'free';
  v_status text := 'inactive';
  v_active_goals integer := 0;
  v_planning_used integer := 0;
  v_adaptive_used integer := 0;
  v_advanced_used integer := 0;
  v_period date := date_trunc('month', now())::date;
begin
  if v_user_id is null then return null; end if;

  select plan, status into v_plan, v_status
    from public.vow_get_effective_entitlement() limit 1;

  select count(*)::integer into v_active_goals
    from public.goals where user_id = v_user_id and status = 'active';
  select count(*)::integer into v_planning_used
    from public.vow_entitlement_usage
   where user_id = v_user_id and feature = 'planning_action' and period_start = v_period;
  select count(*)::integer into v_adaptive_used
    from public.vow_entitlement_usage
   where user_id = v_user_id and feature = 'adaptive_replan' and period_start = v_period;
  select count(*)::integer into v_advanced_used
    from public.vow_ai_usage_events
   where user_id = v_user_id and mode = 'review' and outcome = 'success'
     and created_at >= date_trunc('month', now());

  return jsonb_build_object(
    'plan', case when v_status = 'active' and v_plan = 'premium' then 'premium' else 'free' end,
    'active_goals', v_active_goals,
    'active_goal_limit', case when v_status = 'active' and v_plan = 'premium' then null else 1 end,
    'planning_used', v_planning_used,
    'planning_limit', case when v_status = 'active' and v_plan = 'premium' then null else 3 end,
    'adaptive_replans_used', v_adaptive_used,
    'adaptive_replans_limit', case when v_status = 'active' and v_plan = 'premium' then null else 1 end,
    'advanced_reviews_used', v_advanced_used,
    'advanced_reviews_limit', case when v_status = 'active' and v_plan = 'premium' then null else 1 end,
    'period_start', v_period
  );
end;
$$;

create or replace function public.vow_reserve_entitlement(
  p_feature text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  period date := date_trunc('month', now())::date;
  used integer := 0;
  reserved integer := 0;
  limit_value integer;
  reservation_id uuid;
  expiry timestamptz := now() + interval '15 minutes';
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_feature not in ('planning_action','adaptive_replan') then raise exception 'Unknown entitlement feature'; end if;
  if public.vow_is_premium(uid) then
    return jsonb_build_object('allowed', true, 'plan', 'premium', 'feature', p_feature, 'reservation_id', null);
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text || ':' || p_feature || ':' || period::text));
  update public.vow_entitlement_reservations
     set status = 'released'
   where user_id = uid and feature = p_feature and period_start = period
     and status = 'reserved' and expires_at <= now();

  limit_value := case p_feature when 'planning_action' then 3 when 'adaptive_replan' then 1 end;
  select count(*)::integer into used from public.vow_entitlement_usage
   where user_id = uid and feature = p_feature and period_start = period;
  select count(*)::integer into reserved from public.vow_entitlement_reservations
   where user_id = uid and feature = p_feature and period_start = period
     and status = 'reserved' and expires_at > now();

  if used + reserved >= limit_value then
    return jsonb_build_object('allowed', false, 'feature', p_feature, 'reason', 'usage_limit', 'used', used + reserved, 'limit', limit_value);
  end if;

  insert into public.vow_entitlement_reservations(user_id, feature, period_start, status, expires_at, metadata)
  values (uid, p_feature, period, 'reserved', expiry, coalesce(p_metadata, '{}'::jsonb))
  returning id into reservation_id;
  return jsonb_build_object('allowed', true, 'feature', p_feature, 'used', used + reserved + 1, 'limit', limit_value, 'reservation_id', reservation_id);
end;
$$;

create or replace function public.vow_consume_entitlement(
  p_feature text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text := 'free';
  v_status text := 'inactive';
  v_used integer := 0;
  v_active_goals integer := 0;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || coalesce(p_feature, ''), 0));
  select plan, status into v_plan, v_status from public.vow_get_effective_entitlement() limit 1;
  if v_status = 'active' and v_plan = 'premium' and p_feature in ('create_goal', 'planning_action', 'adaptive_replan', 'advanced_review', 'deep_analysis', 'full_methodology') then
    return jsonb_build_object('allowed', true, 'feature', p_feature, 'used', 0, 'limit', null);
  end if;

  if p_feature = 'create_goal' then
    select count(*)::integer into v_active_goals from public.goals where user_id = v_user_id and status = 'active';
    if v_active_goals >= 1 then
      return jsonb_build_object('allowed', false, 'feature', p_feature, 'reason', 'active_goal_limit', 'used', v_active_goals, 'limit', 1);
    end if;
    return jsonb_build_object('allowed', true, 'feature', p_feature, 'used', v_active_goals, 'limit', 1);
  end if;

  if p_feature = 'planning_action' then
    select count(*)::integer into v_used from public.vow_entitlement_usage
     where user_id = v_user_id and feature = 'planning_action'
       and period_start = date_trunc('month', now())::date;
    if v_used >= 3 then
      return jsonb_build_object('allowed', false, 'feature', p_feature, 'reason', 'usage_limit', 'used', v_used, 'limit', 3);
    end if;
    insert into public.vow_entitlement_usage(user_id, feature, period_start, metadata)
    values (v_user_id, 'planning_action', date_trunc('month', now())::date, coalesce(p_metadata, '{}'::jsonb));
    return jsonb_build_object('allowed', true, 'feature', p_feature, 'used', v_used + 1, 'limit', 3);
  end if;

  if p_feature = 'adaptive_replan' then
    select count(*)::integer into v_used from public.vow_entitlement_usage
     where user_id = v_user_id and feature = 'adaptive_replan'
       and period_start = date_trunc('month', now())::date;
    if v_used >= 1 then
      return jsonb_build_object('allowed', false, 'feature', p_feature, 'reason', 'usage_limit', 'used', v_used, 'limit', 1);
    end if;
    insert into public.vow_entitlement_usage(user_id, feature, period_start, metadata)
    values (v_user_id, 'adaptive_replan', date_trunc('month', now())::date, coalesce(p_metadata, '{}'::jsonb));
    return jsonb_build_object('allowed', true, 'feature', p_feature, 'used', v_used + 1, 'limit', 1);
  end if;
  if p_feature in ('advanced_review', 'deep_analysis', 'full_methodology') then
    return jsonb_build_object('allowed', false, 'feature', p_feature, 'reason', 'premium_required', 'used', 0, 'limit', 0);
  end if;
  raise exception 'Unknown entitlement feature: %', p_feature;
end;
$$;

revoke all on function public.vow_reserve_entitlement(text, jsonb) from public, anon;
revoke all on function public.vow_consume_entitlement(text, jsonb) from public, anon;
grant execute on function public.vow_reserve_entitlement(text, jsonb) to authenticated;
grant execute on function public.vow_consume_entitlement(text, jsonb) to authenticated;
