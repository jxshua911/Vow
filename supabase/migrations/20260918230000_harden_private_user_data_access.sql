-- VOW privacy hardening.
-- User goal, journal, plan, session, review and settings data is private by design.
-- RLS remains the primary owner boundary; these revokes also remove anonymous/public
-- table access so privacy does not depend on an absent policy alone.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_settings',
    'goals',
    'milestones',
    'sessions',
    'journal_entries',
    'commitment_log',
    'reviews',
    'goal_clarification_answers',
    'goal_plan_items',
    'goal_resources'
  ] loop
    execute format('revoke all on table public.%I from public, anon', table_name);
  end loop;
end $$;

comment on table public.goals is
  'Private user-owned goal data. Access is owner-scoped through RLS; never expose cross-user goal content.';
comment on table public.journal_entries is
  'Private user-owned journal data. Access is owner-scoped through RLS; never expose cross-user content.';
comment on table public.goal_clarification_answers is
  'Private user-owned planning context. Do not copy question/answer content into telemetry or public resources.';
comment on table public.goal_plan_items is
  'Private user-owned plan execution data. Access is owner-scoped through RLS.';
comment on table public.vow_ai_usage_events is
  'Privacy-safe aggregate AI telemetry. Never store goal text, prompts, answers, generated plan content, or other user content here.';
