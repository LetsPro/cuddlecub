-- Multiple class assignment is canonical on classes.class_teacher_staff_id.
-- Keep staff.class_teacher_for only as a legacy primary class mirror.

update public.staff s
set class_teacher_for = assigned.primary_class_id
from (
  select
    st.id as staff_id,
    (
      select c.id
      from public.classes c
      where c.school_id = st.school_id
        and c.class_teacher_staff_id = st.id
      order by c.name
      limit 1
    ) as primary_class_id
  from public.staff st
  where st.role = 'teacher'
) assigned
where s.id = assigned.staff_id
  and s.class_teacher_for is distinct from assigned.primary_class_id;

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
          from public.classes c
          where c.id = s.class_id
            and c.school_id = s.school_id
            and c.class_teacher_staff_id = st.id
        )
        or (
          st.class_teacher_for = s.class_id
          and not exists (
            select 1
            from public.classes assigned
            where assigned.school_id = st.school_id
              and assigned.class_teacher_staff_id = st.id
          )
        )
        or 'all_students' = any(st.permissions)
        or 'student_access' = any(st.permissions)
        or 'attendance_manage' = any(st.permissions)
        or 'daily_activity' = any(st.permissions)
      )
  );
$$;
