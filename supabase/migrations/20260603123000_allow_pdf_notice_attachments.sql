update storage.buckets
set
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf'],
  file_size_limit = greatest(coalesce(file_size_limit, 0), 10485760)
where id = 'school-media';
