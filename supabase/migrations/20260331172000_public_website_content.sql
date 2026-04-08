create table if not exists public.website_pages (
  school_id uuid primary key references public.schools (id) on delete cascade,
  home_eyebrow text not null default 'Early Years Excellence',
  home_title text not null default 'A joyful foundation for confident little learners.',
  home_subtitle text not null default 'A nurturing preschool experience with caring teachers, safe routines, and playful learning every day.',
  home_primary_cta_label text not null default 'Explore programs',
  home_primary_cta_href text not null default '/programs',
  home_secondary_cta_label text not null default 'About the school',
  home_secondary_cta_href text not null default '/about',
  about_eyebrow text not null default 'About Us',
  about_title text not null default 'A warm learning space built for early childhood.',
  about_summary text not null default 'We create a secure, joyful environment where every child learns through play, routine, creativity, and caring guidance.',
  about_story text not null default 'Our approach blends foundational academics, social-emotional development, creative exploration, and strong parent communication so children feel safe, happy, and ready to grow.',
  about_points text[] not null default array[
    'Play-based learning with structured routines',
    'Safe, caring classrooms and child-first attention',
    'Regular parent communication and progress updates',
    'Creative, physical, and social development every day'
  ]::text[],
  programs_eyebrow text not null default 'Programs',
  programs_title text not null default 'Age-appropriate programs for every early stage.',
  programs_intro text not null default 'Each program is designed to match the child''s developmental stage with the right balance of discovery, rhythm, and learning support.',
  gallery_eyebrow text not null default 'Gallery',
  gallery_title text not null default 'Moments that show learning, joy, and care.',
  gallery_intro text not null default 'A look into daily activities, celebrations, classroom engagement, and school events.',
  footer_tagline text not null default 'A caring preschool experience with strong academics, daily routines, and parent connection.',
  footer_address text,
  footer_phone text,
  footer_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_hero_slides (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  eyebrow text,
  title text not null,
  subtitle text not null,
  cta_label text,
  cta_href text,
  image_url text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_programs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  age_range text,
  schedule text,
  summary text not null,
  highlights text[] not null default '{}'::text[],
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_gallery_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  category text,
  description text,
  image_url text not null,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_website_hero_slides_school_sort on public.website_hero_slides (school_id, sort_order);
create index if not exists idx_website_programs_school_sort on public.website_programs (school_id, sort_order);
create index if not exists idx_website_gallery_items_school_sort on public.website_gallery_items (school_id, sort_order);

drop trigger if exists website_pages_set_updated_at on public.website_pages;
create trigger website_pages_set_updated_at before update on public.website_pages for each row execute function public.set_updated_at();

drop trigger if exists website_hero_slides_set_updated_at on public.website_hero_slides;
create trigger website_hero_slides_set_updated_at before update on public.website_hero_slides for each row execute function public.set_updated_at();

drop trigger if exists website_programs_set_updated_at on public.website_programs;
create trigger website_programs_set_updated_at before update on public.website_programs for each row execute function public.set_updated_at();

drop trigger if exists website_gallery_items_set_updated_at on public.website_gallery_items;
create trigger website_gallery_items_set_updated_at before update on public.website_gallery_items for each row execute function public.set_updated_at();

alter table public.website_pages enable row level security;
alter table public.website_hero_slides enable row level security;
alter table public.website_programs enable row level security;
alter table public.website_gallery_items enable row level security;

drop policy if exists website_pages_admin_all on public.website_pages;
create policy website_pages_admin_all on public.website_pages
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists website_hero_slides_admin_all on public.website_hero_slides;
create policy website_hero_slides_admin_all on public.website_hero_slides
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists website_programs_admin_all on public.website_programs;
create policy website_programs_admin_all on public.website_programs
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists website_gallery_items_admin_all on public.website_gallery_items;
create policy website_gallery_items_admin_all on public.website_gallery_items
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

create or replace function public.get_public_school_website(p_school_slug text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school public.schools;
  v_page public.website_pages;
begin
  select *
  into v_school
  from public.schools
  where p_school_slug is null or slug = p_school_slug
  order by created_at asc
  limit 1;

  if not found then
    return null;
  end if;

  select *
  into v_page
  from public.website_pages
  where school_id = v_school.id;

  return jsonb_build_object(
    'school',
    jsonb_build_object(
      'id', v_school.id,
      'name', v_school.name,
      'slug', v_school.slug,
      'address', v_school.address,
      'contact_email', v_school.contact_email,
      'contact_phone', v_school.contact_phone,
      'logo_url', v_school.logo_url,
      'academic_year_label', v_school.academic_year_label,
      'primary_color', v_school.primary_color,
      'secondary_color', v_school.secondary_color,
      'settings', coalesce(v_school.settings, '{}'::jsonb)
    ),
    'page',
    coalesce(
      to_jsonb(v_page) - 'school_id' - 'created_at' - 'updated_at',
      '{}'::jsonb
    ),
    'slides',
    coalesce(
      (
        select jsonb_agg(to_jsonb(item) - 'school_id' order by item.sort_order, item.created_at)
        from public.website_hero_slides item
        where item.school_id = v_school.id
          and item.is_active = true
      ),
      '[]'::jsonb
    ),
    'programs',
    coalesce(
      (
        select jsonb_agg(to_jsonb(item) - 'school_id' order by item.sort_order, item.created_at)
        from public.website_programs item
        where item.school_id = v_school.id
          and item.is_active = true
      ),
      '[]'::jsonb
    ),
    'gallery',
    coalesce(
      (
        select jsonb_agg(to_jsonb(item) - 'school_id' order by item.is_featured desc, item.sort_order, item.created_at)
        from public.website_gallery_items item
        where item.school_id = v_school.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_public_school_website(text) to anon, authenticated;
