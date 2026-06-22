alter table public.daily_activity_logs
  add column if not exists image_url text;

drop policy if exists media_assets_staff_read on public.media_assets;
create policy media_assets_staff_read on public.media_assets
for select to authenticated
using (
  public.is_school_admin(school_id)
  or exists (
    select 1
    from public.staff member
    where member.user_id = auth.uid()
      and member.school_id = media_assets.school_id
      and member.is_active = true
  )
);

drop policy if exists media_assets_staff_insert on public.media_assets;
create policy media_assets_staff_insert on public.media_assets
for insert to authenticated
with check (
  public.is_school_admin(school_id)
  or exists (
    select 1
    from public.staff member
    where member.user_id = auth.uid()
      and member.school_id = media_assets.school_id
      and member.is_active = true
  )
);

drop policy if exists school_media_staff_insert on storage.objects;
create policy school_media_staff_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'school-media'
  and exists (
    select 1
    from public.staff member
    where member.user_id = auth.uid()
      and member.is_active = true
      and member.school_id::text = (storage.foldername(name))[1]
  )
);
