alter table public.fee_invoices
  add column if not exists penalty_enabled boolean not null default false,
  add column if not exists penalty_per_day numeric(12, 2) not null default 250;
