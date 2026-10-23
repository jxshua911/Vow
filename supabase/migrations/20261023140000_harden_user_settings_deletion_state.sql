-- Prevent clients from editing their own account-deletion lifecycle fields.
-- Server-side account deletion and restoration continue through trusted
-- Edge Functions / SECURITY DEFINER RPCs; ordinary settings edits require an
-- active account and cannot change deletion metadata.
BEGIN;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.user_settings FROM anon, authenticated;

DROP POLICY IF EXISTS insert_own_settings ON public.user_settings;
CREATE POLICY insert_own_settings
ON public.user_settings
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND account_status = 'active'
  AND deleted_at IS NULL
  AND deletion_expires_at IS NULL
);

DROP POLICY IF EXISTS update_own_settings ON public.user_settings;
CREATE POLICY update_own_settings
ON public.user_settings
FOR UPDATE TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND account_status = 'active'
  AND deleted_at IS NULL
  AND deletion_expires_at IS NULL
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND account_status = 'active'
  AND deleted_at IS NULL
  AND deletion_expires_at IS NULL
);

COMMIT;

NOTIFY pgrst, 'reload schema';
