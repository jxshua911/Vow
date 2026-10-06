begin;

create or replace function public.vow_record_moderation_violation(
  p_user_id uuid,
  p_category text,
  p_severity text,
  p_confidence numeric
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_strike_number integer;
  v_action text;
begin
  if p_user_id is null
     or p_category is null
     or p_category not in ('threat', 'sexual_violence', 'child_safety', 'violent_harm', 'abuse')
     or p_severity is null
     or p_severity not in ('high', 'critical')
     or p_confidence is null
     or p_confidence < 0
     or p_confidence > 1 then
    raise exception 'Invalid moderation violation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select count(*)::integer + 1
  into v_strike_number
  from public.moderation_events
  where user_id = p_user_id
    and severity in ('high', 'critical')
    and category <> 'self_harm';

  v_action := case
    when v_strike_number <= 3 then 'reword_required'
    when v_strike_number = 4 then 'suspended'
    else 'banned'
  end;

  insert into public.moderation_events (
    user_id,
    category,
    severity,
    confidence,
    action,
    strike_number,
    owner_visible
  )
  values (
    p_user_id,
    p_category,
    p_severity,
    p_confidence,
    v_action,
    v_strike_number,
    v_strike_number >= 3
  );

  return v_strike_number;
end;
$$;

revoke all on function public.vow_record_moderation_violation(uuid, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.vow_record_moderation_violation(uuid, text, text, numeric)
  to service_role;

commit;
