import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
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
  const { students, message } = useParentPortal();
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  const studentNameMap = useMemo(() => buildStudentNameMap(students), [students]);

  useEffect(() => {
    if (!students.length) return;
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
        payments,
      });
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

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

      <SectionCard title="Payment note" description="Online payment integration is not wired yet in this build.">
        <p className="text-sm text-slate-500">The portal currently shows dues, payment history and receipt downloads. Live online fee payment can be added in the next phase.</p>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Fee dues" description="Current invoices for your linked children.">
          <DataTable
            columns={[
              { key: 'student', label: 'Child', render: (row) => studentNameMap[row.student_id] ?? 'Unknown child' },
              { key: 'invoice', label: 'Invoice', render: (row) => row.invoice_number },
              { key: 'due', label: 'Due date', render: (row) => formatDate(row.due_date) },
              { key: 'amount', label: 'Amount due', render: (row) => formatCurrency(row.amount_due) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              {
                key: 'receipt',
                label: 'PDF',
                render: (row) => (
                  <button className="button-secondary gap-1 px-3 py-2 text-xs" onClick={() => downloadInvoice(row)} type="button">
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </button>
                ),
              },
            ]}
            emptyMessage="No invoices found."
            rows={invoices}
          />
        </SectionCard>

        <SectionCard title="Payment history" description="Latest payment confirmations recorded by school admin.">
          <DataTable
            columns={[
              { key: 'invoice', label: 'Invoice', render: (row) => invoices.find((invoice) => invoice.id === row.fee_invoice_id)?.invoice_number ?? 'Unknown invoice' },
              { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.amount) },
              { key: 'date', label: 'Date', render: (row) => formatDate(row.payment_date) },
              { key: 'mode', label: 'Mode', render: (row) => row.payment_mode },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            ]}
            emptyMessage="No payments recorded yet."
            rows={payments}
          />
        </SectionCard>
      </div>
    </div>
  );
}
