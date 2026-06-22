alter table public.parent_requests
  add column if not exists response_message text,
  add column if not exists response_by_name text,
  add column if not exists response_by_role text,
  add column if not exists responded_at timestamptz;

drop policy if exists parent_requests_parent_select on public.parent_requests;
create policy parent_requests_parent_select on public.parent_requests
for select to authenticated
using (
  public.is_school_admin(school_id)
  or parent_id = public.current_parent_record_id()
  or (student_id is not null and public.can_staff_access_student(student_id))
);

drop policy if exists parent_requests_parent_manage on public.parent_requests;

drop policy if exists parent_requests_parent_insert on public.parent_requests;
create policy parent_requests_parent_insert on public.parent_requests
for insert to authenticated
with check (
  parent_id = public.current_parent_record_id()
  and student_id is not null
  and public.can_parent_access_student(student_id)
);

drop policy if exists parent_requests_school_update on public.parent_requests;
create policy parent_requests_school_update on public.parent_requests
for update to authenticated
using (
  public.is_school_admin(school_id)
  or (student_id is not null and public.can_staff_access_student(student_id))
)
with check (
  public.is_school_admin(school_id)
  or (student_id is not null and public.can_staff_access_student(student_id))
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'parent_requests'
    ) then
    alter publication supabase_realtime add table public.parent_requests;
  end if;
end
$$;
