alter table public.moderation_events enable row level security;
revoke all on table public.moderation_events from anon, authenticated;
comment on table public.moderation_events is 'Private moderation audit events. Access is restricted to trusted server-side code.';
