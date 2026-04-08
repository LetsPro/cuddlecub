alter table public.staff
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.parents
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create unique index if not exists idx_staff_user_id_unique
  on public.staff (user_id)
  where user_id is not null;

create unique index if not exists idx_parents_user_id_unique
  on public.parents (user_id)
  where user_id is not null;

create table if not exists public.homework_tasks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  section_id uuid references public.sections (id) on delete set null,
  created_by_staff_id uuid references public.staff (id) on delete set null,
  title text not null,
  description text,
  due_date date,
  status text not null default 'assigned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_progress_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_by_staff_id uuid references public.staff (id) on delete set null,
  note_type text not null default 'observation',
  title text not null,
  summary text not null,
  shared_with_parent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  category text not null,
  title text not null,
  message text not null,
  file_url text,
  status text not null default 'pending',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parent_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  parent_id uuid not null references public.parents (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  category text not null,
  title text not null,
  message text not null,
  requested_for date,
  status text not null default 'submitted',
  pickup_person_name text,
  pickup_person_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_homework_tasks_school_class on public.homework_tasks (school_id, class_id);
create index if not exists idx_student_progress_notes_school_student on public.student_progress_notes (school_id, student_id);
create index if not exists idx_staff_requests_school_staff on public.staff_requests (school_id, staff_id);
create index if not exists idx_parent_requests_school_parent on public.parent_requests (school_id, parent_id);

drop trigger if exists homework_tasks_set_updated_at on public.homework_tasks;
create trigger homework_tasks_set_updated_at before update on public.homework_tasks for each row execute function public.set_updated_at();

drop trigger if exists student_progress_notes_set_updated_at on public.student_progress_notes;
create trigger student_progress_notes_set_updated_at before update on public.student_progress_notes for each row execute function public.set_updated_at();

drop trigger if exists staff_requests_set_updated_at on public.staff_requests;
create trigger staff_requests_set_updated_at before update on public.staff_requests for each row execute function public.set_updated_at();

drop trigger if exists parent_requests_set_updated_at on public.parent_requests;
create trigger parent_requests_set_updated_at before update on public.parent_requests for each row execute function public.set_updated_at();

create or replace function public.is_school_staff(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and school_id = target_school_id
      and role in ('teacher', 'staff')
      and is_active = true
  );
$$;

create or replace function public.is_school_parent(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and school_id = target_school_id
      and role = 'parent'
      and is_active = true
  );
$$;

create or replace function public.current_staff_record_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.staff where user_id = auth.uid();
$$;

create or replace function public.current_parent_record_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.parents where user_id = auth.uid();
$$;

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
        st.class_teacher_for = s.class_id
        or 'all_students' = any(st.permissions)
        or 'student_access' = any(st.permissions)
        or 'attendance_manage' = any(st.permissions)
        or 'daily_activity' = any(st.permissions)
      )
  );
$$;

create or replace function public.can_parent_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_parents sp
    join public.parents p
      on p.id = sp.parent_id
     and p.user_id = auth.uid()
     and p.is_active = true
    where sp.student_id = target_student_id
  );
$$;

create or replace function public.resolve_user_role()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_profile public.profiles;
  v_staff public.staff;
  v_parent public.parents;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_profile
  from public.profiles
  where user_id = v_user_id;

  if v_profile.role = 'admin' and v_profile.school_id is not null then
    return v_profile;
  end if;

  if v_email <> '' then
    update public.staff
    set user_id = coalesce(user_id, v_user_id)
    where lower(coalesce(email, '')) = v_email
      and user_id is null;

    select * into v_staff
    from public.staff
    where user_id = v_user_id
    limit 1;

    if found then
      update public.profiles
      set school_id = v_staff.school_id,
          full_name = coalesce(v_staff.full_name, public.profiles.full_name),
          phone = coalesce(v_staff.phone_number, public.profiles.phone),
          role = case when lower(v_staff.role) = 'teacher' then 'teacher' else 'staff' end,
          is_active = v_staff.is_active
      where user_id = v_user_id;

      select * into v_profile
      from public.profiles
      where user_id = v_user_id;

      return v_profile;
    end if;

    update public.parents
    set user_id = coalesce(user_id, v_user_id)
    where lower(coalesce(email, '')) = v_email
      and user_id is null;

    select * into v_parent
    from public.parents
    where user_id = v_user_id
    limit 1;

    if found then
      update public.profiles
      set school_id = v_parent.school_id,
          full_name = coalesce(v_parent.full_name, public.profiles.full_name),
          phone = coalesce(v_parent.phone_number, public.profiles.phone),
          role = 'parent',
          is_active = v_parent.is_active
      where user_id = v_user_id;

      select * into v_profile
      from public.profiles
      where user_id = v_user_id;

      return v_profile;
    end if;
  end if;

  return v_profile;
end;
$$;

grant execute on function public.resolve_user_role() to authenticated;

alter table public.homework_tasks enable row level security;
alter table public.student_progress_notes enable row level security;
alter table public.staff_requests enable row level security;
alter table public.parent_requests enable row level security;

