create or replace function public.vow_merge_sessions(
  p_source_session_id uuid,
  p_target_session_id uuid
)
returns table (
  target_session_id uuid,
  combined_duration_minutes integer,
  source_external_event_id text,
  target_external_event_id text,
  combined_notes text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.sessions%rowtype;
  v_target public.sessions%rowtype;
  v_notes text;
  v_duration integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_source_session_id is null or p_target_session_id is null
     or p_source_session_id = p_target_session_id then
    raise exception 'Choose two different sessions' using errcode = '22023';
  end if;

  select * into v_source
  from public.sessions
  where id = p_source_session_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'Source session not found' using errcode = 'P0002';
  end if;

  select * into v_target
  from public.sessions
  where id = p_target_session_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'Target session not found' using errcode = 'P0002';
  end if;

  if v_source.goal_id <> v_target.goal_id then
    raise exception 'Sessions must belong to the same goal' using errcode = '22023';
  end if;
  if v_source.status <> 'scheduled' or v_target.status <> 'scheduled' then
    raise exception 'Only scheduled sessions can be combined' using errcode = '22023';
  end if;

  v_duration := v_source.duration_minutes + v_target.duration_minutes;
  if v_duration > 1440 then
    raise exception 'Combined session exceeds 24 hours' using errcode = '22023';
  end if;

  select string_agg(line, chr(10) order by first_seen)
  into v_notes
  from (
    select line, min(ord) as first_seen
    from (
      select btrim(line) as line, ord
      from regexp_split_to_table(coalesce(v_target.notes, '') || chr(10) || coalesce(v_source.notes, ''), chr(10))
        with ordinality as split(line, ord)
      where btrim(line) <> ''
    ) all_lines
    group by line
  ) deduped;

  update public.session_actions
  set session_id = v_target.id, updated_at = now()
  where session_id = v_source.id and user_id = v_user_id;

  update public.vow_session_moves
  set session_id = v_target.id
  where session_id = v_source.id and user_id = v_user_id;

  update public.sessions
  set notes = nullif(v_notes, ''),
      duration_minutes = v_duration,
      updated_at = now()
  where id = v_target.id and user_id = v_user_id;

  delete from public.sessions
  where id = v_source.id and user_id = v_user_id;

  return query select v_target.id, v_duration,
    v_source.external_event_id::text, v_target.external_event_id::text,
    nullif(v_notes, '');
end;
$$;

revoke all on function public.vow_merge_sessions(uuid, uuid) from public, anon;
grant execute on function public.vow_merge_sessions(uuid, uuid) to authenticated;

create index if not exists idx_session_actions_parent_action_id
  on public.session_actions(parent_action_id);
create index if not exists idx_session_actions_user_id
  on public.session_actions(user_id);
