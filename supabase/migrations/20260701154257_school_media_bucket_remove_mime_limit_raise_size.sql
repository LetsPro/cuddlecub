-- The media library accepts images and videos from the client. Keep the bucket
-- public, remove the fixed MIME allowlist, and raise the limit for video files.

update storage.buckets
set
  allowed_mime_types = null,
  file_size_limit = greatest(coalesce(file_size_limit, 0), 104857600)
where id = 'school-media';
