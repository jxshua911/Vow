-- Security hardening: isolate AI guardrail state and internal RPCs
-- Applied to production on 2026-09-25.
alter table public.vow_ai_guardrail_config enable row level security;
alter table public.vow_ai_budget_buckets enable row level security;
alter table public.vow_ai_request_leases enable row level security;

revoke all on table public.vow_ai_guardrail_config from anon, authenticated;
revoke all on table public.vow_ai_budget_buckets from anon, authenticated;
revoke all on table public.vow_ai_request_leases from anon, authenticated;

revoke execute on function public.vow_claim_ai_guardrail(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.vow_record_ai_usage(text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.vow_release_ai_guardrail(uuid) from public, anon, authenticated;

-- lock_goal_plan is a user-facing authenticated RPC and remains available to signed-in users.
revoke execute on function public.lock_goal_plan(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.lock_goal_plan(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
