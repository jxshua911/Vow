-- These legacy RPCs are no longer called by the current client.
revoke execute on function public.delete_own_review(uuid) from authenticated, anon;
revoke execute on function public.complete_onboarding(jsonb,jsonb,jsonb,jsonb) from authenticated, anon;
