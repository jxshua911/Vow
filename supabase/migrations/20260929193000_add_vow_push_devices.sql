create table if not exists public.vow_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android' check (platform in ('android')),
  build_tier text not null default 'free' check (build_tier in ('free','premium')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index if not exists vow_push_devices_token_key on public.vow_push_devices(token);
create index if not exists vow_push_devices_user_id_idx on public.vow_push_devices(user_id);

alter table public.vow_push_devices enable row level security;

drop policy if exists "Users can view their own push devices" on public.vow_push_devices;
create policy "Users can view their own push devices" on public.vow_push_devices for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can register their own push devices" on public.vow_push_devices;
create policy "Users can register their own push devices" on public.vow_push_devices for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own push devices" on public.vow_push_devices;
create policy "Users can update their own push devices" on public.vow_push_devices for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own push devices" on public.vow_push_devices;
create policy "Users can remove their own push devices" on public.vow_push_devices for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.vow_touch_push_device(p_token text, p_build_tier text)
returns void language sql security invoker set search_path = public as $$
  insert into public.vow_push_devices (user_id, token, platform, build_tier, updated_at, last_seen_at)
  values ((select auth.uid()), p_token, 'android', p_build_tier, now(), now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, build_tier = excluded.build_tier, updated_at = now(), last_seen_at = now();
$$;

revoke all on function public.vow_touch_push_device(text, text) from public;
grant execute on function public.vow_touch_push_device(text, text) to authenticated;
