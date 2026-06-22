import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Search, UserRound, Users } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { StaffAttendanceRecord, StaffRecord, StudentAttendanceRecord, StudentRecord } from '../../types/app';

const today = new Date().toISOString().slice(0, 10);
const PAGE_SIZE = 10;

const studentAttendanceSeed = {
  student_id: '',
  attendance_date: today,
  status: 'present',
  late_minutes: '',
  note: '',
};

const staffAttendanceSeed = {
  staff_id: '',
  attendance_date: today,
  status: 'present',
  late_minutes: '',
  note: '',
};

export function AttendancePage() {
  const { school } = useAppContext();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<StudentAttendanceRecord[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendanceRecord[]>([]);
  const [studentForm, setStudentForm] = useState(studentAttendanceSeed);
  const [staffForm, setStaffForm] = useState(staffAttendanceSeed);
  const [studentNameFilter, setStudentNameFilter] = useState('');
  const [studentDateFilter, setStudentDateFilter] = useState('');
  const [studentPage, setStudentPage] = useState(1);
  const [staffNameFilter, setStaffNameFilter] = useState('');
  const [staffDateFilter, setStaffDateFilter] = useState('');
  const [staffPage, setStaffPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAttendance();
  }, [school.id]);

  async function loadAttendance() {
    setMessage(null);

    try {
      const [studentResponse, staffResponse, studentAttendanceResponse, staffAttendanceResponse] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', school.id).eq('is_active', true).order('first_name'),
        supabase.from('staff').select('*').eq('school_id', school.id).eq('is_active', true).order('full_name'),
        supabase.from('student_attendance').select('*').eq('school_id', school.id).order('attendance_date', { ascending: false }).limit(500),
        supabase.from('staff_attendance').select('*').eq('school_id', school.id).order('attendance_date', { ascending: false }).limit(500),
      ]);

      if (studentResponse.error) throw studentResponse.error;
      if (staffResponse.error) throw staffResponse.error;
      if (studentAttendanceResponse.error) throw studentAttendanceResponse.error;
      if (staffAttendanceResponse.error) throw staffAttendanceResponse.error;

      setStudents((studentResponse.data ?? []) as StudentRecord[]);
      setStaff((staffResponse.data ?? []) as StaffRecord[]);
      setStudentAttendance((studentAttendanceResponse.data ?? []) as StudentAttendanceRecord[]);
      setStaffAttendance((staffAttendanceResponse.data ?? []) as StaffAttendanceRecord[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleStudentAttendanceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const { error } = await supabase.from('student_attendance').upsert({
        school_id: school.id,
        student_id: studentForm.student_id,
        attendance_date: studentForm.attendance_date,
        status: studentForm.status,
        late_minutes: studentForm.late_minutes ? Number(studentForm.late_minutes) : null,
        note: studentForm.note || null,
      });

      if (error) throw error;
      setStudentForm(studentAttendanceSeed);
      await loadAttendance();
      setMessage('Student attendance saved.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleStaffAttendanceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const { error } = await supabase.from('staff_attendance').upsert({
        school_id: school.id,
        staff_id: staffForm.staff_id,
        attendance_date: staffForm.attendance_date,
        status: staffForm.status,
        late_minutes: staffForm.late_minutes ? Number(staffForm.late_minutes) : null,
        note: staffForm.note || null,
      });

      if (error) throw error;
      setStaffForm(staffAttendanceSeed);
      await loadAttendance();
      setMessage('Staff attendance saved.');
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

  const staffLookup = useMemo(
    () =>
      staff.reduce<Record<string, string>>((accumulator, member) => {
        accumulator[member.id] = member.full_name;
        return accumulator;
      }, {}),
    [staff],
  );

  const todayStudentCount = studentAttendance.filter((item) => item.attendance_date === today).length;
  const todayAbsentCount = studentAttendance.filter((item) => item.attendance_date === today && item.status === 'absent').length;
  const todayStaffCount = staffAttendance.filter((item) => item.attendance_date === today).length;
  const filteredStudentAttendance = useMemo(() => {
    const normalizedName = studentNameFilter.trim().toLowerCase();
    return studentAttendance.filter((record) => {
      const nameMatches = !normalizedName || (studentLookup[record.student_id] ?? '').toLowerCase().includes(normalizedName);
      const dateMatches = !studentDateFilter || record.attendance_date === studentDateFilter;
      return nameMatches && dateMatches;
    });
  }, [studentAttendance, studentLookup, studentNameFilter, studentDateFilter]);
  const filteredStaffAttendance = useMemo(() => {
    const normalizedName = staffNameFilter.trim().toLowerCase();
    return staffAttendance.filter((record) => {
      const nameMatches = !normalizedName || (staffLookup[record.staff_id] ?? '').toLowerCase().includes(normalizedName);
      const dateMatches = !staffDateFilter || record.attendance_date === staffDateFilter;
      return nameMatches && dateMatches;
    });
  }, [staffAttendance, staffLookup, staffNameFilter, staffDateFilter]);
  const studentPageCount = Math.max(1, Math.ceil(filteredStudentAttendance.length / PAGE_SIZE));
  const staffPageCount = Math.max(1, Math.ceil(filteredStaffAttendance.length / PAGE_SIZE));
  const visibleStudentAttendance = filteredStudentAttendance.slice((studentPage - 1) * PAGE_SIZE, studentPage * PAGE_SIZE);
  const visibleStaffAttendance = filteredStaffAttendance.slice((staffPage - 1) * PAGE_SIZE, staffPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Attendance"
        title="Student and staff attendance control"
        description="Mark present, absent, half-day and late arrivals, then keep a day-wise record for reporting and parent alerts."
      />

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Users} label="Student attendance today" meta="Entries saved" value={todayStudentCount} />
        <StatCard icon={Clock3} label="Absent students" meta="Needs follow-up" tone="amber" value={todayAbsentCount} />
        <StatCard icon={UserRound} label="Staff attendance today" meta="Entries saved" tone="teal" value={todayStaffCount} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Mark student attendance" description="Capture daily student attendance and late arrivals.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleStudentAttendanceSubmit}>
            <div className="md:col-span-2">
              <label className="form-label">Student</label>
              <select className="form-input" onChange={(event) => setStudentForm((current) => ({ ...current, student_id: event.target.value }))} value={studentForm.student_id}>
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
              <input className="form-input" onChange={(event) => setStudentForm((current) => ({ ...current, attendance_date: event.target.value }))} type="date" value={studentForm.attendance_date} />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" onChange={(event) => setStudentForm((current) => ({ ...current, status: event.target.value }))} value={studentForm.status}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="half_day">Half day</option>
              </select>
            </div>
            <div>
              <label className="form-label">Late minutes</label>
              <input className="form-input" onChange={(event) => setStudentForm((current) => ({ ...current, late_minutes: event.target.value }))} type="number" value={studentForm.late_minutes} />
            </div>
            <div>
              <label className="form-label">Note</label>
              <input className="form-input" onChange={(event) => setStudentForm((current) => ({ ...current, note: event.target.value }))} value={studentForm.note} />
            </div>
            <div className="md:col-span-2">
              <button className="button-primary" type="submit">
                Save student attendance
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Mark staff attendance" description="Record daily staff attendance for operational oversight.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleStaffAttendanceSubmit}>
            <div className="md:col-span-2">
              <label className="form-label">Staff member</label>
              <select className="form-input" onChange={(event) => setStaffForm((current) => ({ ...current, staff_id: event.target.value }))} value={staffForm.staff_id}>
                <option value="">Select staff member</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Date</label>
              <input className="form-input" onChange={(event) => setStaffForm((current) => ({ ...current, attendance_date: event.target.value }))} type="date" value={staffForm.attendance_date} />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" onChange={(event) => setStaffForm((current) => ({ ...current, status: event.target.value }))} value={staffForm.status}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="half_day">Half day</option>
              </select>
            </div>
            <div>
              <label className="form-label">Late minutes</label>
              <input className="form-input" onChange={(event) => setStaffForm((current) => ({ ...current, late_minutes: event.target.value }))} type="number" value={staffForm.late_minutes} />
            </div>
            <div>
              <label className="form-label">Note</label>
              <input className="form-input" onChange={(event) => setStaffForm((current) => ({ ...current, note: event.target.value }))} value={staffForm.note} />
            </div>
            <div className="md:col-span-2">
              <button className="button-primary" type="submit">
                Save staff attendance
              </button>
            </div>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Student attendance log" description="Recent attendance entries across the school.">
          <AttendanceFilters
            date={studentDateFilter}
            name={studentNameFilter}
            onDateChange={(value) => { setStudentDateFilter(value); setStudentPage(1); }}
            onNameChange={(value) => { setStudentNameFilter(value); setStudentPage(1); }}
            placeholder="Filter by student name"
          />
          <div className="mt-4 h-[590px] overflow-auto rounded-[1.5rem] bg-white">
            <DataTable
              columns={[
                { key: 'student', label: 'Student', render: (row) => studentLookup[row.student_id] ?? 'Unknown student' },
                { key: 'date', label: 'Date', render: (row) => formatDate(row.attendance_date) },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                { key: 'late', label: 'Late', render: (row) => (row.late_minutes ? `${row.late_minutes} min` : '-') },
                { key: 'note', label: 'Note', render: (row) => row.note ?? '-' },
              ]}
              emptyMessage="No student attendance matches these filters."
              rows={visibleStudentAttendance}
            />
          </div>
          <PaginationControls currentPage={studentPage} onPageChange={setStudentPage} pageCount={studentPageCount} total={filteredStudentAttendance.length} />
        </SectionCard>

        <SectionCard title="Staff attendance log" description="Recent team attendance entries.">
          <AttendanceFilters
            date={staffDateFilter}
            name={staffNameFilter}
            onDateChange={(value) => { setStaffDateFilter(value); setStaffPage(1); }}
            onNameChange={(value) => { setStaffNameFilter(value); setStaffPage(1); }}
            placeholder="Filter by staff name"
          />
          <div className="mt-4 h-[590px] overflow-auto rounded-[1.5rem] bg-white">
            <DataTable
              columns={[
                { key: 'staff', label: 'Staff', render: (row) => staffLookup[row.staff_id] ?? 'Unknown staff' },
                { key: 'date', label: 'Date', render: (row) => formatDate(row.attendance_date) },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                { key: 'late', label: 'Late', render: (row) => (row.late_minutes ? `${row.late_minutes} min` : '-') },
                { key: 'note', label: 'Note', render: (row) => row.note ?? '-' },
              ]}
              emptyMessage="No staff attendance matches these filters."
              rows={visibleStaffAttendance}
            />
          </div>
          <PaginationControls currentPage={staffPage} onPageChange={setStaffPage} pageCount={staffPageCount} total={filteredStaffAttendance.length} />
        </SectionCard>
      </div>
    </div>
  );
}

