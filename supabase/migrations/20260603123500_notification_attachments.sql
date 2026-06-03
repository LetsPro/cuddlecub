alter table public.notifications
  add column if not exists attachment_url text;
