alter table public.strava_oauth_states
  add column if not exists return_uri text;
