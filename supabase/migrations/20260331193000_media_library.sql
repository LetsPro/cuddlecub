create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint,
  media_type text not null default 'image',
  label text,
  alt_text text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_media_assets_school_created on public.media_assets (school_id, created_at desc);

drop trigger if exists media_assets_set_updated_at on public.media_assets;
create trigger media_assets_set_updated_at before update on public.media_assets for each row execute function public.set_updated_at();

alter table public.media_assets enable row level security;

drop policy if exists media_assets_admin_all on public.media_assets;
create policy media_assets_admin_all on public.media_assets
for all
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-media',
  'school-media',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists school_media_public_read on storage.objects;
create policy school_media_public_read on storage.objects
for select
to public
using (bucket_id = 'school-media');

drop policy if exists school_media_admin_insert on storage.objects;
create policy school_media_admin_insert on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'school-media'
  and exists (
    select 1
    from public.profiles profile
    where profile.user_id = auth.uid()
      and profile.role = 'admin'
      and profile.is_active = true
      and profile.school_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists school_media_admin_update on storage.objects;
create policy school_media_admin_update on storage.objects
for update
to authenticated
using (
  bucket_id = 'school-media'
  and exists (
    select 1
    from public.profiles profile
    where profile.user_id = auth.uid()
      and profile.role = 'admin'
      and profile.is_active = true
      and profile.school_id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'school-media'
  and exists (
    select 1
    from public.profiles profile
    where profile.user_id = auth.uid()
      and profile.role = 'admin'
      and profile.is_active = true
      and profile.school_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists school_media_admin_delete on storage.objects;
create policy school_media_admin_delete on storage.objects
for delete
to authenticated
using (
  bucket_id = 'school-media'
  and exists (
    select 1
    from public.profiles profile
    where profile.user_id = auth.uid()
      and profile.role = 'admin'
      and profile.is_active = true
      and profile.school_id::text = (storage.foldername(name))[1]
  )
);
