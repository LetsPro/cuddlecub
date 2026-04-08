create or replace function public.can_bootstrap_school_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return not exists (
    select 1
    from public.profiles
    where role = 'admin'
      and school_id is not null
  );
end;
$$;

grant execute on function public.can_bootstrap_school_admin() to anon, authenticated;

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

  if not public.can_bootstrap_school_admin() then
    raise exception 'The school admin workspace has already been created.';
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
