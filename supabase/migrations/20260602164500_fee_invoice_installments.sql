alter table public.fee_invoices
  add column if not exists installment_plan jsonb;
