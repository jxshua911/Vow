-- Restore the entitlement usage table required by public.vow_reserve_entitlement().
-- Idempotent and safe to apply to production.
-- No seed data is required; an empty table is valid.

CREATE TABLE IF NOT EXISTS public.vow_entitlement_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  feature text NOT NULL
    CHECK (
      feature IN (
        'planning_action',
        'adaptive_replan',
        'advanced_review'
      )
    ),

  period_start date NOT NULL,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  vow_entitlement_usage_user_feature_period_idx
ON public.vow_entitlement_usage (
  user_id,
  feature,
  period_start,
  created_at DESC
);

ALTER TABLE public.vow_entitlement_usage
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
  "Users can read their own VOW entitlement usage"
ON public.vow_entitlement_usage;

CREATE POLICY
  "Users can read their own VOW entitlement usage"
ON public.vow_entitlement_usage
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);
