revoke execute on function public.lock_goal_plan(uuid,jsonb,jsonb,jsonb,jsonb) from authenticated, anon;
revoke execute on function public.vow_claim_ai_guardrail(uuid,numeric) from authenticated, anon;
revoke execute on function public.vow_record_ai_usage(text,text,integer,text) from authenticated, anon;
revoke execute on function public.vow_release_ai_guardrail(uuid) from authenticated, anon;
