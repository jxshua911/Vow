-- VOW: media uploads must go through the server-side validator.
-- Direct client inserts are removed so filename/MIME spoofing cannot bypass
-- magic-byte, size, and extension validation.

UPDATE storage.buckets
SET file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ],
    public = false
WHERE id = 'goal-resources';

DROP POLICY IF EXISTS "Users can upload goal resources" ON storage.objects;

DROP POLICY IF EXISTS "Users can read goal resources" ON storage.objects;
CREATE POLICY "Users can read goal resources"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'goal-resources'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete goal resources" ON storage.objects;
CREATE POLICY "Users can delete goal resources"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'goal-resources'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
