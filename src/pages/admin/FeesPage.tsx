import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, ReceiptIndianRupee, Trash2, Wallet } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { DEFAULT_LATE_PENALTY_PER_DAY, getInvoiceBalance, getInvoicePayableAmount, getLatePenaltyAmount, getLatePenaltyDays } from '../../lib/fees';
import { openBrandedInvoicePdf } from '../../lib/invoices';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { FeeInvoice, FeePayment, FeeStructure, StudentRecord } from '../../types/app';

const invoiceSeed = {
  student_id: '',
  fee_structure_id: '',
  invoice_number: '',
  due_date: '',
  total_amount: '',
  discount_amount: '0',
  amount_due: '',
  penalty_enabled: false,
  penalty_per_day: String(DEFAULT_LATE_PENALTY_PER_DAY),
  status: 'pending',
};

const paymentSeed = {
  fee_invoice_id: '',
  installment_label: '',
  amount: '',
  payment_date: new Date().toISOString().slice(0, 10),
  payment_mode: 'cash',
  status: 'paid',
};

interface InstallmentDraft {
  label: string;
  due_date: string;
  amount: string;
}

type FeeModal = 'invoice' | 'payment';

export function FeesPage() {
  const { school } = useAppContext();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [parentLookup, setParentLookup] = useState<Record<string, string>>({});
  const [parentPhoneLookup, setParentPhoneLookup] = useState<Record<string, string>>({});
  const [invoiceForm, setInvoiceForm] = useState(invoiceSeed);
  const [paymentForm, setPaymentForm] = useState(paymentSeed);
  const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(3);
  const [installmentRows, setInstallmentRows] = useState<InstallmentDraft[]>([]);
  const [feeModal, setFeeModal] = useState<FeeModal | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadFees();
  }, [school.id]);

  useEffect(() => {
    setInvoiceForm((current) =>
      current.invoice_number
        ? current
        : {
            ...current,
            invoice_number: generateInvoiceNumber(),
            due_date: current.due_date || new Date().toISOString().slice(0, 10),
          },
    );
  }, [invoices]);

  async function loadFees() {
    setMessage(null);

    try {
      const [studentResponse, structureResponse, invoiceResponse, paymentResponse, parentResponse] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', school.id).eq('is_active', true).order('first_name'),
        supabase.from('fee_structures').select('*').eq('school_id', school.id).eq('is_active', true).order('name'),
        supabase.from('fee_invoices').select('*').eq('school_id', school.id).order('due_date', { ascending: false }),
        supabase.from('fee_payments').select('*').eq('school_id', school.id).order('payment_date', { ascending: false }),
        supabase.from('student_parents').select('student_id, is_primary, parents(full_name, phone_number, whatsapp_number)').eq('school_id', school.id),
      ]);

      if (studentResponse.error) throw studentResponse.error;
      if (structureResponse.error) throw structureResponse.error;
      if (invoiceResponse.error) throw invoiceResponse.error;
      if (paymentResponse.error) throw paymentResponse.error;
      if (parentResponse.error) throw parentResponse.error;

      setStudents((studentResponse.data ?? []) as StudentRecord[]);
      setFeeStructures((structureResponse.data ?? []) as FeeStructure[]);
      setInvoices((invoiceResponse.data ?? []) as FeeInvoice[]);
      setPayments((paymentResponse.data ?? []) as FeePayment[]);
      setParentLookup(
        ((parentResponse.data ?? []) as Array<Record<string, any>>).reduce<Record<string, string>>((accumulator, row) => {
          const studentId = row.student_id as string | null;
          const parentName = row.parents?.full_name as string | undefined;

          if (!studentId || !parentName) {
            return accumulator;
          }

          if (row.is_primary || !accumulator[studentId]) {
            accumulator[studentId] = parentName;
          }

          return accumulator;
        }, {}),
      );
      setParentPhoneLookup(
        ((parentResponse.data ?? []) as Array<Record<string, any>>).reduce<Record<string, string>>((accumulator, row) => {
          const studentId = row.student_id as string | null;
          const phoneNumber = (row.parents?.whatsapp_number || row.parents?.phone_number) as string | undefined;

          if (!studentId || !phoneNumber) {
            return accumulator;
          }

          if (row.is_primary || !accumulator[studentId]) {
            accumulator[studentId] = phoneNumber;
          }

          return accumulator;
        }, {}),
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const nextNumber =
      invoices
        .map((invoice) => invoice.invoice_number)
        .filter((number) => number.startsWith(prefix))
        .map((number) => Number(number.slice(prefix.length)))
        .filter((number) => Number.isFinite(number))
        .reduce((highest, number) => Math.max(highest, number), 0) + 1;

    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  }

  function getDefaultDueDate(structure: FeeStructure | undefined) {
    const date = new Date();

    if (structure?.due_day) {
      date.setDate(Math.min(structure.due_day, 28));
    }

    return date.toISOString().slice(0, 10);
  }

  function isMissingInstallmentColumn(error: unknown) {
    return getErrorMessage(error).toLowerCase().includes('installment_plan');
  }

  function isMissingPaymentInstallmentColumn(error: unknown) {
    return getErrorMessage(error).toLowerCase().includes('installment_label');
  }

  function buildInstallmentRows(count: number, amount: number, firstDueDate: string) {
    const safeCount = Math.max(1, count);
    const baseAmount = Math.floor(amount / safeCount);
    const remainder = amount - baseAmount * safeCount;
    const baseDate = firstDueDate ? new Date(firstDueDate) : new Date();

    return Array.from({ length: safeCount }, (_, index) => {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(baseDate.getMonth() + index);

      return {
        label: `Installment ${index + 1}`,
        due_date: dueDate.toISOString().slice(0, 10),
        amount: String(baseAmount + (index === safeCount - 1 ? remainder : 0)),
      };
    });
  }

  function resetInstallments(count = installmentCount, amountValue = invoiceForm.amount_due, dueDate = invoiceForm.due_date) {
    setInstallmentRows(buildInstallmentRows(count, Number(amountValue || 0), dueDate || new Date().toISOString().slice(0, 10)));
  }

  function handleInstallmentToggle(enabled: boolean) {
    setInstallmentsEnabled(enabled);

    if (enabled) {
      resetInstallments();
    } else {
      setInstallmentRows([]);
    }
  }

  function handleInstallmentCountChange(value: string) {
    const nextCount = Math.max(1, Number(value || 1));
    setInstallmentCount(nextCount);
    resetInstallments(nextCount);
  }

  function openInvoiceFormDefaults() {
    setInvoiceForm((current) => ({
      ...current,
      invoice_number: current.invoice_number || generateInvoiceNumber(),
      due_date: current.due_date || new Date().toISOString().slice(0, 10),
    }));
  }

  function openInvoiceModal() {
    setInvoiceForm({
      ...invoiceSeed,
      invoice_number: generateInvoiceNumber(),
      due_date: new Date().toISOString().slice(0, 10),
    });
    setInstallmentsEnabled(false);
    setInstallmentCount(3);
    setInstallmentRows([]);
    setFeeModal('invoice');
  }

  function openPaymentModal() {
    setPaymentForm(paymentSeed);
    setFeeModal('payment');
  }

  function closeFeeModal() {
    setFeeModal(null);
  }

  function handleFeeStructureChange(feeStructureId: string) {
    const structure = feeStructures.find((item) => item.id === feeStructureId);
    const totalAmount = structure?.total_amount ?? 0;
    const discountAmount = Number(invoiceForm.discount_amount || 0);
    const amountDue = Math.max(0, totalAmount - discountAmount);

    setInvoiceForm((current) => ({
      ...current,
      fee_structure_id: feeStructureId,
      due_date: current.due_date || getDefaultDueDate(structure),
      total_amount: structure ? String(totalAmount) : '',
      amount_due: structure ? String(amountDue) : current.amount_due,
    }));

    if (installmentsEnabled) {
      resetInstallments(installmentCount, String(amountDue), invoiceForm.due_date || getDefaultDueDate(structure));
    }
  }

  function handleDiscountChange(value: string) {
    const totalAmount = Number(invoiceForm.total_amount || invoiceForm.amount_due || 0);
    const discountAmount = Number(value || 0);

    setInvoiceForm((current) => ({
      ...current,
      discount_amount: value,
      amount_due: String(Math.max(0, totalAmount - discountAmount)),
    }));

    if (installmentsEnabled) {
      resetInstallments(installmentCount, String(Math.max(0, totalAmount - discountAmount)));
    }
  }

  function handleStudentChange(studentId: string) {
    setInvoiceForm((current) => ({
      ...current,
      student_id: studentId,
      invoice_number: current.invoice_number || generateInvoiceNumber(),
    }));
  }

  function getInvoiceInstallments(invoice: FeeInvoice | undefined) {
    if (!invoice || !Array.isArray(invoice.installment_plan) || invoice.installment_plan.length === 0) {
      return [];
    }

    return invoice.installment_plan;
  }

  function getPaidInstallmentLabels(invoiceId: string) {
    return new Set(
      payments
        .filter((payment) => payment.fee_invoice_id === invoiceId && payment.status !== 'failed' && payment.installment_label)
        .map((payment) => payment.installment_label as string),
    );
  }

  function handlePaymentInvoiceChange(invoiceId: string) {
    const invoice = invoices.find((item) => item.id === invoiceId);

    setPaymentForm((current) => ({
      ...current,
      fee_invoice_id: invoiceId,
      installment_label: '',
      amount: invoice ? String(getInvoiceBalance(invoice)) : '',
    }));
  }

  function handlePaymentInstallmentChange(installmentLabel: string) {
    const invoice = invoices.find((item) => item.id === paymentForm.fee_invoice_id);
    const installment = getInvoiceInstallments(invoice).find((item) => item.label === installmentLabel);

    setPaymentForm((current) => ({
      ...current,
      installment_label: installmentLabel,
      amount: installment ? String(installment.amount) : current.amount,
      payment_date: installment?.due_date || current.payment_date,
    }));
  }

  async function handleInvoiceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const payload = {
        school_id: school.id,
        student_id: invoiceForm.student_id,
        fee_structure_id: invoiceForm.fee_structure_id || null,
        invoice_number: invoiceForm.invoice_number,
        due_date: invoiceForm.due_date,
        amount_due: Number(invoiceForm.amount_due),
        amount_paid: 0,
        penalty_enabled: invoiceForm.penalty_enabled,
        penalty_per_day: invoiceForm.penalty_enabled ? Number(invoiceForm.penalty_per_day || DEFAULT_LATE_PENALTY_PER_DAY) : DEFAULT_LATE_PENALTY_PER_DAY,
        status: invoiceForm.status,
      };
      const payloadWithInstallments = {
        ...payload,
        installment_plan: installmentsEnabled
          ? installmentRows.map((row, index) => ({
              label: row.label || `Installment ${index + 1}`,
              due_date: row.due_date,
              amount: Number(row.amount || 0),
            }))
          : null,
      };

      let { error } = await supabase.from('fee_invoices').insert(payloadWithInstallments);
      if (error && isMissingInstallmentColumn(error)) {
        ({ error } = await supabase.from('fee_invoices').insert(payload));
      }

      if (error) throw error;
      setInvoiceForm(invoiceSeed);
      setInstallmentsEnabled(false);
      setInstallmentRows([]);
      await loadFees();
      closeFeeModal();
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

      if (paymentForm.installment_label && getPaidInstallmentLabels(invoice.id).has(paymentForm.installment_label)) {
        throw new Error('This installment is already marked as paid. Select another installment.');
      }

      const paymentPayload = {
        school_id: school.id,
        fee_invoice_id: paymentForm.fee_invoice_id,
        installment_label: paymentForm.installment_label || null,
        amount: paymentAmount,
        payment_date: paymentForm.payment_date,
        payment_mode: paymentForm.payment_mode,
        status: paymentForm.status,
      };

      let { error } = await supabase.from('fee_payments').insert(paymentPayload);
      if (error && isMissingPaymentInstallmentColumn(error)) {
        const payloadWithoutInstallment = {
          school_id: paymentPayload.school_id,
          fee_invoice_id: paymentPayload.fee_invoice_id,
          amount: paymentPayload.amount,
          payment_date: paymentPayload.payment_date,
          payment_mode: paymentPayload.payment_mode,
          status: paymentPayload.status,
        };
        ({ error } = await supabase.from('fee_payments').insert(payloadWithoutInstallment));
      }

      if (error) throw error;

      const amountPaid = (invoice.amount_paid ?? 0) + paymentAmount;
      const nextStatus = amountPaid >= getInvoicePayableAmount(invoice) ? 'paid' : 'partially_paid';

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
      closeFeeModal();
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

  const feeStructureLookup = useMemo(
    () =>
      feeStructures.reduce<Record<string, FeeStructure>>((accumulator, structure) => {
        accumulator[structure.id] = structure;
        return accumulator;
      }, {}),
    [feeStructures],
  );

  const selectedStudent = students.find((student) => student.id === invoiceForm.student_id);
  const selectedFeeStructure = feeStructures.find((structure) => structure.id === invoiceForm.fee_structure_id);
  const selectedPaymentInvoice = invoices.find((invoice) => invoice.id === paymentForm.fee_invoice_id);
  const selectedPaymentInstallments = getInvoiceInstallments(selectedPaymentInvoice);
  const paidInstallmentLabels = selectedPaymentInvoice ? getPaidInstallmentLabels(selectedPaymentInvoice.id) : new Set<string>();

  const pendingAmount = invoices
    .filter((invoice) => invoice.status === 'pending' || invoice.status === 'partially_paid')
    .reduce((sum, invoice) => sum + getInvoiceBalance(invoice), 0);

  async function handleInvoicePdf(invoice: FeeInvoice) {
    try {
      await openBrandedInvoicePdf({
        school,
        invoice,
        studentName: studentLookup[invoice.student_id] ?? 'Student',
        parentName: parentLookup[invoice.student_id] ?? 'Parent',
        parentPhone: parentPhoneLookup[invoice.student_id] ?? 'Not set',
        admissionNumber: students.find((student) => student.id === invoice.student_id)?.admission_number ?? 'Not set',
        feeStructureName: invoice.fee_structure_id ? feeStructureLookup[invoice.fee_structure_id]?.name : undefined,
        totalFee: invoice.fee_structure_id ? feeStructureLookup[invoice.fee_structure_id]?.total_amount : invoice.amount_due,
        payments,
      });
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteInvoice(invoice: FeeInvoice) {
    const confirmed = window.confirm(`Delete invoice ${invoice.invoice_number}? Related payment records for this invoice will also be removed.`);

    if (!confirmed) {
      return;
    }

    setBusyDeleteId(invoice.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('fee_invoices').delete().eq('id', invoice.id);
      if (error) throw error;

      await loadFees();
      setMessage('Invoice deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  function renderInvoiceForm() {
    return (
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleInvoiceSubmit}>
        <div className="md:col-span-2">
          <label className="form-label">Student</label>
          <select className="form-input" onFocus={openInvoiceFormDefaults} onChange={(event) => handleStudentChange(event.target.value)} required value={invoiceForm.student_id}>
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.first_name} {student.last_name} · {student.admission_number}
              </option>
            ))}
          </select>
        </div>
        {selectedStudent ? (
          <div className="md:col-span-2 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Bill to parent</p>
                <p className="mt-1 font-semibold text-slate-800">{parentLookup[selectedStudent.id] ?? 'Parent not linked'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Admission no.</p>
                <p className="mt-1 font-semibold text-slate-800">{selectedStudent.admission_number}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Invoice no.</p>
                <p className="mt-1 font-semibold text-slate-800">{invoiceForm.invoice_number || generateInvoiceNumber()}</p>
              </div>
            </div>
          </div>
        ) : null}
        <div>
          <label className="form-label">Fee structure</label>
          <select className="form-input" onFocus={openInvoiceFormDefaults} onChange={(event) => handleFeeStructureChange(event.target.value)} required value={invoiceForm.fee_structure_id}>
            <option value="">Select structure</option>
            {feeStructures.map((structure) => (
              <option key={structure.id} value={structure.id}>
                {structure.name} · {formatCurrency(structure.total_amount)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Invoice number</label>
          <input className="form-input" onFocus={openInvoiceFormDefaults} onChange={(event) => setInvoiceForm((current) => ({ ...current, invoice_number: event.target.value }))} required value={invoiceForm.invoice_number} />
        </div>
        <div>
          <label className="form-label">Due date</label>
          <input
            className="form-input"
            onFocus={openInvoiceFormDefaults}
            onChange={(event) => {
              setInvoiceForm((current) => ({ ...current, due_date: event.target.value }));
              if (installmentsEnabled) {
                resetInstallments(installmentCount, invoiceForm.amount_due, event.target.value);
              }
            }}
            required
            type="date"
            value={invoiceForm.due_date}
          />
        </div>
        <div>
          <label className="form-label">Total fee</label>
          <input
            className="form-input"
            onChange={(event) => {
              const nextAmountDue = String(Math.max(0, Number(event.target.value || 0) - Number(invoiceForm.discount_amount || 0)));
              setInvoiceForm((current) => ({ ...current, total_amount: event.target.value, amount_due: nextAmountDue }));
              if (installmentsEnabled) {
                resetInstallments(installmentCount, nextAmountDue);
              }
            }}
            type="number"
            value={invoiceForm.total_amount}
          />
        </div>
        <div>
          <label className="form-label">Discount</label>
          <input className="form-input" onChange={(event) => handleDiscountChange(event.target.value)} type="number" value={invoiceForm.discount_amount} />
        </div>
        <div>
          <label className="form-label">Amount due</label>
          <input
            className="form-input"
            onChange={(event) => {
              setInvoiceForm((current) => ({ ...current, amount_due: event.target.value }));
              if (installmentsEnabled) {
                resetInstallments(installmentCount, event.target.value);
              }
            }}
            required
            type="number"
            value={invoiceForm.amount_due}
          />
        </div>
        <div>
          <label className="form-label">Status</label>
          <select className="form-input" onChange={(event) => setInvoiceForm((current) => ({ ...current, status: event.target.value }))} value={invoiceForm.status}>
            <option value="pending">Pending</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-800">Late payment penalty</p>
              <p className="text-xs text-slate-500">Apply a per-day penalty after the invoice due date.</p>
            </div>
            <input checked={invoiceForm.penalty_enabled} onChange={(event) => setInvoiceForm((current) => ({ ...current, penalty_enabled: event.target.checked }))} type="checkbox" />
          </label>
          {invoiceForm.penalty_enabled ? (
            <div className="mt-4 max-w-xs">
              <label className="form-label">Penalty per day</label>
              <input
                className="form-input"
                min={0}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, penalty_per_day: event.target.value }))}
                type="number"
                value={invoiceForm.penalty_per_day}
              />
              <p className="mt-2 text-xs text-slate-500">Default is {formatCurrency(DEFAULT_LATE_PENALTY_PER_DAY)} per day.</p>
            </div>
          ) : null}
        </div>
        <div className="md:col-span-2 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-800">Installments</p>
              <p className="text-xs text-slate-500">Turn on to split the amount into editable installment dates and amounts.</p>
            </div>
            <input checked={installmentsEnabled} onChange={(event) => handleInstallmentToggle(event.target.checked)} type="checkbox" />
          </label>
          {installmentsEnabled ? (
            <div className="mt-4 space-y-3">
              <div className="max-w-xs">
                <label className="form-label">Number of installments</label>
                <input className="form-input" min={1} onChange={(event) => handleInstallmentCountChange(event.target.value)} type="number" value={installmentCount} />
              </div>
              <div className="grid gap-3">
                {installmentRows.map((row, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
                    <input
                      className="form-input"
                      onChange={(event) => setInstallmentRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))}
                      value={row.label}
                    />
                    <input
                      className="form-input"
                      onChange={(event) => setInstallmentRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, due_date: event.target.value } : item)))}
                      type="date"
                      value={row.due_date}
                    />
                    <input
                      className="form-input"
                      onChange={(event) => setInstallmentRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, amount: event.target.value } : item)))}
                      type="number"
                      value={row.amount}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="md:col-span-2 flex justify-end gap-3">
          <button className="button-secondary" onClick={closeFeeModal} type="button">
            Cancel
          </button>
          <button className="button-primary" type="submit">
            Generate invoice
          </button>
        </div>
      </form>
    );
  }

  function renderPaymentForm() {
    return (
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handlePaymentSubmit}>
        <div className="md:col-span-2">
          <label className="form-label">Invoice</label>
          <select className="form-input" onChange={(event) => handlePaymentInvoiceChange(event.target.value)} required value={paymentForm.fee_invoice_id}>
            <option value="">Select invoice</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoice_number} · {studentLookup[invoice.student_id] ?? 'Student'}
              </option>
            ))}
          </select>
        </div>
        {selectedPaymentInstallments.length > 0 ? (
          <div className="md:col-span-2">
            <label className="form-label">Installment</label>
            <select className="form-input" onChange={(event) => handlePaymentInstallmentChange(event.target.value)} required value={paymentForm.installment_label}>
              <option value="">Select unpaid installment</option>
              {selectedPaymentInstallments.map((installment) => {
                const isPaid = paidInstallmentLabels.has(installment.label);

                return (
                  <option disabled={isPaid} key={installment.label} value={installment.label}>
                    {installment.label}
                    {installment.due_date ? ` · ${formatDate(installment.due_date)}` : ''}
                    {` · ${formatCurrency(installment.amount)}`}
                    {isPaid ? ' · paid' : ''}
                  </option>
                );
              })}
            </select>
            <p className="mt-2 text-xs text-slate-500">Paid installments are locked so the same installment cannot be selected again.</p>
          </div>
        ) : null}
        <div>
          <label className="form-label">Amount</label>
          <input className="form-input" onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} required type="number" value={paymentForm.amount} />
        </div>
        <div>
          <label className="form-label">Payment date</label>
          <input className="form-input" onChange={(event) => setPaymentForm((current) => ({ ...current, payment_date: event.target.value }))} required type="date" value={paymentForm.payment_date} />
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
        <div className="md:col-span-2 flex justify-end gap-3">
          <button className="button-secondary" onClick={closeFeeModal} type="button">
            Cancel
          </button>
          <button className="button-primary" type="submit">
            Save payment
          </button>
        </div>
      </form>
    );
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

      <div className="space-y-6">
        <SectionCard
          title="Invoice ledger"
          description="Monitor pending dues, paid balances and due dates."
          action={
            <button className="button-primary gap-2" onClick={openInvoiceModal} type="button">
              <Plus className="h-4 w-4" />
              Add invoice
            </button>
          }
        >
          <DataTable
            columns={[
              { key: 'student', label: 'Student', render: (row) => studentLookup[row.student_id] ?? 'Unknown student' },
              { key: 'invoice', label: 'Invoice', render: (row) => row.invoice_number },
              { key: 'due', label: 'Due date', render: (row) => formatDate(row.due_date) },
              { key: 'amount', label: 'Base amount', render: (row) => formatCurrency(row.amount_due) },
              {
                key: 'penalty',
                label: 'Penalty',
                render: (row) => {
                  const penalty = getLatePenaltyAmount(row);
                  return penalty ? `${formatCurrency(penalty)} (${getLatePenaltyDays(row)} days)` : '-';
                },
              },
              { key: 'paid', label: 'Paid', render: (row) => formatCurrency(row.amount_paid) },
              { key: 'balance', label: 'Balance', render: (row) => formatCurrency(getInvoiceBalance(row)) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              {
                key: 'action',
                label: 'Action',
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary gap-1 px-3 py-2 text-xs" onClick={() => handleInvoicePdf(row)} type="button">
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </button>
                    <button className="button-danger gap-1 px-3 py-2 text-xs" disabled={busyDeleteId === row.id} onClick={() => void handleDeleteInvoice(row)} type="button">
                      <Trash2 className="h-3.5 w-3.5" />
                      {busyDeleteId === row.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ),
              },
            ]}
            emptyMessage="No invoices available."
            rows={invoices}
          />
        </SectionCard>

        <SectionCard
          title="Recent payments"
          description="Latest payment activity across all invoices."
          action={
            <button className="button-primary gap-2" onClick={openPaymentModal} type="button">
              <Plus className="h-4 w-4" />
              Add payment
            </button>
          }
        >
          <DataTable
            columns={[
              { key: 'invoice', label: 'Invoice', render: (row) => invoices.find((invoice) => invoice.id === row.fee_invoice_id)?.invoice_number ?? 'Unknown invoice' },
              { key: 'installment', label: 'Installment', render: (row) => row.installment_label ?? 'General' },
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

      <Modal
        description="Select the student and fee structure, then adjust discount and installments if needed."
        onClose={closeFeeModal}
        open={feeModal === 'invoice'}
        size="lg"
        title="Create invoice"
      >
        {renderInvoiceForm()}
      </Modal>

      <Modal
        description="Record a payment against an existing invoice and update its balance."
        onClose={closeFeeModal}
        open={feeModal === 'payment'}
        size="lg"
        title="Record payment"
      >
        {renderPaymentForm()}
      </Modal>
    </div>
  );
}
