create or replace function public.delete_user_account_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_user_id is null then raise exception 'USER_REQUIRED'; end if;
  delete from public.commitment_log where user_id = p_user_id;
  delete from public.goal_clarification_answers where user_id = p_user_id;
  delete from public.goal_dependencies where user_id = p_user_id;
  delete from public.goal_evidence where user_id = p_user_id;
  delete from public.goal_milestones where user_id = p_user_id;
  delete from public.goal_plan_items where user_id = p_user_id;
  delete from public.goal_reminders where user_id = p_user_id;
  delete from public.goal_resources where user_id = p_user_id;
  delete from public.plan_adjustments where user_id = p_user_id;
  delete from public.reminder_preferences where user_id = p_user_id;
  delete from public.reviews where user_id = p_user_id;
  delete from public.sessions where user_id = p_user_id;
  delete from public.journal_insights where user_id = p_user_id;
  delete from public.journal_entries where user_id = p_user_id;
  delete from public.moderation_appeals where user_id = p_user_id;
  delete from public.moderation_events where user_id = p_user_id;
  delete from public.moderation_ip_bans where user_id = p_user_id;
  delete from public.offline_operations where user_id = p_user_id;
  delete from public.raven_awards where user_id = p_user_id;
  delete from public.raven_weekly_snapshots where user_id = p_user_id;
  delete from public.google_calendar_connections where user_id = p_user_id;
  delete from public.integration_connections where user_id = p_user_id;
  delete from public.strava_connections where user_id = p_user_id;
  delete from public.strava_oauth_states where user_id = p_user_id;
  delete from public.user_entitlements where user_id = p_user_id;
  delete from public.vow_user_entitlements where user_id = p_user_id;
  delete from public.vow_ai_request_leases where user_id = p_user_id;
  delete from public.vow_ai_usage_events where user_id = p_user_id;
  delete from public.vow_ai_usage where user_id = p_user_id;
  delete from public.vow_app_events where user_id = p_user_id;
  delete from public.vow_payment_events where user_id = p_user_id;
  delete from public.vow_subscription_records where user_id = p_user_id;
  delete from public.vow_terms_acceptances where user_id = p_user_id;
  delete from public.data_requests where user_id = p_user_id;
  delete from public.user_settings where user_id = p_user_id;
  delete from public.goals where user_id = p_user_id;
end;
$$;
revoke all on function public.delete_user_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_user_account_data(uuid) to service_role;
