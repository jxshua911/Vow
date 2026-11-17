-- Keep user-chosen display names in the account-owned profile table.
-- Auth user_metadata may be refreshed by OAuth providers; this field is the
-- durable source of truth for the name shown inside VOW.
alter table public.user_settings
  add column if not exists display_name text;

alter table public.user_settings
  drop constraint if exists user_settings_display_name_length_check;

alter table public.user_settings
  add constraint user_settings_display_name_length_check
  check (display_name is null or (char_length(btrim(display_name)) between 1 and 80));
