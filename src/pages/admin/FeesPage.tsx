import { useEffect, useMemo, useState } from 'react';
import { Download, ReceiptIndianRupee, Wallet } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { openBrandedInvoicePdf } from '../../lib/invoices';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { FeeInvoice, FeePayment, FeeStructure, StudentRecord } from '../../types/app';

const invoiceSeed = {
  student_id: '',
  fee_structure_id: '',
  invoice_number: '',
  due_date: '',
  amount_due: '',
  status: 'pending',
};

const paymentSeed = {
  fee_invoice_id: '',
  amount: '',
  payment_date: new Date().toISOString().slice(0, 10),
  payment_mode: 'cash',
  status: 'paid',
};

export function FeesPage() {
  const { school } = useAppContext();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [invoiceForm, setInvoiceForm] = useState(invoiceSeed);
  const [paymentForm, setPaymentForm] = useState(paymentSeed);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadFees();
  }, [school.id]);

  async function loadFees() {
    setMessage(null);

    try {
      const [studentResponse, structureResponse, invoiceResponse, paymentResponse] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', school.id).eq('is_active', true).order('first_name'),
        supabase.from('fee_structures').select('*').eq('school_id', school.id).eq('is_active', true).order('name'),
        supabase.from('fee_invoices').select('*').eq('school_id', school.id).order('due_date', { ascending: false }),
        supabase.from('fee_payments').select('*').eq('school_id', school.id).order('payment_date', { ascending: false }),
      ]);

      setStudents((studentResponse.data ?? []) as StudentRecord[]);
      setFeeStructures((structureResponse.data ?? []) as FeeStructure[]);
      setInvoices((invoiceResponse.data ?? []) as FeeInvoice[]);
      setPayments((paymentResponse.data ?? []) as FeePayment[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleInvoiceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const { error } = await supabase.from('fee_invoices').insert({
        school_id: school.id,
        student_id: invoiceForm.student_id,
        fee_structure_id: invoiceForm.fee_structure_id || null,
        invoice_number: invoiceForm.invoice_number,
        due_date: invoiceForm.due_date,
        amount_due: Number(invoiceForm.amount_due),
        amount_paid: 0,
        status: invoiceForm.status,
      });

      if (error) throw error;
      setInvoiceForm(invoiceSeed);
      await loadFees();
      setMessage('Fee invoice created.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handlePaymentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const paymentAmount = Number(paymentForm.amount);
      const invoice = invoices.find((item) => item.id === paymentForm.fee_invoice_id);

      if (!invoice) {
        throw new Error('Please select a valid invoice.');
      }

      const { error } = await supabase.from('fee_payments').insert({
        school_id: school.id,
        fee_invoice_id: paymentForm.fee_invoice_id,
        amount: paymentAmount,
        payment_date: paymentForm.payment_date,
        payment_mode: paymentForm.payment_mode,
        status: paymentForm.status,
      });

      if (error) throw error;

      const amountPaid = (invoice.amount_paid ?? 0) + paymentAmount;
      const nextStatus = amountPaid >= invoice.amount_due ? 'paid' : 'partially_paid';

      const { error: invoiceError } = await supabase
        .from('fee_invoices')
        .update({
          amount_paid: amountPaid,
          status: nextStatus,
        })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      setPaymentForm(paymentSeed);
      await loadFees();
      setMessage('Payment recorded and invoice updated.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  const studentLookup = useMemo(
    () =>
      students.reduce<Record<string, string>>((accumulator, student) => {
        accumulator[student.id] = `${student.first_name} ${student.last_name}`;
        return accumulator;
      }, {}),
    [students],
  );

  const pendingAmount = invoices
    .filter((invoice) => invoice.status === 'pending' || invoice.status === 'partially_paid')
    .reduce((sum, invoice) => sum + (invoice.amount_due - (invoice.amount_paid ?? 0)), 0);

  function handleInvoicePdf(invoice: FeeInvoice) {
    try {
      openBrandedInvoicePdf({
        school,
        invoice,
        studentName: studentLookup[invoice.student_id] ?? 'Student',
        payments,
      });
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees"
        title="Plans, invoices, reminders and collections"
        description="Manage fee plans, monthly or term-wise invoices, due tracking, receipt-ready payment entries and parent ledgers."
      />

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Wallet} label="Active fee plans" value={feeStructures.length} />
        <StatCard icon={ReceiptIndianRupee} label="Open invoices" tone="amber" value={invoices.filter((invoice) => invoice.status !== 'paid').length} />
        <StatCard icon={Wallet} label="Pending due amount" tone="teal" value={formatCurrency(pendingAmount)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Create invoice" description="Assign a fee structure to a student and generate the amount due.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleInvoiceSubmit}>
            <div className="md:col-span-2">
              <label className="form-label">Student</label>
              <select className="form-input" onChange={(event) => setInvoiceForm((current) => ({ ...current, student_id: event.target.value }))} value={invoiceForm.student_id}>
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.first_name} {student.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Fee structure</label>
              <select className="form-input" onChange={(event) => setInvoiceForm((current) => ({ ...current, fee_structure_id: event.target.value }))} value={invoiceForm.fee_structure_id}>
                <option value="">Select structure</option>
                {feeStructures.map((structure) => (
                  <option key={structure.id} value={structure.id}>
                    {structure.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Invoice number</label>
              <input className="form-input" onChange={(event) => setInvoiceForm((current) => ({ ...current, invoice_number: event.target.value }))} value={invoiceForm.invoice_number} />
            </div>
            <div>
              <label className="form-label">Due date</label>
              <input className="form-input" onChange={(event) => setInvoiceForm((current) => ({ ...current, due_date: event.target.value }))} type="date" value={invoiceForm.due_date} />
            </div>
            <div>
              <label className="form-label">Amount due</label>
              <input className="form-input" onChange={(event) => setInvoiceForm((current) => ({ ...current, amount_due: event.target.value }))} type="number" value={invoiceForm.amount_due} />
            </div>
            <div className="md:col-span-2">
              <button className="button-primary" type="submit">
                Generate invoice
              </button>
              <p className="mt-2 text-xs text-slate-500">Use the invoice ledger below to open a branded PDF version for print or download.</p>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Record payment" description="Track payment receipts and update invoice balance.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handlePaymentSubmit}>
            <div className="md:col-span-2">
              <label className="form-label">Invoice</label>
              <select className="form-input" onChange={(event) => setPaymentForm((current) => ({ ...current, fee_invoice_id: event.target.value }))} value={paymentForm.fee_invoice_id}>
                <option value="">Select invoice</option>
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} · {studentLookup[invoice.student_id] ?? 'Student'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Amount</label>
              <input className="form-input" onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} type="number" value={paymentForm.amount} />
            </div>
            <div>
              <label className="form-label">Payment date</label>
              <input className="form-input" onChange={(event) => setPaymentForm((current) => ({ ...current, payment_date: event.target.value }))} type="date" value={paymentForm.payment_date} />
            </div>
            <div>
              <label className="form-label">Payment mode</label>
              <select className="form-input" onChange={(event) => setPaymentForm((current) => ({ ...current, payment_mode: event.target.value }))} value={paymentForm.payment_mode}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" onChange={(event) => setPaymentForm((current) => ({ ...current, status: event.target.value }))} value={paymentForm.status}>
                <option value="paid">Paid</option>
                <option value="pending_verification">Pending verification</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <button className="button-primary" type="submit">
                Save payment
              </button>
            </div>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Invoice ledger" description="Monitor pending dues, paid balances and due dates.">
          <DataTable
            columns={[
              { key: 'student', label: 'Student', render: (row) => studentLookup[row.student_id] ?? 'Unknown student' },
              { key: 'invoice', label: 'Invoice', render: (row) => row.invoice_number },
              { key: 'due', label: 'Due date', render: (row) => formatDate(row.due_date) },
              { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.amount_due) },
              { key: 'paid', label: 'Paid', render: (row) => formatCurrency(row.amount_paid) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              {
                key: 'pdf',
                label: 'PDF',
                render: (row) => (
                  <button className="button-secondary gap-1 px-3 py-2 text-xs" onClick={() => handleInvoicePdf(row)} type="button">
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </button>
                ),
              },
            ]}
            emptyMessage="No invoices available."
            rows={invoices}
          />
        </SectionCard>

        <SectionCard title="Recent payments" description="Latest payment activity across all invoices.">
          <DataTable
            columns={[
              { key: 'invoice', label: 'Invoice', render: (row) => invoices.find((invoice) => invoice.id === row.fee_invoice_id)?.invoice_number ?? 'Unknown invoice' },
              { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.amount) },
              { key: 'date', label: 'Date', render: (row) => formatDate(row.payment_date) },
              { key: 'mode', label: 'Mode', render: (row) => row.payment_mode },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            ]}
            emptyMessage="No payments recorded."
            rows={payments}
          />
        </SectionCard>
      </div>
    </div>
  );
}
