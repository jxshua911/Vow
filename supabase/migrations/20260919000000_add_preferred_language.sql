-- VOW multilingual preference.
alter table public.user_settings
  add column if not exists preferred_language text not null default 'en';

comment on column public.user_settings.preferred_language is
  'ISO 639-1 language code selected by the user. Used for VOW UI localisation and AI responses.';
