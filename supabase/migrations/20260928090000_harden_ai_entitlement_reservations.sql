-- Authoritative AI entitlement reservations.
-- A reservation is created atomically before AI work, finalized only after a
-- successful response, and released on recoverable failures. Expired
-- reservations stop counting so a crashed Edge Function cannot permanently
-- consume a user's allowance.

create table if not exists public.vow_entitlement_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('planning_action','adaptive_replan')),
  period_start date not null,
  status text not null default 'reserved' check (status in ('reserved','committed','released')),
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);

create index if not exists vow_entitlement_reservations_user_feature_period_idx
  on public.vow_entitlement_reservations(user_id, feature, period_start, status, expires_at);

alter table public.vow_entitlement_reservations enable row level security;
revoke all on public.vow_entitlement_reservations from public, anon, authenticated;

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
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_feature not in ('planning_action','adaptive_replan') then
    raise exception 'Unknown entitlement feature';
  end if;

  if public.vow_is_premium(uid) then
    return jsonb_build_object(
      'allowed', true,
      'plan', 'premium',
      'feature', p_feature,
      'reservation_id', null
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtext(uid::text || ':' || p_feature || ':' || period::text)
  );

  update public.vow_entitlement_reservations
  set status = 'released'
  where user_id = uid
    and feature = p_feature
    and period_start = period
    and status = 'reserved'
    and expires_at <= now();

  limit_value := case p_feature
    when 'planning_action' then 10
    when 'adaptive_replan' then 1
  end;

  select count(*)::integer
    into used
  from public.vow_entitlement_usage
  where user_id = uid
    and feature = p_feature
    and period_start = period;

  select count(*)::integer
    into reserved
  from public.vow_entitlement_reservations
  where user_id = uid
    and feature = p_feature
    and period_start = period
    and status = 'reserved'
    and expires_at > now();

  if used + reserved >= limit_value then
    return jsonb_build_object(
      'allowed', false,
      'feature', p_feature,
      'reason', 'usage_limit',
      'used', used + reserved,
      'limit', limit_value
    );
  end if;

  insert into public.vow_entitlement_reservations(
    user_id, feature, period_start, status, expires_at, metadata
  )
  values (
    uid, p_feature, period, 'reserved', expiry, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into reservation_id;

  return jsonb_build_object(
    'allowed', true,
    'feature', p_feature,
    'used', used + reserved + 1,
    'limit', limit_value,
    'reservation_id', reservation_id
  );
end;
$$;

create or replace function public.vow_finalize_entitlement_reservation(
  p_reservation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.vow_entitlement_reservations%rowtype;
  period date;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into r
  from public.vow_entitlement_reservations
  where id = p_reservation_id
    and user_id = uid
  for update;

  if not found then
    return jsonb_build_object('finalized', false, 'reason', 'reservation_not_found');
  end if;

  if r.status = 'committed' then
    return jsonb_build_object('finalized', true, 'idempotent', true);
  end if;

  if r.status <> 'reserved' then
    return jsonb_build_object('finalized', false, 'reason', 'reservation_not_active');
  end if;

  if r.expires_at <= now() then
    update public.vow_entitlement_reservations
    set status = 'released'
    where id = r.id;
    return jsonb_build_object('finalized', false, 'reason', 'reservation_expired');
  end if;

  period := r.period_start;

  perform pg_advisory_xact_lock(
    hashtext(uid::text || ':' || r.feature || ':' || period::text)
  );

  insert into public.vow_entitlement_usage(
    user_id, feature, period_start, metadata
  )
  values (
    uid,
    r.feature,
    period,
    coalesce(r.metadata, '{}'::jsonb) || jsonb_build_object('reservation_id', r.id)
  );

  update public.vow_entitlement_reservations
  set status = 'committed',
      finalized_at = now()
  where id = r.id;

  return jsonb_build_object('finalized', true, 'reservation_id', r.id);
end;
$$;

create or replace function public.vow_release_entitlement_reservation(
  p_reservation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.vow_entitlement_reservations
  set status = 'released'
  where id = p_reservation_id
    and user_id = uid
    and status = 'reserved';

  return found;
end;
$$;

revoke all on function public.vow_reserve_entitlement(text, jsonb) from public, anon;
revoke all on function public.vow_finalize_entitlement_reservation(uuid) from public, anon;
revoke all on function public.vow_release_entitlement_reservation(uuid) from public, anon;

grant execute on function public.vow_reserve_entitlement(text, jsonb) to authenticated;
grant execute on function public.vow_finalize_entitlement_reservation(uuid) to authenticated;
grant execute on function public.vow_release_entitlement_reservation(uuid) to authenticated;
