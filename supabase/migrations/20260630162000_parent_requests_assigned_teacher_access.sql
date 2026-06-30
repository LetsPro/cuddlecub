drop policy if exists parent_requests_parent_select on public.parent_requests;
create policy parent_requests_parent_select on public.parent_requests
for select to authenticated
using (
  public.is_school_admin(school_id)
  or parent_id = public.current_parent_record_id()
  or (student_id is not null and public.can_staff_access_student(student_id))
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
