-- Cache auth.uid() once per statement instead of re-evaluating it for every row.
ALTER POLICY select_own_settings ON public.user_settings USING ((select auth.uid()) = user_id);
ALTER POLICY insert_own_settings ON public.user_settings WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY update_own_settings ON public.user_settings USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY select_own_goals ON public.goals USING ((select auth.uid()) = user_id);
ALTER POLICY insert_own_goals ON public.goals WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY update_own_goals ON public.goals USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY delete_own_goals ON public.goals USING ((select auth.uid()) = user_id);

ALTER POLICY select_own_sessions ON public.sessions USING ((select auth.uid()) = user_id);
ALTER POLICY insert_own_sessions ON public.sessions WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY update_own_sessions ON public.sessions USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY delete_own_sessions ON public.sessions USING ((select auth.uid()) = user_id);

ALTER POLICY select_own_journal ON public.journal_entries USING ((select auth.uid()) = user_id);
ALTER POLICY insert_own_journal ON public.journal_entries WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY update_own_journal ON public.journal_entries USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY delete_own_journal ON public.journal_entries USING ((select auth.uid()) = user_id);

ALTER POLICY select_own_commitments ON public.commitment_log USING ((select auth.uid()) = user_id);
ALTER POLICY insert_own_commitments ON public.commitment_log WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY select_own_reviews ON public.reviews USING ((select auth.uid()) = user_id);
ALTER POLICY insert_own_reviews ON public.reviews WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY update_own_reviews ON public.reviews USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY delete_own_reviews ON public.reviews USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert their own calendar connection" ON public.google_calendar_connections WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update their own calendar connection" ON public.google_calendar_connections USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete their own calendar connection" ON public.google_calendar_connections USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can read their own Strava connection" ON public.strava_connections USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete their own Strava connection" ON public.strava_connections USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can read their own goal evidence" ON public.goal_evidence USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can create their own goal evidence" ON public.goal_evidence WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update their own goal evidence" ON public.goal_evidence USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete their own goal evidence" ON public.goal_evidence USING ((select auth.uid()) = user_id);

ALTER POLICY select_own_milestones ON public.milestones USING (EXISTS (SELECT 1 FROM public.goals WHERE goals.id = milestones.goal_id AND goals.user_id = (select auth.uid())));
ALTER POLICY insert_own_milestones ON public.milestones WITH CHECK (EXISTS (SELECT 1 FROM public.goals WHERE goals.id = milestones.goal_id AND goals.user_id = (select auth.uid())));
ALTER POLICY update_own_milestones ON public.milestones USING (EXISTS (SELECT 1 FROM public.goals WHERE goals.id = milestones.goal_id AND goals.user_id = (select auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.goals WHERE goals.id = milestones.goal_id AND goals.user_id = (select auth.uid())));
ALTER POLICY delete_own_milestones ON public.milestones USING (EXISTS (SELECT 1 FROM public.goals WHERE goals.id = milestones.goal_id AND goals.user_id = (select auth.uid())));

-- Cover the foreign-key joins flagged by the performance advisor.
CREATE INDEX IF NOT EXISTS idx_commitment_log_goal_id ON public.commitment_log(goal_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_linked_goal_id ON public.journal_entries(linked_goal_id);
CREATE INDEX IF NOT EXISTS idx_sessions_milestone_id ON public.sessions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_strava_oauth_states_user_id ON public.strava_oauth_states(user_id);
