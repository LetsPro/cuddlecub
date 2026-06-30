import type { FeeInvoice } from '../types/app';

export const DEFAULT_LATE_PENALTY_PER_DAY = 250;

export function getLatePenaltyDays(invoice: Pick<FeeInvoice, 'due_date' | 'status'>, asOf = new Date()) {
  if (invoice.status === 'paid') return 0;

  const dueDate = new Date(`${invoice.due_date}T00:00:00`);
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);

  const days = Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000);
  return Math.max(0, days);
}

export function getLatePenaltyAmount(invoice: Pick<FeeInvoice, 'due_date' | 'status' | 'penalty_enabled' | 'penalty_per_day'>) {
  if (!invoice.penalty_enabled) return 0;
  return getLatePenaltyDays(invoice) * Number(invoice.penalty_per_day ?? DEFAULT_LATE_PENALTY_PER_DAY);
}

export function getInvoicePayableAmount(invoice: Pick<FeeInvoice, 'amount_due' | 'due_date' | 'status' | 'penalty_enabled' | 'penalty_per_day'>) {
  return Number(invoice.amount_due ?? 0) + getLatePenaltyAmount(invoice);
}

export function getInvoiceBalance(invoice: Pick<FeeInvoice, 'amount_due' | 'amount_paid' | 'due_date' | 'status' | 'penalty_enabled' | 'penalty_per_day'>) {
  return Math.max(0, getInvoicePayableAmount(invoice) - Number(invoice.amount_paid ?? 0));
}
