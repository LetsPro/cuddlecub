import { useEffect, useMemo, useState } from 'react';
import { Bell, BookOpenText, Cake, Clock3, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ClassSelector } from '../../components/ClassSelector';
import { CelebrationHighlights } from '../../components/CelebrationHighlights';
import { ThemedLoader } from '../../components/ThemedLoader';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { filterVisibleNotifications } from '../../lib/notifications';
import { useClassFilter, useStaffPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { daysUntil, formatDate, formatDateTime } from '../../lib/utils';
import type { NotificationRecord, TimetableEntry } from '../../types/app';

interface BirthdayItem {
  id: string;
  name: string;
  dob: string;
  classId: string | null;
}

export function StaffDashboardPage() {
  const { school } = useAppContext();
  const { staffRecord, students, loading, message } = useStaffPortal();
  const { availableClasses, selectedClassId, setSelectedClassId, filteredStudents, studentCounts } =
    useClassFilter(students, staffRecord?.assigned_class_ids?.[0] ?? staffRecord?.class_teacher_for);

  const [attendedIds, setAttendedIds] = useState<string[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [allBirthdays, setAllBirthdays] = useState<BirthdayItem[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!staffRecord) return;
    void loadDashboard();
  }, [staffRecord?.id, school.id, students.map((s) => s.id).join('|')]);

  async function loadDashboard() {
    if (!staffRecord) return;
    setLoadMessage(null);

    try {
      const studentIdList = students.map((s) => s.id);
      const assignedClassIds = staffRecord.assigned_class_ids ?? (staffRecord.class_teacher_for ? [staffRecord.class_teacher_for] : []);
      const timetableQuery = supabase.from('timetable_entries').select('*').eq('school_id', school.id).order('weekday').order('start_time').limit(10);
      const assignedTimetableQuery = assignedClassIds.length ? timetableQuery.in('class_id', assignedClassIds) : timetableQuery;

      const [attendanceRes, activityRes, notificationRes, timetableRes, birthdayRes] = await Promise.all([
        studentIdList.length
          ? supabase.from('student_attendance').select('student_id').in('student_id', studentIdList).eq('attendance_date', today)
          : Promise.resolve({ data: [], error: null }),
        studentIdList.length
          ? supabase.from('daily_activity_logs').select('student_id').in('student_id', studentIdList).eq('activity_date', today)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('notifications').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(30),
        assignedTimetableQuery,
        studentIdList.length
          ? supabase.from('students').select('id, first_name, last_name, dob, class_id').in('id', studentIdList)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (attendanceRes.error) throw attendanceRes.error;
      if (activityRes.error) throw activityRes.error;
      if (notificationRes.error) throw notificationRes.error;
      if (timetableRes.error) throw timetableRes.error;
      if (birthdayRes.error) throw birthdayRes.error;

      setAttendedIds(((attendanceRes.data ?? []) as Array<{ student_id: string }>).map((r) => r.student_id));
      setActiveIds(((activityRes.data ?? []) as Array<{ student_id: string }>).map((r) => r.student_id));
      setNotifications(filterVisibleNotifications((notificationRes.data ?? []) as NotificationRecord[], 5));
      setTimetableEntries((timetableRes.data ?? []) as TimetableEntry[]);
      setAllBirthdays(
        ((birthdayRes.data ?? []) as Array<{ id: string; first_name: string; last_name: string; dob: string; class_id: string | null }>).map(
          (s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}`, dob: s.dob, classId: s.class_id }),
        ),
      );
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  const filteredStudentIdSet = useMemo(() => new Set(filteredStudents.map((s) => s.id)), [filteredStudents]);

  const pendingAttendance = useMemo(
    () => Math.max(filteredStudents.length - attendedIds.filter((id) => filteredStudentIdSet.has(id)).length, 0),
    [filteredStudents, attendedIds, filteredStudentIdSet],
  );

  const pendingActivities = useMemo(
    () => Math.max(filteredStudents.length - activeIds.filter((id) => filteredStudentIdSet.has(id)).length, 0),
    [filteredStudents, activeIds, filteredStudentIdSet],
  );

  const upcomingBirthdays = useMemo(
    () =>
      allBirthdays
        .filter((b) => filteredStudentIdSet.has(b.id))
        .sort((a, b) => daysUntil(a.dob) - daysUntil(b.dob))
        .slice(0, 5),
    [allBirthdays, filteredStudentIdSet],
  );

  const filteredTimetable = useMemo(
    () => (selectedClassId ? timetableEntries.filter((e) => e.class_id === selectedClassId) : timetableEntries),
    [timetableEntries, selectedClassId],
  );

  if (loading) {
    return (
      <SectionCard title="Staff dashboard" description="Loading your class overview.">
        <ThemedLoader description="Preparing the latest classroom overview and assigned student data." label="Loading dashboard..." size="sm" />
      </SectionCard>
    );
  }

  if (!staffRecord) {
    return (
      <SectionCard title="Staff access pending" description="Your sign-in email must match a staff record created by admin.">
        <p className="text-sm text-slate-500">No linked staff record was found for this school account.</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Staff Dashboard"
        title={`Welcome, ${staffRecord.full_name.split(' ')[0]}`}
        description="Track attendance, daily care updates, notices and your assigned classroom from one staff workspace."
        actions={
          <>
            <Link className="button-secondary" to="/staff/attendance">Mark attendance</Link>
            <Link className="button-secondary" to="/staff/daily-activity">Add daily update</Link>
            <Link className="button-secondary" to="/staff/students">Open students</Link>
          </>
        }
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <CelebrationHighlights />

      <ClassSelector
        classes={availableClasses}
        counts={studentCounts}
        onChange={setSelectedClassId}
        selectedClassId={selectedClassId}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Students in class" value={filteredStudents.length} meta="Selected class roster" />
        <StatCard icon={Bell} label="Attendance pending" tone="amber" value={pendingAttendance} meta="Still to mark today" />
        <StatCard icon={BookOpenText} label="Activities pending" tone="teal" value={pendingActivities} meta="Students without updates" />
        <StatCard icon={Clock3} label="Timetable slots" tone="slate" value={filteredTimetable.length} meta="Class schedule items" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Class roster" description="Students assigned to the selected class.">
          <div className="grid gap-3 md:grid-cols-2">
            {filteredStudents.slice(0, 8).map((student) => (
              <div key={student.id} className="rounded-xl border border-slate-100 bg-white p-4">
                <p className="font-bold text-slate-900">{student.first_name} {student.last_name}</p>
                <p className="mt-1 text-sm text-slate-500">{student.class_name ?? 'Unassigned'}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">{student.admission_number}</p>
              </div>
            ))}
            {filteredStudents.length > 8 && (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 p-4">
                <Link className="text-sm font-semibold theme-text-primary" to="/staff/students">
                  +{filteredStudents.length - 8} more students
                </Link>
              </div>
            )}
            {filteredStudents.length === 0 ? <p className="text-sm text-slate-500">No students found for this class.</p> : null}
          </div>
        </SectionCard>

        <SectionCard title="Upcoming birthdays" description="Students in the selected class with birthdays coming up.">
          <div className="space-y-3">
            {upcomingBirthdays.length === 0 ? (
              <p className="text-sm text-slate-500">No birthdays found.</p>
            ) : (
              upcomingBirthdays.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">{formatDate(item.dob)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                    <Cake className="h-4 w-4" />
                    {daysUntil(item.dob)} day{daysUntil(item.dob) === 1 ? '' : 's'}
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Notices from admin" description="Recent admin communication relevant to your school.">
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">No notices available.</p>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900">{notification.title}</p>
                      <p className="mt-2 text-sm text-slate-500">{notification.message}</p>
                    </div>
                    <StatusBadge value={notification.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Timetable view" description="Class schedule for the selected class.">
          <div className="space-y-3">
            {filteredTimetable.length === 0 ? (
              <p className="text-sm text-slate-500">No timetable entries for this class yet.</p>
            ) : (
              filteredTimetable.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900">{entry.title}</p>
                      <p className="text-sm text-slate-500">{entry.weekday} · {entry.start_time} – {entry.end_time}</p>
                    </div>
                    <StatusBadge value={entry.category ?? 'class'} />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
