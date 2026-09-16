-- VOW adversarial hardening: protect goal-resource objects against direct
-- Supabase Storage API access that bypasses the React UI.

-- GoalResources already use signed URLs, so the bucket should remain private.
UPDATE storage.buckets
SET public = false
WHERE id = 'goal-resources';

DROP POLICY IF EXISTS "VOW users can upload goal resources" ON storage.objects;
CREATE POLICY "VOW users can upload goal resources"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'goal-resources'
    AND split_part(name, '/', 1) = (select auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id::text = split_part(name, '/', 2)
        AND g.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "VOW users can read goal resources" ON storage.objects;
CREATE POLICY "VOW users can read goal resources"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'goal-resources'
    AND split_part(name, '/', 1) = (select auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id::text = split_part(name, '/', 2)
        AND g.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "VOW users can update goal resources" ON storage.objects;
CREATE POLICY "VOW users can update goal resources"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'goal-resources'
    AND split_part(name, '/', 1) = (select auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id::text = split_part(name, '/', 2)
        AND g.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'goal-resources'
    AND split_part(name, '/', 1) = (select auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id::text = split_part(name, '/', 2)
        AND g.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "VOW users can delete goal resources" ON storage.objects;
CREATE POLICY "VOW users can delete goal resources"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'goal-resources'
    AND split_part(name, '/', 1) = (select auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id::text = split_part(name, '/', 2)
        AND g.user_id = (select auth.uid())
    )
  );
