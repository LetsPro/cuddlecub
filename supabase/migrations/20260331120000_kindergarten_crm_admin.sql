create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'teacher', 'parent', 'staff');
  end if;

  if not exists (select 1 from pg_type where typname = 'app_gender') then
    create type public.app_gender as enum ('female', 'male', 'other');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, 'school')), '[^a-z0-9]+', '-', 'g'));
$$;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text,
  contact_email text,
  contact_phone text,
  logo_url text,
  academic_year_label text,
  primary_color text default '#f58416',
  secondary_color text default '#10b5aa',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  school_id uuid references public.schools (id) on delete set null,
  full_name text,
  phone text,
  avatar_url text,
  role public.app_role not null default 'parent',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  label text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  name text not null,
  age_group text,
  capacity integer,
  class_teacher_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null,
  room_label text,
  capacity integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, name)
);

create table if not exists public.parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  full_name text not null,
  phone_number text not null,
  whatsapp_number text,
  email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notification_preferences jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  admission_number text not null,
  dob date not null,
  gender public.app_gender not null default 'other',
  photo_url text,
  class_id uuid references public.classes (id) on delete set null,
  section_id uuid references public.sections (id) on delete set null,
  medical_notes text,
  allergy_details text,
  emergency_contact_name text,
  emergency_contact_phone text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, admission_number)
);

create table if not exists public.student_parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  parent_id uuid not null references public.parents (id) on delete cascade,
  relationship text not null default 'guardian',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (student_id, parent_id)
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  full_name text not null,
  email text,
  phone_number text,
  designation text not null,
  role text not null default 'teacher',
  photo_url text,
  permissions text[] not null default '{}',
  is_active boolean not null default true,
  class_teacher_for uuid references public.classes (id) on delete set null,
  dob date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_class_teacher_staff_fkey'
  ) then
    alter table public.classes
      add constraint classes_class_teacher_staff_fkey
      foreign key (class_teacher_staff_id)
      references public.staff (id)
      on delete set null;
  end if;
end $$;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  child_name text not null,
  parent_name text not null,
  phone_number text not null,
  email text,
  address text,
  source text,
  preferred_start_date date,
  notes text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  inquiry_id uuid references public.inquiries (id) on delete set null,
  student_id uuid references public.students (id) on delete set null,
  status text not null default 'pending_documents',
  submitted_at date,
  confirmed_at date,
  waitlist_rank integer,
  onboarding_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admission_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  inquiry_id uuid references public.inquiries (id) on delete set null,
  admission_id uuid references public.admissions (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  document_type text not null,
  file_name text not null,
  file_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  section_id uuid references public.sections (id) on delete set null,
  weekday text not null,
  start_time time not null,
  end_time time not null,
  title text not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  section_id uuid references public.sections (id) on delete set null,
  lesson_date date not null default current_date,
  title text not null,
  objective text,
  activity_details text,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worksheets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  section_id uuid references public.sections (id) on delete set null,
  title text not null,
  file_url text not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.classroom_updates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  section_id uuid references public.sections (id) on delete set null,
  title text not null,
  description text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.student_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  attendance_date date not null,
  status text not null default 'present',
  late_minutes integer,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_id, attendance_date)
);

create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  attendance_date date not null,
  status text not null default 'present',
  late_minutes integer,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, staff_id, attendance_date)
);

create table if not exists public.daily_activity_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  activity_date date not null default current_date,
  activity_type text not null,
  summary text not null,
  details text,
  status text,
  shared_with_parent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  billing_cycle text not null default 'monthly',
  total_amount numeric(12, 2) not null default 0,
  due_day integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fee_line_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  fee_structure_id uuid not null references public.fee_structures (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null default 0,
  is_mandatory boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  fee_structure_id uuid not null references public.fee_structures (id) on delete cascade,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  unique (student_id, fee_structure_id)
);