drop policy if exists schools_select_school_members on public.schools;
create policy schools_select_school_members on public.schools
for select to authenticated
using (
  public.is_school_admin(id)
  or public.is_school_staff(id)
  or public.is_school_parent(id)
);

drop policy if exists classes_school_members_select on public.classes;
create policy classes_school_members_select on public.classes
for select to authenticated
using (
  school_id = public.current_school_id()
  and (
    public.is_school_admin(school_id)
    or public.is_school_staff(school_id)
    or public.is_school_parent(school_id)
  )
);

drop policy if exists sections_school_members_select on public.sections;
create policy sections_school_members_select on public.sections
for select to authenticated
using (
  school_id = public.current_school_id()
  and (
    public.is_school_admin(school_id)
    or public.is_school_staff(school_id)
    or public.is_school_parent(school_id)
  )
);

drop policy if exists staff_select_self_or_school_staff on public.staff;
create policy staff_select_self_or_school_staff on public.staff
for select to authenticated
using (
  public.is_school_admin(school_id)
  or user_id = auth.uid()
  or public.is_school_staff(school_id)
  or public.is_school_parent(school_id)
);

drop policy if exists staff_update_self on public.staff;
create policy staff_update_self on public.staff
for update to authenticated
using (user_id = auth.uid() or public.is_school_admin(school_id))
with check (user_id = auth.uid() or public.is_school_admin(school_id));

drop policy if exists parents_select_self_or_admin on public.parents;
create policy parents_select_self_or_admin on public.parents
for select to authenticated
using (
  public.is_school_admin(school_id)
  or user_id = auth.uid()
  or exists (
    select 1
    from public.student_parents sp
    join public.staff st
      on st.user_id = auth.uid()
     and st.school_id = parents.school_id
    where sp.parent_id = parents.id
      and public.can_staff_access_student(sp.student_id)
  )
);

drop policy if exists parents_update_self on public.parents;
create policy parents_update_self on public.parents
for update to authenticated
using (user_id = auth.uid() or public.is_school_admin(school_id))
with check (user_id = auth.uid() or public.is_school_admin(school_id));

drop policy if exists students_staff_parent_select on public.students;
create policy students_staff_parent_select on public.students
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.can_staff_access_student(id)
  or public.can_parent_access_student(id)
);

drop policy if exists student_parents_staff_parent_select on public.student_parents;
create policy student_parents_staff_parent_select on public.student_parents
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.can_staff_access_student(student_id)
  or parent_id = public.current_parent_record_id()
);

drop policy if exists timetable_entries_staff_parent_select on public.timetable_entries;
create policy timetable_entries_staff_parent_select on public.timetable_entries
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.is_school_parent(school_id)
);

drop policy if exists timetable_entries_staff_manage on public.timetable_entries;
create policy timetable_entries_staff_manage on public.timetable_entries
for insert to authenticated
with check (public.is_school_admin(school_id) or public.is_school_staff(school_id));

drop policy if exists lesson_plans_staff_parent_select on public.lesson_plans;
create policy lesson_plans_staff_parent_select on public.lesson_plans
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.is_school_parent(school_id)
);

drop policy if exists lesson_plans_staff_manage on public.lesson_plans;
create policy lesson_plans_staff_manage on public.lesson_plans
for all to authenticated
using (public.is_school_admin(school_id) or public.is_school_staff(school_id))
with check (public.is_school_admin(school_id) or public.is_school_staff(school_id));

drop policy if exists worksheets_staff_parent_select on public.worksheets;
create policy worksheets_staff_parent_select on public.worksheets
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.is_school_parent(school_id)
);

drop policy if exists worksheets_staff_manage on public.worksheets;
create policy worksheets_staff_manage on public.worksheets
for all to authenticated
using (public.is_school_admin(school_id) or public.is_school_staff(school_id))
with check (public.is_school_admin(school_id) or public.is_school_staff(school_id));

drop policy if exists classroom_updates_staff_parent_select on public.classroom_updates;
create policy classroom_updates_staff_parent_select on public.classroom_updates
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.is_school_parent(school_id)
);

drop policy if exists classroom_updates_staff_manage on public.classroom_updates;
create policy classroom_updates_staff_manage on public.classroom_updates
for all to authenticated
using (public.is_school_admin(school_id) or public.is_school_staff(school_id))
with check (public.is_school_admin(school_id) or public.is_school_staff(school_id));

drop policy if exists student_attendance_staff_parent_select on public.student_attendance;
create policy student_attendance_staff_parent_select on public.student_attendance
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.can_staff_access_student(student_id)
  or public.can_parent_access_student(student_id)
);

drop policy if exists student_attendance_staff_manage on public.student_attendance;
create policy student_attendance_staff_manage on public.student_attendance
for all to authenticated
using (public.is_school_admin(school_id) or public.can_staff_access_student(student_id))
with check (public.is_school_admin(school_id) or public.can_staff_access_student(student_id));

drop policy if exists staff_attendance_staff_select on public.staff_attendance;
create policy staff_attendance_staff_select on public.staff_attendance
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
);

