drop policy if exists staff_requests_recent_celebrations_school_member_select on public.staff_requests;

create policy staff_requests_recent_celebrations_school_member_select on public.staff_requests
for select to authenticated
using (
  category in ('birthday_photo', 'content_suggestion', 'celebration_photo')
  and created_at >= now() - interval '24 hours'
  and (
    public.is_school_admin(school_id)
    or public.is_school_staff(school_id)
    or public.is_school_parent(school_id)
  )
);

drop policy if exists students_recent_celebration_school_member_select on public.students;

create policy students_recent_celebration_school_member_select on public.students
for select to authenticated
using (
  school_id = public.current_school_id()
  and (
    public.is_school_admin(school_id)
    or public.is_school_staff(school_id)
    or public.is_school_parent(school_id)
  )
  and exists (
    select 1
    from public.staff_requests request
    where request.student_id = students.id
      and request.school_id = students.school_id
      and request.category in ('birthday_photo', 'content_suggestion', 'celebration_photo')
      and request.created_at >= now() - interval '24 hours'
  )
);
