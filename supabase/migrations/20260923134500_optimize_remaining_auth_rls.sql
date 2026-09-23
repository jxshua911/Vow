-- Keep auth.uid() initplan-safe so PostgreSQL evaluates the identity once per statement.
drop policy if exists insert_own_commitments on public.commitment_log;
create policy insert_own_commitments on public.commitment_log for insert to authenticated with check (((select auth.uid()) = user_id) and exists (select 1 from public.goals g where g.id = commitment_log.goal_id and g.user_id = (select auth.uid())));

drop policy if exists insert_own_raven_awards on public.raven_awards;
create policy insert_own_raven_awards on public.raven_awards for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists select_own_raven_awards on public.raven_awards;
create policy select_own_raven_awards on public.raven_awards for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists insert_own_raven_snapshots on public.raven_weekly_snapshots;
create policy insert_own_raven_snapshots on public.raven_weekly_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists select_own_raven_snapshots on public.raven_weekly_snapshots;
create policy select_own_raven_snapshots on public.raven_weekly_snapshots for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists update_own_raven_snapshots on public.raven_weekly_snapshots;
create policy update_own_raven_snapshots on public.raven_weekly_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists update_own_reviews on public.reviews;
create policy update_own_reviews on public.reviews for update to authenticated using ((select auth.uid()) = user_id) with check (((select auth.uid()) = user_id) and user_id = (select r.user_id from public.reviews r where r.id = reviews.id) and week_start = (select r.week_start from public.reviews r where r.id = reviews.id) and week_end = (select r.week_end from public.reviews r where r.id = reviews.id));

drop policy if exists "Users can record their own terms acceptance" on public.vow_terms_acceptances;
create policy "Users can record their own terms acceptance" on public.vow_terms_acceptances for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can view their own terms acceptances" on public.vow_terms_acceptances;
create policy "Users can view their own terms acceptances" on public.vow_terms_acceptances for select to authenticated using ((select auth.uid()) = user_id);
