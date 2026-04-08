alter table public.staff
  add column if not exists access_status text,
  add column if not exists access_invited_at timestamptz,
  add column if not exists password_reset_sent_at timestamptz,
  add column if not exists last_login_at timestamptz;

alter table public.parents
  add column if not exists access_status text,
  add column if not exists access_invited_at timestamptz,
  add column if not exists password_reset_sent_at timestamptz,
  add column if not exists last_login_at timestamptz;

alter table public.staff
  alter column access_status set default 'not_created';

alter table public.parents
  alter column access_status set default 'not_created';

update public.staff
set access_status = case
  when is_active = false then 'disabled'
  when last_login_at is not null then 'active'
  when user_id is not null or access_invited_at is not null or password_reset_sent_at is not null then 'invited'
  else 'not_created'
end
where access_status is null
   or access_status not in ('not_created', 'invited', 'active', 'disabled');

update public.parents
set access_status = case
  when is_active = false then 'disabled'
  when last_login_at is not null then 'active'
  when user_id is not null or access_invited_at is not null or password_reset_sent_at is not null then 'invited'
  else 'not_created'
end
where access_status is null
   or access_status not in ('not_created', 'invited', 'active', 'disabled');

alter table public.staff
  alter column access_status set not null;

alter table public.parents
  alter column access_status set not null;

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
      update public.staff
      set access_status = case when is_active then 'active' else 'disabled' end,
          last_login_at = now()
      where id = v_staff.id
      returning * into v_staff;

      update public.profiles
      set school_id = v_staff.school_id,
          full_name = coalesce(v_staff.full_name, public.profiles.full_name),
          phone = coalesce(v_staff.phone_number, public.profiles.phone),
          role = (
            case
              when lower(v_staff.role) = 'teacher' then 'teacher'
              else 'staff'
            end
          )::public.app_role,
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
      update public.parents
      set access_status = case when is_active then 'active' else 'disabled' end,
          last_login_at = now()
      where id = v_parent.id
      returning * into v_parent;

      update public.profiles
      set school_id = v_parent.school_id,
          full_name = coalesce(v_parent.full_name, public.profiles.full_name),
          phone = coalesce(v_parent.phone_number, public.profiles.phone),
          role = 'parent'::public.app_role,
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

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
for update to authenticated
using (
  auth.uid() = user_id
  or public.is_school_admin(school_id)
  or (school_id is null and public.current_role() = 'admin' and public.current_school_id() is not null)
)
with check (
  auth.uid() = user_id
  or public.is_school_admin(school_id)
);
