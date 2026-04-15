alter table public.website_pages
  add column if not exists about_mission text not null default 'To nurture every child with gentle care, joyful learning, and strong foundational skills in a safe early-years environment.',
  add column if not exists about_vision text not null default 'To help children grow into confident, compassionate, and globally ready learners who step into the future with curiosity and character.';
