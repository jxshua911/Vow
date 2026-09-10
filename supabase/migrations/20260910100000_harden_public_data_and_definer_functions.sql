revoke all on table public.commitment_log from anon;
revoke all on table public.goal_clarification_answers from anon;
revoke all on table public.goal_evidence from anon;
revoke all on table public.goal_plan_items from anon;
revoke all on table public.goal_resources from anon;
revoke all on table public.goals from anon;
revoke all on table public.google_calendar_connections from anon;
revoke all on table public.journal_entries from anon;
revoke all on table public.milestones from anon;
revoke all on table public.moderation_events from anon;
revoke all on table public.moderation_ip_bans from anon;
revoke all on table public.raven_awards from anon;
revoke all on table public.raven_weekly_snapshots from anon;
revoke all on table public.reviews from anon;
revoke all on table public.sessions from anon;
revoke all on table public.strava_connections from anon;
revoke all on table public.strava_oauth_states from anon;
revoke all on table public.user_settings from anon;
revoke all on table public.vow_ai_usage from anon;
revoke all on table public.vow_knowledge from anon;

revoke execute on function public.delete_own_review(uuid) from public, anon;
grant execute on function public.delete_own_review(uuid) to authenticated;

revoke execute on function public.create_raven_weekly_snapshot(uuid, date) from public, anon, authenticated;
grant execute on function public.create_raven_weekly_snapshot(uuid, date) to service_role;

revoke execute on function public.refresh_goal_execution_context(uuid) from public, anon, authenticated;
revoke execute on function public.handle_goal_clarification_context() from public, anon, authenticated;