create table if not exists public.fee_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  fee_structure_id uuid references public.fee_structures (id) on delete set null,
  invoice_number text not null,
  due_date date not null,
  amount_due numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  status text not null default 'pending',
  receipt_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, invoice_number)
);

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  fee_invoice_id uuid not null references public.fee_invoices (id) on delete cascade,
  amount numeric(12, 2) not null,
  payment_date date not null default current_date,
  payment_mode text not null default 'cash',
  status text not null default 'paid',
  transaction_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  audience text not null,
  template_type text not null,
  body text not null,
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  message text not null,
  channel text not null default 'whatsapp',
  audience text not null default 'school_wide',
  status text not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivery_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  delivery_status text not null default 'pending',
  failure_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.content_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  category text not null,
  description text,
  design_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  template_id uuid references public.content_templates (id) on delete set null,
  title text not null,
  post_type text not null,
  caption text,
  scheduled_for timestamptz,
  status text not null default 'draft',
  asset_url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  event_type text not null default 'event',
  start_at timestamptz not null,
  end_at timestamptz,
  target_audience text,
  description text,
  reminder_offset_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_holidays (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  holiday_date date not null,
  holiday_type text not null default 'holiday',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  report_name text not null,
  format text not null default 'csv',
  file_url text,
  generated_at timestamptz not null default now()
);

create index if not exists idx_profiles_school_id on public.profiles (school_id);
create index if not exists idx_students_school_id on public.students (school_id);
create index if not exists idx_parents_school_id on public.parents (school_id);
create index if not exists idx_staff_school_id on public.staff (school_id);
create index if not exists idx_inquiries_school_id on public.inquiries (school_id);
create index if not exists idx_admissions_school_id on public.admissions (school_id);
create index if not exists idx_student_attendance_school_date on public.student_attendance (school_id, attendance_date);
create index if not exists idx_staff_attendance_school_date on public.staff_attendance (school_id, attendance_date);
create index if not exists idx_daily_activity_school_date on public.daily_activity_logs (school_id, activity_date);
create index if not exists idx_fee_invoices_school_due_date on public.fee_invoices (school_id, due_date);
create index if not exists idx_notifications_school_created_at on public.notifications (school_id, created_at desc);
create index if not exists idx_events_school_start_at on public.events (school_id, start_at);
create index if not exists idx_school_holidays_school_date on public.school_holidays (school_id, holiday_date);

drop trigger if exists schools_set_updated_at on public.schools;
create trigger schools_set_updated_at before update on public.schools for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists academic_years_set_updated_at on public.academic_years;
create trigger academic_years_set_updated_at before update on public.academic_years for each row execute function public.set_updated_at();

drop trigger if exists classes_set_updated_at on public.classes;
create trigger classes_set_updated_at before update on public.classes for each row execute function public.set_updated_at();

drop trigger if exists sections_set_updated_at on public.sections;
create trigger sections_set_updated_at before update on public.sections for each row execute function public.set_updated_at();

drop trigger if exists parents_set_updated_at on public.parents;
create trigger parents_set_updated_at before update on public.parents for each row execute function public.set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at before update on public.students for each row execute function public.set_updated_at();

drop trigger if exists staff_set_updated_at on public.staff;
create trigger staff_set_updated_at before update on public.staff for each row execute function public.set_updated_at();

drop trigger if exists inquiries_set_updated_at on public.inquiries;
create trigger inquiries_set_updated_at before update on public.inquiries for each row execute function public.set_updated_at();

drop trigger if exists admissions_set_updated_at on public.admissions;
create trigger admissions_set_updated_at before update on public.admissions for each row execute function public.set_updated_at();

drop trigger if exists timetable_entries_set_updated_at on public.timetable_entries;
create trigger timetable_entries_set_updated_at before update on public.timetable_entries for each row execute function public.set_updated_at();

drop trigger if exists lesson_plans_set_updated_at on public.lesson_plans;
create trigger lesson_plans_set_updated_at before update on public.lesson_plans for each row execute function public.set_updated_at();

