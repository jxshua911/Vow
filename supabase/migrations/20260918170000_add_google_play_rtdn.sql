create table if not exists public.vow_google_play_notifications (
  message_id text primary key,
  package_name text not null,
  purchase_token text,
  notification_type integer,
  event_time timestamptz,
  processed_at timestamptz not null default now()
);

create index if not exists idx_vow_google_play_notifications_token
  on public.vow_google_play_notifications(purchase_token);

alter table public.vow_google_play_notifications enable row level security;
revoke all on public.vow_google_play_notifications from anon, authenticated;
grant all on public.vow_google_play_notifications to service_role;
