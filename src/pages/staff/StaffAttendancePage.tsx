import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { buildStudentNameMap } from '../../lib/portal-data';
import { useStaffPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { StaffRequest, StudentAttendanceRecord } from '../../types/app';

const today = new Date().toISOString().slice(0, 10);

export function StaffAttendancePage() {
  const { school } = useAppContext();
  const { staffRecord, students, message } = useStaffPortal();
  const [attendance, setAttendance] = useState<StudentAttendanceRecord[]>([]);
  const [form, setForm] = useState({
    student_id: '',
    attendance_date: today,
    status: 'present',
    late_minutes: '',
    note: '',
  });
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<StaffRequest | null>(null);

  const studentNameMap = useMemo(() => buildStudentNameMap(students), [students]);

  useEffect(() => {
    if (!students.length) return;
    void loadAttendance();
  }, [students.map((student) => student.id).join('|')]);

  async function loadAttendance() {
    try {
      const { data, error } = await supabase
        .from('student_attendance')
        .select('*')
        .in('student_id', students.map((student) => student.id))
        .order('attendance_date', { ascending: false })
        .limit(40);

      if (error) throw error;
      setAttendance((data ?? []) as StudentAttendanceRecord[]);
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitMessage(null);

    try {
      const { error } = await supabase.from('student_attendance').upsert({
        school_id: school.id,
        student_id: form.student_id,
        attendance_date: form.attendance_date,
        status: form.status,
        late_minutes: form.late_minutes ? Number(form.late_minutes) : null,
        note: form.note || null,
      });

      if (error) throw error;
      setForm({ student_id: '', attendance_date: today, status: 'present', late_minutes: '', note: '' });
      await loadAttendance();
      setSubmitMessage('Attendance saved.');
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  async function submitToAdmin() {
    if (!staffRecord) return;

    try {
      const { data, error } = await supabase
        .from('staff_requests')
        .insert({
          school_id: school.id,
          staff_id: staffRecord.id,
          category: 'attendance_submission',
          title: `Attendance submitted for ${today}`,
          message: 'Attendance has been completed and is ready for admin review.',
          status: 'submitted',
          priority: 'normal',
        })
        .select('*')
        .single();

      if (error) throw error;
      setRequestStatus(data as StaffRequest);
      setSubmitMessage('Attendance submission sent to admin.');
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Attendance"
        title="Mark and submit attendance"
        description="Update present, absent, half-day and late arrival status for your assigned students and send completion to admin."
        actions={
          <button className="button-secondary" onClick={() => void submitToAdmin()} type="button">
            Submit attendance to admin
          </button>
        }
      />

      {message || submitMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || submitMessage}</div>
      ) : null}

      {requestStatus ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Last submission status: <StatusBadge value={requestStatus.status} />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Mark attendance" description="Save daily attendance with late notes where needed.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="md:col-span-2">
              <label className="form-label">Student</label>
              <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, student_id: event.target.value }))} value={form.student_id}>
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.first_name} {student.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Date</label>
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, attendance_date: event.target.value }))} type="date" value={form.attendance_date} />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} value={form.status}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half-day</option>
                <option value="late">Late</option>
              </select>
            </div>
            <div>
              <label className="form-label">Late minutes</label>
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, late_minutes: event.target.value }))} type="number" value={form.late_minutes} />
            </div>
            <div>
              <label className="form-label">Late/absence note</label>
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} value={form.note} />
            </div>
            <div className="md:col-span-2">
              <button className="button-primary" type="submit">Save attendance</button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Attendance history" description="Recent attendance entries for your assigned students.">
          <DataTable
            columns={[
              { key: 'student', label: 'Student', render: (row) => studentNameMap[row.student_id] ?? 'Unknown student' },
              { key: 'date', label: 'Date', render: (row) => formatDate(row.attendance_date) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              { key: 'late', label: 'Late', render: (row) => (row.late_minutes ? `${row.late_minutes} min` : '-') },
              { key: 'note', label: 'Note', render: (row) => row.note ?? '-' },
            ]}
            emptyMessage="No attendance entries yet."
            rows={attendance}
          />
        </SectionCard>
      </div>
    </div>
  );
}
