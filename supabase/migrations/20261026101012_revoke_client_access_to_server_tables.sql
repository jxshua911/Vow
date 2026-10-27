-- These are server-managed tables with no client-facing RLS policies.
-- Remove table grants explicitly so a future policy mistake cannot expose them by default.
BEGIN;
REVOKE ALL ON TABLE public.strava_oauth_states FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.vow_knowledge FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.vow_live_benchmark_results FROM PUBLIC, anon, authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
