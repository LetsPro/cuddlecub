import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { openBrandedInvoicePdf } from '../../lib/invoices';
import { buildStudentNameMap } from '../../lib/portal-data';
import { useParentPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { FeeInvoice, FeePayment } from '../../types/app';

export function ParentFeesPage() {
  const { school } = useAppContext();
  const { parentRecord, students, message } = useParentPortal();
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  const studentNameMap = useMemo(() => buildStudentNameMap(students), [students]);

  useEffect(() => {
    if (!students.length) return;
    setSelectedStudentId((current) => current || students[0].id);
    void loadFees();
  }, [students.map((student) => student.id).join('|')]);

  async function loadFees() {
    setLoadMessage(null);
    try {
      const [invoiceResponse, paymentResponse] = await Promise.all([
        supabase.from('fee_invoices').select('*').in('student_id', students.map((student) => student.id)).order('due_date', { ascending: false }),
        supabase.from('fee_payments').select('*').order('payment_date', { ascending: false }).limit(100),
      ]);

      if (invoiceResponse.error) throw invoiceResponse.error;
      if (paymentResponse.error) throw paymentResponse.error;

      const invoiceRows = (invoiceResponse.data ?? []) as FeeInvoice[];
      const invoiceIds = invoiceRows.map((invoice) => invoice.id);
      const filteredPayments = ((paymentResponse.data ?? []) as FeePayment[]).filter((payment) => invoiceIds.includes(payment.fee_invoice_id));

      setInvoices(invoiceRows);
      setPayments(filteredPayments);
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  function downloadInvoice(invoice: FeeInvoice) {
    try {
      openBrandedInvoicePdf({
        school,
        invoice,
        studentName: studentNameMap[invoice.student_id] ?? 'Child',
        parentName: parentRecord?.full_name ?? 'Parent',
        parentPhone: parentRecord?.whatsapp_number || parentRecord?.phone_number || 'Not set',
        payments,
      });
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  const filteredInvoices = selectedStudentId ? invoices.filter((invoice) => invoice.student_id === selectedStudentId) : invoices;
  const filteredInvoiceIds = new Set(filteredInvoices.map((invoice) => invoice.id));
  const filteredPayments = payments.filter((payment) => filteredInvoiceIds.has(payment.fee_invoice_id));
  const totalDue = filteredInvoices.reduce((sum, invoice) => sum + Math.max(invoice.amount_due - (invoice.amount_paid ?? 0), 0), 0);
  const totalPaid = filteredInvoices.reduce((sum, invoice) => sum + (invoice.amount_paid ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees"
        title="Fee dues, payment history and receipts"
        description="View pending dues, recent payments and download invoice or receipt details from one place."
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <SectionCard title="Child" description="Choose a child to view their fees.">
        <select className="form-input max-w-sm" onChange={(event) => setSelectedStudentId(event.target.value)} value={selectedStudentId}>
          {students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}
        </select>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5"><p className="text-sm font-semibold text-amber-700">Amount due</p><p className="mt-2 text-2xl font-extrabold text-slate-900">{formatCurrency(totalDue)}</p></div>
        <div className="rounded-2xl border border-teal-100 bg-teal-50 p-5"><p className="text-sm font-semibold text-teal-700">Amount paid</p><p className="mt-2 text-2xl font-extrabold text-slate-900">{formatCurrency(totalPaid)}</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Fee invoices" description="Current and past invoices.">
          <div className="space-y-3">
            {filteredInvoices.map((invoice) => (
              <article className="rounded-2xl border border-slate-100 bg-white p-4" key={invoice.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold text-slate-900">{invoice.invoice_number}</p><p className="mt-1 text-sm text-slate-500">Due {formatDate(invoice.due_date)}</p></div><StatusBadge value={invoice.status} /></div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><div><p className="text-xs font-semibold text-slate-400">Balance</p><p className="mt-1 font-extrabold text-slate-900">{formatCurrency(Math.max(invoice.amount_due - (invoice.amount_paid ?? 0), 0))}</p></div><button className="button-secondary gap-2 px-3 py-2 text-xs" onClick={() => downloadInvoice(invoice)} type="button"><Download className="h-4 w-4" />Download PDF</button></div>
              </article>
            ))}
            {!filteredInvoices.length ? <p className="text-sm text-slate-500">No invoices found.</p> : null}
          </div>
        </SectionCard>

        <SectionCard title="Payment history" description="Latest payment confirmations recorded by school admin.">
          <div className="space-y-3">
            {filteredPayments.map((payment) => <article className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between" key={payment.id}><div><p className="font-bold text-slate-900">{formatCurrency(payment.amount)}</p><p className="mt-1 text-sm text-slate-500">{formatDate(payment.payment_date)} · {payment.payment_mode}</p></div><StatusBadge value={payment.status} /></article>)}
            {!filteredPayments.length ? <p className="text-sm text-slate-500">No payments recorded yet.</p> : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
