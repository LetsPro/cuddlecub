alter table public.fee_payments
  add column if not exists installment_label text;
