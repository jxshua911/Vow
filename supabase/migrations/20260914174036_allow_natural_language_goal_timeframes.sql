alter table public.goals drop constraint goals_duration_check;
alter table public.goals add constraint goals_duration_check check (duration is null or char_length(trim(duration)) between 1 and 120);
