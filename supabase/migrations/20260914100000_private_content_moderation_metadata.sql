alter table public.moderation_events
  add column if not exists source text not null default 'unknown',
  add column if not exists signal_code text,
  add column if not exists user_notified_at timestamptz,
  add column if not exists owner_notified_at timestamptz,
  add column if not exists owner_visible boolean not null default true;

alter table public.goals
  add column if not exists moderation_status text not null default 'clear',
  add column if not exists moderation_category text,
  add column if not exists moderation_flagged_at timestamptz;

comment on column public.moderation_events.source is 'Origin of the moderation signal. Never contains user-authored content.';
comment on column public.moderation_events.signal_code is 'Coarse safety signal only; deliberately excludes matched text or journal/goal content.';
comment on column public.moderation_events.owner_visible is 'Controls whether the event appears in the trusted owner moderation surface.';
comment on column public.goals.moderation_status is 'User-visible safety state for the goal. No goal text is copied into moderation metadata.';

create index if not exists moderation_events_source_created_idx
  on public.moderation_events(source, created_at desc);

create index if not exists moderation_events_owner_visible_created_idx
  on public.moderation_events(owner_visible, created_at desc);

revoke all on table public.moderation_events from anon, authenticated;
grant select on table public.moderation_events to authenticated;

drop policy if exists "Owners can view moderation metadata" on public.moderation_events;
create policy "Owners can view moderation metadata"
on public.moderation_events
for select
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'owner'
  and owner_visible = true
);

alter table public.moderation_events enable row level security;
