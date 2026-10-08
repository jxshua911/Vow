-- VOW account deletion grace period
-- No production execution in this commit. This migration is applied only during the
-- coordinated Supabase deployment after the client and Edge Function changes are verified.

alter table public.user_settings
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_expires_at timestamptz,
  add column if not exists account_status text not null default 'active';

update public.user_settings
set account_status = 'active'
where account_status is null;

alter table public.user_settings
  drop constraint if exists user_settings_account_status_check;

alter table public.user_settings
  add constraint user_settings_account_status_check
  check (account_status in ('active', 'deleted'));

create index if not exists user_settings_deletion_expires_at_idx
  on public.user_settings (deletion_expires_at)
  where account_status = 'deleted';

create or replace function public.vow_account_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and not exists (
        select 1
        from public.user_settings s
        where s.user_id = u.id
          and s.account_status = 'deleted'
      )
  );
$function$;

create or replace function public.vow_restore_or_purge_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  settings_row public.user_settings%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into settings_row
    from public.user_settings
   where user_id = uid
   for update;

  if not found then
    return jsonb_build_object('status', 'active');
  end if;

  if settings_row.account_status <> 'deleted' then
    return jsonb_build_object('status', 'active');
  end if;

  if settings_row.deletion_expires_at is not null
     and settings_row.deletion_expires_at > now() then
    update public.user_settings
       set account_status = 'active',
           deleted_at = null,
           deletion_expires_at = null,
           updated_at = now()
     where user_id = uid;

    return jsonb_build_object('status', 'restored');
  end if;

  -- Grace period has expired. Purge application data while leaving the
  -- authenticated identity in place so the current session can be closed
  -- cleanly by the client.
  perform public.delete_user_account_data(uid);
  return jsonb_build_object('status', 'purged');
end;
$function$;

revoke execute on function public.vow_restore_or_purge_account() from public;
grant execute on function public.vow_restore_or_purge_account() to authenticated;
