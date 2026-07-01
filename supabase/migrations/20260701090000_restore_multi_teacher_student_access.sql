-- Ensure every teacher assigned through class_teacher_assignments can access
-- students in that class, even when multiple teachers share the same class.

create or replace function public.can_staff_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    join public.staff st
      on st.user_id = auth.uid()
     and st.school_id = s.school_id
     and st.is_active = true
    where s.id = target_student_id
      and (
        exists (
          select 1
          from public.class_teacher_assignments cta
          where cta.school_id = s.school_id
            and cta.class_id = s.class_id
            and cta.staff_id = st.id
        )
        or (
          st.class_teacher_for = s.class_id
          and not exists (
            select 1
            from public.class_teacher_assignments assigned
            where assigned.school_id = st.school_id
              and assigned.staff_id = st.id
          )
        )
        or (
          exists (
            select 1
            from public.classes c
            where c.id = s.class_id
              and c.school_id = s.school_id
              and c.class_teacher_staff_id = st.id
          )
          and not exists (
            select 1
            from public.class_teacher_assignments assigned
            where assigned.school_id = st.school_id
              and assigned.staff_id = st.id
          )
        )
        or 'all_students' = any(st.permissions)
        or 'student_access' = any(st.permissions)
        or 'attendance_manage' = any(st.permissions)
        or 'daily_activity' = any(st.permissions)
      )
  );
$$;
