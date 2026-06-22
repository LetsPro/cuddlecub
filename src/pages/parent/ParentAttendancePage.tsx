import { useEffect, useState } from 'react';
import { Bell, CalendarDays, Clock3 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useParentPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { StudentAttendanceRecord } from '../../types/app';

export function ParentAttendancePage() {
  const { students, message } = useParentPortal();
  const [records, setRecords] = useState<StudentAttendanceRecord[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!students.length) return;
    setSelectedStudentId((current) => current || students[0].id);
    void loadAttendance();
  }, [students.map((student) => student.id).join('|')]);

  async function loadAttendance() {
    setLoadMessage(null);
    try {
      const { data, error } = await supabase
        .from('student_attendance')
        .select('*')
        .in('student_id', students.map((student) => student.id))
        .order('attendance_date', { ascending: false })
        .limit(90);

      if (error) throw error;
      setRecords((data ?? []) as StudentAttendanceRecord[]);
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  const filtered = selectedStudentId ? records.filter((record) => record.student_id === selectedStudentId) : records;
  const absentCount = filtered.filter((record) => record.status === 'absent').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Attendance"
        title="Daily and monthly attendance history"
        description="Check daily attendance status, recent history and absence-related updates for your child."
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={CalendarDays} label="Attendance entries" value={filtered.length} meta="Recent history" />
        <StatCard icon={Bell} label="Absence alerts" tone="amber" value={absentCount} meta="Recent absences" />
        <StatCard icon={Clock3} label="Latest status" tone="teal" value={filtered[0]?.status ?? 'pending'} meta="Most recent day" />
      </div>

      <SectionCard title="Select child" description="Switch between linked children.">
        <select className="form-input max-w-sm" onChange={(event) => setSelectedStudentId(event.target.value)} value={selectedStudentId}>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.first_name} {student.last_name}
            </option>
          ))}
        </select>
      </SectionCard>

      <SectionCard title="Attendance history" description="Recent daily attendance records for the selected child.">
        <div className="space-y-3">
          {filtered.map((record) => (
            <article className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between" key={record.id}>
              <div><p className="font-bold text-slate-900">{formatDate(record.attendance_date)}</p><p className="mt-1 text-sm text-slate-500">{record.note || (record.late_minutes ? `Late by ${record.late_minutes} minutes` : 'No note')}</p></div>
              <StatusBadge value={record.status} />
            </article>
          ))}
          {!filtered.length ? <p className="text-sm text-slate-500">No attendance records found.</p> : null}
        </div>
      </SectionCard>
    </div>
  );
}
