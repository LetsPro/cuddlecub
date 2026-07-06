drop policy if exists daily_activity_logs_staff_parent_select on public.daily_activity_logs;
create policy daily_activity_logs_staff_parent_select on public.daily_activity_logs
  for select to authenticated
  using (
    public.is_school_admin(school_id)
    or public.can_staff_access_student(student_id)
    or (shared_with_parent and public.can_parent_access_student(student_id))
  );
