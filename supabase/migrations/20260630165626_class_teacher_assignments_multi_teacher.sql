-- Allow more than one teacher to be assigned to the same class.
-- classes.class_teacher_staff_id and staff.class_teacher_for are kept as legacy primary mirrors.

create table if not exists public.class_teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, staff_id)
);

create index if not exists idx_class_teacher_assignments_staff
  on public.class_teacher_assignments (school_id, staff_id);

create index if not exists idx_class_teacher_assignments_class
  on public.class_teacher_assignments (school_id, class_id);

alter table public.class_teacher_assignments enable row level security;

drop policy if exists class_teacher_assignments_school_members_select on public.class_teacher_assignments;
create policy class_teacher_assignments_school_members_select on public.class_teacher_assignments
for select to authenticated
using (
  school_id = public.current_school_id()
  and (
    public.is_school_admin(school_id)
    or public.is_school_staff(school_id)
    or public.is_school_parent(school_id)
  )
);

drop policy if exists class_teacher_assignments_admin_manage on public.class_teacher_assignments;
create policy class_teacher_assignments_admin_manage on public.class_teacher_assignments
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

insert into public.class_teacher_assignments (school_id, class_id, staff_id)
select c.school_id, c.id, c.class_teacher_staff_id
from public.classes c
where c.class_teacher_staff_id is not null
on conflict (class_id, staff_id) do nothing;

insert into public.class_teacher_assignments (school_id, class_id, staff_id)
select s.school_id, s.class_teacher_for, s.id
from public.staff s
where s.class_teacher_for is not null
  and s.role = 'teacher'
on conflict (class_id, staff_id) do nothing;

update public.classes c
set class_teacher_staff_id = primary_assignment.staff_id
from (
  select distinct on (class_id)
    class_id,
    staff_id
  from public.class_teacher_assignments
  order by class_id, created_at, staff_id
) primary_assignment
where c.id = primary_assignment.class_id
  and c.class_teacher_staff_id is distinct from primary_assignment.staff_id;

update public.classes c
set class_teacher_staff_id = null
where c.class_teacher_staff_id is not null
  and not exists (
    select 1
    from public.class_teacher_assignments cta
    where cta.class_id = c.id
      and cta.staff_id = c.class_teacher_staff_id
  );

update public.staff s
set class_teacher_for = primary_assignment.class_id
from (
  select distinct on (staff_id)
    staff_id,
    class_id
  from public.class_teacher_assignments
  order by staff_id, created_at, class_id
) primary_assignment
where s.id = primary_assignment.staff_id
  and s.class_teacher_for is distinct from primary_assignment.class_id;

update public.staff s
set class_teacher_for = null
where s.class_teacher_for is not null
  and not exists (
    select 1
    from public.class_teacher_assignments cta
    where cta.staff_id = s.id
      and cta.class_id = s.class_teacher_for
  );

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
