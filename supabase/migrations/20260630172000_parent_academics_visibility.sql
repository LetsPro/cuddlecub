create or replace function public.can_parent_access_class(target_class_id uuid, target_section_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_parents link
    join public.students student
      on student.id = link.student_id
     and student.is_active = true
    where link.parent_id = public.current_parent_record_id()
      and student.class_id = target_class_id
      and (target_section_id is null or student.section_id = target_section_id)
  );
$$;

grant execute on function public.can_parent_access_class(uuid, uuid) to authenticated;

drop policy if exists timetable_entries_staff_parent_select on public.timetable_entries;
create policy timetable_entries_staff_parent_select on public.timetable_entries
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or (
    public.can_parent_access_class(class_id, section_id)
    and (visible_from is null or visible_from <= current_date)
    and (visible_to is null or visible_to >= current_date)
  )
);

drop policy if exists lesson_plans_staff_parent_select on public.lesson_plans;
create policy lesson_plans_staff_parent_select on public.lesson_plans
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.can_parent_access_class(class_id, section_id)
);

drop policy if exists worksheets_staff_parent_select on public.worksheets;
create policy worksheets_staff_parent_select on public.worksheets
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.can_parent_access_class(class_id, section_id)
);

drop policy if exists classroom_updates_staff_parent_select on public.classroom_updates;
create policy classroom_updates_staff_parent_select on public.classroom_updates
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.can_parent_access_class(class_id, section_id)
);

drop policy if exists homework_tasks_staff_parent_select on public.homework_tasks;
create policy homework_tasks_staff_parent_select on public.homework_tasks
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.can_parent_access_class(class_id, section_id)
);

drop policy if exists student_progress_notes_staff_parent_select on public.student_progress_notes;
create policy student_progress_notes_staff_parent_select on public.student_progress_notes
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.can_staff_access_student(student_id)
  or (shared_with_parent and public.can_parent_access_student(student_id))
);
