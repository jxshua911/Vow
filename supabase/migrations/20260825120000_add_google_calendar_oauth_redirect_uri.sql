alter table public.google_calendar_connections
  add column if not exists oauth_redirect_uri text;
