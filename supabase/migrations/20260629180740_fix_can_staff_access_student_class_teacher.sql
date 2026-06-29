CREATE OR REPLACE FUNCTION public.can_staff_access_student(target_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
select exists (
  select 1
  from public.students s
  join public.staff st
    on st.user_id = auth.uid()
    and st.school_id = s.school_id
    and st.is_active = true
  where s.id = target_student_id
    and (
      st.class_teacher_for = s.class_id
      or exists (
        select 1 from public.classes c
        where c.id = s.class_id
          and c.class_teacher_staff_id = st.id
      )
      or 'all_students' = any(st.permissions)
      or 'student_access' = any(st.permissions)
      or 'attendance_manage' = any(st.permissions)
      or 'daily_activity' = any(st.permissions)
    )
);
$$;
