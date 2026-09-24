-- Restore only the user-scoped RPCs that the current authenticated client/Edge Function legitimately calls.
-- The previous hardening migration revoked these execution grants, which broke:
--   1) goal locking from GoalPlanner
--   2) AI guardrail claim/release from vow-goal-ai
--   3) privacy-safe AI telemetry
--
-- These functions derive identity from auth.uid(), and their implementations must continue
-- to reject unauthenticated callers. Keep anon/public execution revoked.

BEGIN;

GRANT EXECUTE ON FUNCTION public.lock_goal_plan(uuid,jsonb,jsonb,jsonb,jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.vow_claim_ai_guardrail(uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vow_release_ai_guardrail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vow_record_ai_usage(text,text,integer,text) TO authenticated;

-- This helper accepts an arbitrary user UUID, so clients do not need direct access to it.
-- Premium checks are performed internally by the user-scoped entitlement functions.
REVOKE EXECUTE ON FUNCTION public.vow_is_premium(uuid) FROM anon, authenticated;

COMMIT;
