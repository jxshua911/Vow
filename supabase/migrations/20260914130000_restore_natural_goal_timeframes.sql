-- A goal timeframe is user intent, not a preset duration enum.
-- Keep the existing goals.duration column as the canonical free-form timeframe field.
alter table public.goals drop constraint if exists goals_duration_check;

comment on column public.goals.duration is 'Optional user-authored timeframe, preserved as entered (for example: 2 weeks, by December, before my birthday).';