drop trigger if exists student_attendance_set_updated_at on public.student_attendance;
create trigger student_attendance_set_updated_at before update on public.student_attendance for each row execute function public.set_updated_at();

drop trigger if exists staff_attendance_set_updated_at on public.staff_attendance;
create trigger staff_attendance_set_updated_at before update on public.staff_attendance for each row execute function public.set_updated_at();

drop trigger if exists daily_activity_logs_set_updated_at on public.daily_activity_logs;
create trigger daily_activity_logs_set_updated_at before update on public.daily_activity_logs for each row execute function public.set_updated_at();

drop trigger if exists fee_structures_set_updated_at on public.fee_structures;
create trigger fee_structures_set_updated_at before update on public.fee_structures for each row execute function public.set_updated_at();

drop trigger if exists fee_invoices_set_updated_at on public.fee_invoices;
create trigger fee_invoices_set_updated_at before update on public.fee_invoices for each row execute function public.set_updated_at();

drop trigger if exists whatsapp_templates_set_updated_at on public.whatsapp_templates;
create trigger whatsapp_templates_set_updated_at before update on public.whatsapp_templates for each row execute function public.set_updated_at();

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at before update on public.notifications for each row execute function public.set_updated_at();

drop trigger if exists content_templates_set_updated_at on public.content_templates;
create trigger content_templates_set_updated_at before update on public.content_templates for each row execute function public.set_updated_at();

drop trigger if exists content_posts_set_updated_at on public.content_posts;
create trigger content_posts_set_updated_at before update on public.content_posts for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();

drop trigger if exists school_holidays_set_updated_at on public.school_holidays;
create trigger school_holidays_set_updated_at before update on public.school_holidays for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id
  from public.profiles
  where user_id = auth.uid();
$$;

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where user_id = auth.uid();
$$;

create or replace function public.is_school_admin(target_school_id uuid)
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
      and role = 'admin'
      and school_id = target_school_id
      and is_active = true
  );
$$;