drop policy if exists staff_attendance_self_manage on public.staff_attendance;
create policy staff_attendance_self_manage on public.staff_attendance
for all to authenticated
using (
  public.is_school_admin(school_id)
  or staff_id = public.current_staff_record_id()
)
with check (
  public.is_school_admin(school_id)
  or staff_id = public.current_staff_record_id()
);

drop policy if exists daily_activity_logs_staff_parent_select on public.daily_activity_logs;
create policy daily_activity_logs_staff_parent_select on public.daily_activity_logs
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.can_staff_access_student(student_id)
  or public.can_parent_access_student(student_id)
);

drop policy if exists daily_activity_logs_staff_manage on public.daily_activity_logs;
create policy daily_activity_logs_staff_manage on public.daily_activity_logs
for all to authenticated
using (public.is_school_admin(school_id) or public.can_staff_access_student(student_id))
with check (public.is_school_admin(school_id) or public.can_staff_access_student(student_id));

drop policy if exists fee_structures_parent_select on public.fee_structures;
create policy fee_structures_parent_select on public.fee_structures
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_parent(school_id)
);

drop policy if exists fee_invoices_parent_select on public.fee_invoices;
create policy fee_invoices_parent_select on public.fee_invoices
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.can_parent_access_student(student_id)
);

drop policy if exists fee_payments_parent_select on public.fee_payments;
create policy fee_payments_parent_select on public.fee_payments
for select to authenticated
using (
  public.is_school_admin(school_id)
  or exists (
    select 1
    from public.fee_invoices fi
    where fi.id = fee_payments.fee_invoice_id
      and public.can_parent_access_student(fi.student_id)
  )
);

drop policy if exists notifications_school_member_select on public.notifications;
create policy notifications_school_member_select on public.notifications
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.is_school_parent(school_id)
);

drop policy if exists content_posts_school_member_select on public.content_posts;
create policy content_posts_school_member_select on public.content_posts
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.is_school_parent(school_id)
);

drop policy if exists content_templates_school_member_select on public.content_templates;
create policy content_templates_school_member_select on public.content_templates
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.is_school_parent(school_id)
);

drop policy if exists events_school_member_select on public.events;
create policy events_school_member_select on public.events
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.is_school_parent(school_id)
);

drop policy if exists school_holidays_school_member_select on public.school_holidays;
create policy school_holidays_school_member_select on public.school_holidays
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.is_school_parent(school_id)
);

drop policy if exists admissions_parent_select on public.admissions;
create policy admissions_parent_select on public.admissions
for select to authenticated
using (
  public.is_school_admin(school_id)
  or (student_id is not null and public.can_parent_access_student(student_id))
);

drop policy if exists homework_tasks_staff_parent_select on public.homework_tasks;
create policy homework_tasks_staff_parent_select on public.homework_tasks
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.is_school_staff(school_id)
  or public.is_school_parent(school_id)
);

drop policy if exists homework_tasks_staff_manage on public.homework_tasks;
create policy homework_tasks_staff_manage on public.homework_tasks
for all to authenticated
using (public.is_school_admin(school_id) or public.is_school_staff(school_id))
with check (public.is_school_admin(school_id) or public.is_school_staff(school_id));

drop policy if exists student_progress_notes_staff_parent_select on public.student_progress_notes;
create policy student_progress_notes_staff_parent_select on public.student_progress_notes
for select to authenticated
using (
  public.is_school_admin(school_id)
  or public.can_staff_access_student(student_id)
  or (shared_with_parent and public.can_parent_access_student(student_id))
);

drop policy if exists student_progress_notes_staff_manage on public.student_progress_notes;
create policy student_progress_notes_staff_manage on public.student_progress_notes
for all to authenticated
using (public.is_school_admin(school_id) or public.can_staff_access_student(student_id))
with check (public.is_school_admin(school_id) or public.can_staff_access_student(student_id));

drop policy if exists staff_requests_staff_select on public.staff_requests;
create policy staff_requests_staff_select on public.staff_requests
for select to authenticated
using (
  public.is_school_admin(school_id)
  or staff_id = public.current_staff_record_id()
);

drop policy if exists staff_requests_staff_manage on public.staff_requests;
create policy staff_requests_staff_manage on public.staff_requests
for all to authenticated
using (
  public.is_school_admin(school_id)
  or staff_id = public.current_staff_record_id()
)
with check (
  public.is_school_admin(school_id)
  or staff_id = public.current_staff_record_id()
);

drop policy if exists parent_requests_parent_select on public.parent_requests;
create policy parent_requests_parent_select on public.parent_requests
for select to authenticated
using (
  public.is_school_admin(school_id)
  or parent_id = public.current_parent_record_id()
);

drop policy if exists parent_requests_parent_manage on public.parent_requests;
create policy parent_requests_parent_manage on public.parent_requests
for all to authenticated
using (
  public.is_school_admin(school_id)
  or parent_id = public.current_parent_record_id()
)
with check (
  public.is_school_admin(school_id)
  or parent_id = public.current_parent_record_id()
);