interface AttendanceFiltersProps {
  name: string;
  date: string;
  placeholder: string;
  onNameChange: (value: string) => void;
  onDateChange: (value: string) => void;
}

function AttendanceFilters({ name, date, placeholder, onNameChange, onDateChange }: AttendanceFiltersProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
      <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label={placeholder} className="form-input pl-11" onChange={(event) => onNameChange(event.target.value)} placeholder={placeholder} value={name} /></div>
      <input aria-label="Filter by date" className="form-input" onChange={(event) => onDateChange(event.target.value)} type="date" value={date} />
      <button className="button-secondary px-3" disabled={!name && !date} onClick={() => { onNameChange(''); onDateChange(''); }} type="button">Clear</button>
    </div>
  );
}

function PaginationControls({ currentPage, pageCount, total, onPageChange }: { currentPage: number; pageCount: number; total: number; onPageChange: (page: number) => void }) {
  const firstRow = total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(currentPage * PAGE_SIZE, total);
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">Showing {firstRow}-{lastRow} of {total}</p>
      <div className="flex items-center gap-2"><button aria-label="Previous page" className="button-secondary px-3 py-2" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} type="button"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-20 text-center text-sm font-semibold text-slate-600">Page {currentPage} of {pageCount}</span><button aria-label="Next page" className="button-secondary px-3 py-2" disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)} type="button"><ChevronRight className="h-4 w-4" /></button></div>
    </div>
  );
}
