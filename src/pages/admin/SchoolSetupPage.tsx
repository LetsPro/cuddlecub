import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, CalendarRange, GraduationCap, PencilLine, Plus, Trash2, Wallet } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { ToastMessage } from '../../lib/toast';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { AcademicYear, FeeStructure, SchoolClass, Section } from '../../types/app';

interface HolidayRecord {
  id: string;
  title: string;
  holiday_date: string;
  holiday_type: string;
}

interface SetupMetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}

type SetupModalType = 'academicYear' | 'class' | 'fee' | 'holiday';

function SetupMetricCard({ icon: Icon, label, value, detail }: SetupMetricCardProps) {
  return (
    <div className="card-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className="mt-3 text-2xl font-extrabold text-slate-900">{value}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
        </div>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{ background: 'linear-gradient(135deg, var(--school-primary), rgb(var(--school-secondary-rgb) / 0.94))' }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function SchoolSetupPage() {
  const { school, refreshSchool } = useAppContext();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [editingAcademicYearId, setEditingAcademicYearId] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [setupModal, setSetupModal] = useState<SetupModalType | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [academicYearForm, setAcademicYearForm] = useState({
    label: '',
    start_date: '',
    end_date: '',
    is_active: true,
  });
  const [classForm, setClassForm] = useState({
    name: '',
    age_group: '',
    capacity: '',
    section_name: '',
    room_label: '',
    section_capacity: '',
  });
  const [feeForm, setFeeForm] = useState({
    name: '',
    billing_cycle: 'monthly',
    total_amount: '',
    due_day: '',
  });
  const [holidayForm, setHolidayForm] = useState({
    title: '',
    holiday_date: '',
    holiday_type: 'holiday',
  });

  const classRows = useMemo(
    () =>
      classes.map((item) => ({
        ...item,
        section_count: sections.filter((section) => section.class_id === item.id).length,
      })),
    [classes, sections],
  );

  const activeAcademicYear = useMemo(
    () => academicYears.find((item) => item.is_active) ?? null,
    [academicYears],
  );

  const metrics = useMemo(
    () => [
      {
        label: 'Active Year',
        value: activeAcademicYear?.label ?? (school.academic_year_label || 'Not set'),
        detail: activeAcademicYear
          ? `${formatDate(activeAcademicYear.start_date)} to ${formatDate(activeAcademicYear.end_date)}`
          : 'Set an active academic year to align admissions and fees.',
        icon: CalendarRange,
      },
      {
        label: 'Classes',
        value: String(classes.length),
        detail: sections.length ? `${sections.length} sections configured` : 'No sections configured yet',
        icon: GraduationCap,
      },
      {
        label: 'Fee Plans',
        value: String(feeStructures.length),
        detail: feeStructures.length ? 'Billing structures ready for assignments' : 'No fee plans added yet',
        icon: Wallet,
      },
      {
        label: 'Holiday Dates',
        value: String(holidays.length),
        detail: holidays.length ? 'School calendar already has closure dates' : 'Holiday calendar is still empty',
        icon: CalendarDays,
      },
    ],
    [activeAcademicYear, classes.length, feeStructures.length, holidays.length, school.academic_year_label, sections.length],
  );

  useEffect(() => {
    void loadSetup();
  }, [school.id]);

  async function loadSetup() {
    setMessage(null);

    try {
      const [academicYearResponse, classResponse, sectionResponse, feeResponse, holidayResponse] = await Promise.all([
        supabase.from('academic_years').select('*').eq('school_id', school.id).order('start_date', { ascending: false }),
        supabase.from('classes').select('*').eq('school_id', school.id).order('name'),
        supabase.from('sections').select('*').eq('school_id', school.id).order('name'),
        supabase.from('fee_structures').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
        supabase.from('school_holidays').select('*').eq('school_id', school.id).order('holiday_date'),
      ]);

      setAcademicYears((academicYearResponse.data ?? []) as AcademicYear[]);
      setClasses((classResponse.data ?? []) as SchoolClass[]);
      setSections((sectionResponse.data ?? []) as Section[]);
      setFeeStructures((feeResponse.data ?? []) as FeeStructure[]);
      setHolidays((holidayResponse.data ?? []) as HolidayRecord[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function resetAcademicYearForm() {
    setEditingAcademicYearId(null);
    setAcademicYearForm({ label: '', start_date: '', end_date: '', is_active: true });
    setSetupModal(null);
  }

  function openCreateAcademicYear() {
    setEditingAcademicYearId(null);
    setAcademicYearForm({ label: '', start_date: '', end_date: '', is_active: true });
    setSetupModal('academicYear');
  }

  function openEditAcademicYear(academicYear: AcademicYear) {
    setEditingAcademicYearId(academicYear.id);
    setAcademicYearForm({
      label: academicYear.label,
      start_date: academicYear.start_date,
      end_date: academicYear.end_date,
      is_active: academicYear.is_active,
    });
    setSetupModal('academicYear');
  }

  function resetClassForm() {
    setEditingClassId(null);
    setClassForm({
      name: '',
      age_group: '',
      capacity: '',
      section_name: '',
      room_label: '',
      section_capacity: '',
    });
    setSetupModal(null);
  }

  function openCreateClass() {
    setEditingClassId(null);
    setClassForm({
      name: '',
      age_group: '',
      capacity: '',
      section_name: '',
      room_label: '',
      section_capacity: '',
    });
    setSetupModal('class');
  }

  function openEditClass(classRow: SchoolClass) {
    setEditingClassId(classRow.id);
    setClassForm({
      name: classRow.name,
      age_group: classRow.age_group ?? '',
      capacity: classRow.capacity ? String(classRow.capacity) : '',
      section_name: '',
      room_label: '',
      section_capacity: '',
    });
    setSetupModal('class');
  }

  function resetFeeForm() {
    setEditingFeeId(null);
    setFeeForm({ name: '', billing_cycle: 'monthly', total_amount: '', due_day: '' });
    setSetupModal(null);
  }

  function openCreateFee() {
    setEditingFeeId(null);
    setFeeForm({ name: '', billing_cycle: 'monthly', total_amount: '', due_day: '' });
    setSetupModal('fee');
  }

  function openEditFee(fee: FeeStructure) {
    setEditingFeeId(fee.id);
    setFeeForm({
      name: fee.name,
      billing_cycle: fee.billing_cycle,
      total_amount: String(fee.total_amount),
      due_day: fee.due_day ? String(fee.due_day) : '',
    });
    setSetupModal('fee');
  }

  function resetHolidayForm() {
    setEditingHolidayId(null);
    setHolidayForm({ title: '', holiday_date: '', holiday_type: 'holiday' });
    setSetupModal(null);
  }

  function openCreateHoliday() {
    setEditingHolidayId(null);
    setHolidayForm({ title: '', holiday_date: '', holiday_type: 'holiday' });
    setSetupModal('holiday');
  }

  function openEditHoliday(holiday: HolidayRecord) {
    setEditingHolidayId(holiday.id);
    setHolidayForm({
      title: holiday.title,
      holiday_date: holiday.holiday_date,
      holiday_type: holiday.holiday_type,
    });
    setSetupModal('holiday');
  }

  async function handleAcademicYearSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const payload = {
        school_id: school.id,
        label: academicYearForm.label,
        start_date: academicYearForm.start_date,
        end_date: academicYearForm.end_date,
        is_active: academicYearForm.is_active,
      };

      const { error } = editingAcademicYearId
        ? await supabase.from('academic_years').update(payload).eq('id', editingAcademicYearId)
        : await supabase.from('academic_years').insert(payload);

      if (error) throw error;
      resetAcademicYearForm();
      await loadSetup();
      setMessage(editingAcademicYearId ? 'Academic year updated.' : 'Academic year created.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleClassSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      if (editingClassId) {
        const { error } = await supabase
          .from('classes')
          .update({
            school_id: school.id,
            name: classForm.name,
            age_group: classForm.age_group || null,
            capacity: classForm.capacity ? Number(classForm.capacity) : null,
          })
          .eq('id', editingClassId);

        if (error) throw error;
        resetClassForm();
        await loadSetup();
        setMessage('Class updated.');
        return;
      }

      const { data: createdClass, error: classError } = await supabase
        .from('classes')
        .insert({
          school_id: school.id,
          name: classForm.name,
          age_group: classForm.age_group || null,
          capacity: classForm.capacity ? Number(classForm.capacity) : null,
        })
        .select('id')
        .single();

      if (classError) throw classError;

      if (classForm.section_name) {
        const { error: sectionError } = await supabase.from('sections').insert({
          school_id: school.id,
          class_id: createdClass.id,
          name: classForm.section_name,
          room_label: classForm.room_label || null,
          capacity: classForm.section_capacity ? Number(classForm.section_capacity) : null,
        });

        if (sectionError) throw sectionError;
      }

      resetClassForm();
      await loadSetup();
      setMessage('Class and optional section created.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleFeeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const payload = {
        school_id: school.id,
        name: feeForm.name,
        billing_cycle: feeForm.billing_cycle,
        total_amount: Number(feeForm.total_amount),
        due_day: feeForm.due_day ? Number(feeForm.due_day) : null,
        is_active: true,
      };

      const { error } = editingFeeId
        ? await supabase.from('fee_structures').update(payload).eq('id', editingFeeId)
        : await supabase.from('fee_structures').insert(payload);

      if (error) throw error;
      resetFeeForm();
      await loadSetup();
      setMessage(editingFeeId ? 'Fee structure updated.' : 'Fee structure added.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleHolidaySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const payload = {
        school_id: school.id,
        title: holidayForm.title,
        holiday_date: holidayForm.holiday_date,
        holiday_type: holidayForm.holiday_type,
      };

      const { error } = editingHolidayId
        ? await supabase.from('school_holidays').update(payload).eq('id', editingHolidayId)
        : await supabase.from('school_holidays').insert(payload);

      if (error) throw error;
      resetHolidayForm();
      await loadSetup();
      setMessage(editingHolidayId ? 'Holiday updated.' : 'Holiday added to the calendar.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteAcademicYear(academicYear: AcademicYear) {
    const confirmed = window.confirm(`Delete academic year ${academicYear.label}?`);

    if (!confirmed) return;

    setBusyDeleteId(academicYear.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('academic_years').delete().eq('id', academicYear.id);
      if (error) throw error;

      resetAcademicYearForm();
      await loadSetup();
      setMessage('Academic year deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  async function handleDeleteClass(classRow: SchoolClass) {
    const confirmed = window.confirm(`Delete class ${classRow.name}? This will also remove its sections.`);

    if (!confirmed) return;

    setBusyDeleteId(classRow.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('classes').delete().eq('id', classRow.id);
      if (error) throw error;

      resetClassForm();
      await loadSetup();
      setMessage('Class deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  async function handleDeleteFee(fee: FeeStructure) {
    const confirmed = window.confirm(`Delete fee structure ${fee.name}?`);

    if (!confirmed) return;

    setBusyDeleteId(fee.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('fee_structures').delete().eq('id', fee.id);
      if (error) throw error;

      resetFeeForm();
      await loadSetup();
      setMessage('Fee structure deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  async function handleDeleteHoliday(holiday: HolidayRecord) {
    const confirmed = window.confirm(`Delete holiday ${holiday.title}?`);

    if (!confirmed) return;

    setBusyDeleteId(holiday.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('school_holidays').delete().eq('id', holiday.id);
      if (error) throw error;

      resetHolidayForm();
      await loadSetup();
      setMessage('Holiday deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="School Setup"
        title="Configure the school foundation"
        description="Manage academic years, class structure, fee plans, and the holiday calendar from one clean operations setup page."
      />
      <ToastMessage message={message} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <SetupMetricCard key={metric.label} detail={metric.detail} icon={metric.icon} label={metric.label} value={metric.value} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Class directory"
          description="A quick overview of all configured classes, age groups, capacities, and section counts."
          action={
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{classRows.length} classes</span>
              <button className="button-primary gap-2 px-3 py-2 text-xs" onClick={openCreateClass} type="button">
                <Plus className="h-3.5 w-3.5" />
                Add class
              </button>
            </div>
          }
        >
          <DataTable
            columns={[
              { key: 'name', label: 'Class', render: (row) => <span className="font-bold">{row.name}</span> },
              { key: 'age_group', label: 'Age group', render: (row) => row.age_group ?? 'Not set' },
              { key: 'capacity', label: 'Capacity', render: (row) => row.capacity ?? 'Not set' },
              { key: 'sections', label: 'Sections', render: (row) => row.section_count ?? 0 },
              {
                key: 'action',
                label: 'Action',
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary px-3 py-2 text-xs" onClick={() => openEditClass(row)} type="button">
                      <PencilLine className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button className="button-danger px-3 py-2 text-xs" disabled={busyDeleteId === row.id} onClick={() => void handleDeleteClass(row)} type="button">
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {busyDeleteId === row.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ),
              },
            ]}
            emptyMessage="No classes added yet."
            rows={classRows}
          />
        </SectionCard>

        <SectionCard
          title="Holiday list"
          description="See the configured closure dates and the type of each calendar entry."
          action={
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{holidays.length} dates</span>
              <button className="button-primary gap-2 px-3 py-2 text-xs" onClick={openCreateHoliday} type="button">
                <Plus className="h-3.5 w-3.5" />
                Add holiday
              </button>
            </div>
          }
        >
          <DataTable
            columns={[
              { key: 'title', label: 'Title', render: (row) => <span className="font-bold">{row.title}</span> },
              { key: 'date', label: 'Date', render: (row) => formatDate(row.holiday_date) },
              { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.holiday_type} /> },
              {
                key: 'action',
                label: 'Action',
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary px-3 py-2 text-xs" onClick={() => openEditHoliday(row)} type="button">
                      <PencilLine className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button className="button-danger px-3 py-2 text-xs" disabled={busyDeleteId === row.id} onClick={() => void handleDeleteHoliday(row)} type="button">
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {busyDeleteId === row.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ),
              },
            ]}
            emptyMessage="No holidays configured."
            rows={holidays}
          />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="Academic year list"
          description="Track active and past school cycles with their date ranges."
          action={
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{academicYears.length} years</span>
              <button className="button-primary gap-2 px-3 py-2 text-xs" onClick={openCreateAcademicYear} type="button">
                <Plus className="h-3.5 w-3.5" />
                Add academic year
              </button>
            </div>
          }
        >
          <DataTable
            columns={[
              { key: 'label', label: 'Academic year', render: (row) => <span className="font-bold">{row.label}</span> },
              { key: 'range', label: 'Date range', render: (row) => `${formatDate(row.start_date)} - ${formatDate(row.end_date)}` },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.is_active ? 'active' : 'archived'} /> },
              {
                key: 'action',
                label: 'Action',
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary px-3 py-2 text-xs" onClick={() => openEditAcademicYear(row)} type="button">
                      <PencilLine className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button className="button-danger px-3 py-2 text-xs" disabled={busyDeleteId === row.id} onClick={() => void handleDeleteAcademicYear(row)} type="button">
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {busyDeleteId === row.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ),
              },
            ]}
            emptyMessage="No academic year added yet."
            rows={academicYears}
          />
        </SectionCard>

        <SectionCard
          title="Fee plans"
          description="Review the available billing plans, amounts, and due-day defaults."
          action={
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{feeStructures.length} plans</span>
              <button className="button-primary gap-2 px-3 py-2 text-xs" onClick={openCreateFee} type="button">
                <Plus className="h-3.5 w-3.5" />
                Add fee structure
              </button>
            </div>
          }
        >
          <DataTable
            columns={[
              { key: 'name', label: 'Plan', render: (row) => <span className="font-bold">{row.name}</span> },
              { key: 'billing_cycle', label: 'Billing cycle', render: (row) => <StatusBadge value={row.billing_cycle} /> },
              { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.total_amount) },
              { key: 'due_day', label: 'Due day', render: (row) => (row.due_day ? `Day ${row.due_day}` : 'Not set') },
              {
                key: 'action',
                label: 'Action',
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary px-3 py-2 text-xs" onClick={() => openEditFee(row)} type="button">
                      <PencilLine className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button className="button-danger px-3 py-2 text-xs" disabled={busyDeleteId === row.id} onClick={() => void handleDeleteFee(row)} type="button">
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {busyDeleteId === row.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ),
              },
            ]}
            emptyMessage="No fee structure defined yet."
            rows={feeStructures}
          />
        </SectionCard>
      </div>

      <Modal
        description="Manage the school year label, dates, and active status."
        onClose={resetAcademicYearForm}
        open={setupModal === 'academicYear'}
        title={editingAcademicYearId ? 'Edit academic year' : 'Add academic year'}
      >
        <form className="grid gap-4" onSubmit={handleAcademicYearSubmit}>
          <div>
            <label className="form-label">Label</label>
            <input className="form-input" onChange={(event) => setAcademicYearForm((current) => ({ ...current, label: event.target.value }))} placeholder="2026 - 2027" required value={academicYearForm.label} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Start date</label>
              <input className="form-input" onChange={(event) => setAcademicYearForm((current) => ({ ...current, start_date: event.target.value }))} required type="date" value={academicYearForm.start_date} />
            </div>
            <div>
              <label className="form-label">End date</label>
              <input className="form-input" onChange={(event) => setAcademicYearForm((current) => ({ ...current, end_date: event.target.value }))} required type="date" value={academicYearForm.end_date} />
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <input checked={academicYearForm.is_active} onChange={(event) => setAcademicYearForm((current) => ({ ...current, is_active: event.target.checked }))} type="checkbox" />
            Mark this academic year as active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button className="button-secondary" onClick={resetAcademicYearForm} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingAcademicYearId ? 'Save academic year' : 'Add academic year'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        description={editingClassId ? 'Update class name, age group, and capacity.' : 'Create a class and optionally add its first section.'}
        onClose={resetClassForm}
        open={setupModal === 'class'}
        title={editingClassId ? 'Edit class' : 'Add class'}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleClassSubmit}>
          <div>
            <label className="form-label">Class name</label>
            <input className="form-input" onChange={(event) => setClassForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nursery" required value={classForm.name} />
          </div>
          <div>
            <label className="form-label">Age group</label>
            <input className="form-input" onChange={(event) => setClassForm((current) => ({ ...current, age_group: event.target.value }))} placeholder="2 - 3 years" value={classForm.age_group} />
          </div>
          <div>
            <label className="form-label">Class capacity</label>
            <input className="form-input" onChange={(event) => setClassForm((current) => ({ ...current, capacity: event.target.value }))} type="number" value={classForm.capacity} />
          </div>
          {!editingClassId ? (
            <>
              <div>
                <label className="form-label">Section name</label>
                <input className="form-input" onChange={(event) => setClassForm((current) => ({ ...current, section_name: event.target.value }))} placeholder="A" value={classForm.section_name} />
              </div>
              <div>
                <label className="form-label">Room label</label>
                <input className="form-input" onChange={(event) => setClassForm((current) => ({ ...current, room_label: event.target.value }))} placeholder="Room 101" value={classForm.room_label} />
              </div>
              <div>
                <label className="form-label">Section capacity</label>
                <input className="form-input" onChange={(event) => setClassForm((current) => ({ ...current, section_capacity: event.target.value }))} type="number" value={classForm.section_capacity} />
              </div>
            </>
          ) : null}
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button className="button-secondary" onClick={resetClassForm} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingClassId ? 'Save class' : 'Add class'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        description="Manage recurring fee plan details and billing defaults."
        onClose={resetFeeForm}
        open={setupModal === 'fee'}
        title={editingFeeId ? 'Edit fee structure' : 'Add fee structure'}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleFeeSubmit}>
          <div>
            <label className="form-label">Plan name</label>
            <input className="form-input" onChange={(event) => setFeeForm((current) => ({ ...current, name: event.target.value }))} placeholder="Playgroup Monthly Fee" required value={feeForm.name} />
          </div>
          <div>
            <label className="form-label">Billing cycle</label>
            <select className="form-input" onChange={(event) => setFeeForm((current) => ({ ...current, billing_cycle: event.target.value }))} value={feeForm.billing_cycle}>
              <option value="monthly">Monthly</option>
              <option value="term">Term</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div>
            <label className="form-label">Total amount</label>
            <input className="form-input" onChange={(event) => setFeeForm((current) => ({ ...current, total_amount: event.target.value }))} required type="number" value={feeForm.total_amount} />
          </div>
          <div>
            <label className="form-label">Due day of month</label>
            <input className="form-input" max={31} min={1} onChange={(event) => setFeeForm((current) => ({ ...current, due_day: event.target.value }))} type="number" value={feeForm.due_day} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button className="button-secondary" onClick={resetFeeForm} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingFeeId ? 'Save fee structure' : 'Add fee structure'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        description="Manage holiday, closure, and special event calendar dates."
        onClose={resetHolidayForm}
        open={setupModal === 'holiday'}
        title={editingHolidayId ? 'Edit holiday' : 'Add holiday'}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleHolidaySubmit}>
          <div>
            <label className="form-label">Holiday title</label>
            <input className="form-input" onChange={(event) => setHolidayForm((current) => ({ ...current, title: event.target.value }))} required value={holidayForm.title} />
          </div>
          <div>
            <label className="form-label">Date</label>
            <input className="form-input" onChange={(event) => setHolidayForm((current) => ({ ...current, holiday_date: event.target.value }))} required type="date" value={holidayForm.holiday_date} />
          </div>
          <div>
            <label className="form-label">Type</label>
            <select className="form-input" onChange={(event) => setHolidayForm((current) => ({ ...current, holiday_type: event.target.value }))} value={holidayForm.holiday_type}>
              <option value="holiday">Holiday</option>
              <option value="exam_break">Exam break</option>
              <option value="special_event">Special event</option>
            </select>
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button className="button-secondary" onClick={resetHolidayForm} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingHolidayId ? 'Save holiday' : 'Add holiday'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
