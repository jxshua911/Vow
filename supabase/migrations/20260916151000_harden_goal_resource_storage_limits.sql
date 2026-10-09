-- VOW: defensive limits for goal-resource uploads.
-- Keep object access private and prevent oversized uploads from becoming a
-- storage/resource-exhaustion vector. Relational ownership remains enforced
-- by the goal_resources/object policies.

UPDATE storage.buckets
SET file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
      'image/*',
      'video/*',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
WHERE id = 'goal-resources';

-- The bucket is user content, not a public CDN bucket.
UPDATE storage.buckets
SET public = false
WHERE id = 'goal-resources';
