alter table public.staff
  add column if not exists portal_password text;