create or replace function public.bootstrap_school_admin(
  p_school_name text,
  p_full_name text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_school_id uuid;
  v_base_slug text;
  v_slug text;
  v_school_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select school_id into v_existing_school_id
  from public.profiles
  where user_id = v_user_id;

  if v_existing_school_id is not null then
    return v_existing_school_id;
  end if;

  v_base_slug := public.slugify(p_school_name);
  v_slug := v_base_slug;

  while exists (select 1 from public.schools where slug = v_slug) loop
    v_slug := v_base_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  end loop;

  insert into public.schools (name, slug)
  values (p_school_name, v_slug)
  returning id into v_school_id;

  update public.profiles
  set school_id = v_school_id,
      full_name = coalesce(p_full_name, full_name),
      phone = coalesce(p_phone, phone),
      role = 'admin',
      is_active = true
  where user_id = v_user_id;

  return v_school_id;
end;
$$;

grant execute on function public.bootstrap_school_admin(text, text, text) to authenticated;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.academic_years enable row level security;
alter table public.classes enable row level security;
alter table public.sections enable row level security;
alter table public.parents enable row level security;
alter table public.students enable row level security;
alter table public.student_parents enable row level security;
alter table public.staff enable row level security;
alter table public.inquiries enable row level security;
alter table public.admissions enable row level security;
alter table public.admission_documents enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.lesson_plans enable row level security;
alter table public.worksheets enable row level security;
alter table public.classroom_updates enable row level security;
alter table public.student_attendance enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.daily_activity_logs enable row level security;
alter table public.fee_structures enable row level security;
alter table public.fee_line_items enable row level security;
alter table public.fee_assignments enable row level security;
alter table public.fee_invoices enable row level security;
alter table public.fee_payments enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.content_templates enable row level security;
alter table public.content_posts enable row level security;
alter table public.events enable row level security;
alter table public.school_holidays enable row level security;
alter table public.report_exports enable row level security;

drop policy if exists schools_select_admin on public.schools;
create policy schools_select_admin on public.schools
for select to authenticated
using (public.is_school_admin(id));

drop policy if exists schools_update_admin on public.schools;
create policy schools_update_admin on public.schools
for update to authenticated
using (public.is_school_admin(id))
with check (public.is_school_admin(id));

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
for select to authenticated
using (auth.uid() = user_id or public.is_school_admin(school_id));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
for update to authenticated
using (auth.uid() = user_id or public.is_school_admin(school_id))
with check (auth.uid() = user_id or public.is_school_admin(school_id));

drop policy if exists academic_years_admin_manage on public.academic_years;
create policy academic_years_admin_manage on public.academic_years
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists classes_admin_manage on public.classes;
create policy classes_admin_manage on public.classes
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists sections_admin_manage on public.sections;
create policy sections_admin_manage on public.sections
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists parents_admin_manage on public.parents;
create policy parents_admin_manage on public.parents
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists students_admin_manage on public.students;
create policy students_admin_manage on public.students
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists student_parents_admin_manage on public.student_parents;
create policy student_parents_admin_manage on public.student_parents
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists staff_admin_manage on public.staff;
create policy staff_admin_manage on public.staff
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists inquiries_admin_manage on public.inquiries;
create policy inquiries_admin_manage on public.inquiries
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists admissions_admin_manage on public.admissions;
create policy admissions_admin_manage on public.admissions
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists admission_documents_admin_manage on public.admission_documents;
create policy admission_documents_admin_manage on public.admission_documents
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists timetable_entries_admin_manage on public.timetable_entries;
create policy timetable_entries_admin_manage on public.timetable_entries
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists lesson_plans_admin_manage on public.lesson_plans;
create policy lesson_plans_admin_manage on public.lesson_plans
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists worksheets_admin_manage on public.worksheets;
create policy worksheets_admin_manage on public.worksheets
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists classroom_updates_admin_manage on public.classroom_updates;
create policy classroom_updates_admin_manage on public.classroom_updates
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists student_attendance_admin_manage on public.student_attendance;
create policy student_attendance_admin_manage on public.student_attendance
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists staff_attendance_admin_manage on public.staff_attendance;
create policy staff_attendance_admin_manage on public.staff_attendance
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists daily_activity_logs_admin_manage on public.daily_activity_logs;
create policy daily_activity_logs_admin_manage on public.daily_activity_logs
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists fee_structures_admin_manage on public.fee_structures;
create policy fee_structures_admin_manage on public.fee_structures
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists fee_line_items_admin_manage on public.fee_line_items;
create policy fee_line_items_admin_manage on public.fee_line_items
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists fee_assignments_admin_manage on public.fee_assignments;
create policy fee_assignments_admin_manage on public.fee_assignments
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists fee_invoices_admin_manage on public.fee_invoices;
create policy fee_invoices_admin_manage on public.fee_invoices
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists fee_payments_admin_manage on public.fee_payments;
create policy fee_payments_admin_manage on public.fee_payments
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists whatsapp_templates_admin_manage on public.whatsapp_templates;
create policy whatsapp_templates_admin_manage on public.whatsapp_templates
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists notifications_admin_manage on public.notifications;
create policy notifications_admin_manage on public.notifications
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists notification_recipients_admin_manage on public.notification_recipients;
create policy notification_recipients_admin_manage on public.notification_recipients
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists content_templates_admin_manage on public.content_templates;
create policy content_templates_admin_manage on public.content_templates
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists content_posts_admin_manage on public.content_posts;
create policy content_posts_admin_manage on public.content_posts
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists events_admin_manage on public.events;
create policy events_admin_manage on public.events
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists school_holidays_admin_manage on public.school_holidays;
create policy school_holidays_admin_manage on public.school_holidays
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists report_exports_admin_manage on public.report_exports;
create policy report_exports_admin_manage on public.report_exports
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));
