-- Harden user-uploadable goal resources.
-- Keep the bucket private, keep the existing 25 MiB ceiling, and remove
-- archive/Office container formats that expand the malware/content attack surface.
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
    'image/*',
    'video/*',
    'application/pdf',
    'text/plain',
    'text/csv'
  ]
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
    AND COALESCE((metadata->>'size')::bigint, 0) <= 26214400
    AND (
      (metadata->>'mimetype') LIKE 'image/%'
      OR (metadata->>'mimetype') LIKE 'video/%'
      OR (metadata->>'mimetype') IN ('application/pdf', 'text/plain', 'text/csv')
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
    AND COALESCE((metadata->>'size')::bigint, 0) <= 26214400
    AND (
      (metadata->>'mimetype') LIKE 'image/%'
      OR (metadata->>'mimetype') LIKE 'video/%'
      OR (metadata->>'mimetype') IN ('application/pdf', 'text/plain', 'text/csv')
    )
  );
