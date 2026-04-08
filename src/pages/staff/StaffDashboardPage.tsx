import { useEffect, useMemo, useState } from 'react';
import { Bell, BookOpenText, Cake, Clock3, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemedLoader } from '../../components/ThemedLoader';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { useStaffPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { daysUntil, formatDate, formatDateTime } from '../../lib/utils';
import type { NotificationRecord, TimetableEntry } from '../../types/app';

interface BirthdayItem {
  id: string;
  name: string;
  dob: string;
}

export function StaffDashboardPage() {
  const { school } = useAppContext();
  const { staffRecord, students, loading, message } = useStaffPortal();
  const [todayAttendanceCount, setTodayAttendanceCount] = useState(0);
  const [todayActivityCount, setTodayActivityCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayItem[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  const studentIds = useMemo(() => students.map((student) => student.id), [students]);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!staffRecord) return;
    void loadDashboard();
  }, [staffRecord?.id, school.id, studentIds.join('|')]);

  async function loadDashboard() {
    if (!staffRecord) return;
    setLoadMessage(null);

    try {
      const studentIdList = studentIds;
      const [
        studentAttendanceResponse,
        activityResponse,
        notificationResponse,
        timetableResponse,
        studentBirthdaysResponse,
      ] = await Promise.all([
        studentIdList.length
          ? supabase.from('student_attendance').select('student_id').in('student_id', studentIdList).eq('attendance_date', today)
          : Promise.resolve({ data: [], error: null }),
        studentIdList.length
          ? supabase.from('daily_activity_logs').select('student_id').in('student_id', studentIdList).eq('activity_date', today)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('notifications').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(5),
        staffRecord.class_teacher_for
          ? supabase.from('timetable_entries').select('*').eq('school_id', school.id).eq('class_id', staffRecord.class_teacher_for).order('weekday').order('start_time').limit(6)
          : supabase.from('timetable_entries').select('*').eq('school_id', school.id).order('weekday').order('start_time').limit(6),
        studentIdList.length ? supabase.from('students').select('id, first_name, last_name, dob').in('id', studentIdList) : Promise.resolve({ data: [], error: null }),
      ]);

      if (studentAttendanceResponse.error) throw studentAttendanceResponse.error;
      if (activityResponse.error) throw activityResponse.error;
      if (notificationResponse.error) throw notificationResponse.error;
      if (timetableResponse.error) throw timetableResponse.error;
      if (studentBirthdaysResponse.error) throw studentBirthdaysResponse.error;

      setTodayAttendanceCount((studentAttendanceResponse.data ?? []).length);
      setTodayActivityCount((activityResponse.data ?? []).length);
      setNotifications((notificationResponse.data ?? []) as NotificationRecord[]);
      setTimetableEntries((timetableResponse.data ?? []) as TimetableEntry[]);
      setBirthdays(
        ((studentBirthdaysResponse.data ?? []) as Array<{ id: string; first_name: string; last_name: string; dob: string }>)
          .map((student) => ({ id: student.id, name: `${student.first_name} ${student.last_name}`, dob: student.dob }))
          .sort((left, right) => daysUntil(left.dob) - daysUntil(right.dob))
          .slice(0, 5),
      );
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

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

  const pendingAttendance = Math.max(students.length - todayAttendanceCount, 0);
  const pendingActivities = Math.max(students.length - todayActivityCount, 0);

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Assigned students" value={students.length} meta="Your quick roster" />
        <StatCard icon={Bell} label="Attendance pending" tone="amber" value={pendingAttendance} meta="Still to mark today" />
        <StatCard icon={BookOpenText} label="Daily activities pending" tone="teal" value={pendingActivities} meta="Students without updates" />
        <StatCard icon={Clock3} label="Timetable items" tone="slate" value={timetableEntries.length} meta="Upcoming class slots" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Assigned class overview" description="The students currently visible inside your workspace.">
          <div className="grid gap-3 sm:grid-cols-2">
            {students.slice(0, 6).map((student) => (
              <div key={student.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="font-bold text-slate-900">{student.first_name} {student.last_name}</p>
                <p className="mt-1 text-sm text-slate-500">{student.class_name ?? 'Unassigned'} · {student.section_name ?? 'No section'}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">{student.admission_number}</p>
              </div>
            ))}
            {students.length === 0 ? <p className="text-sm text-slate-500">No assigned students found.</p> : null}
          </div>
        </SectionCard>

        <SectionCard title="Upcoming birthdays" description="Students in your view with birthdays coming up.">
          <div className="space-y-3">
            {birthdays.length === 0 ? (
              <p className="text-sm text-slate-500">No birthdays found.</p>
            ) : (
              birthdays.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
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

      <div className="grid gap-6 lg:grid-cols-2">
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

        <SectionCard title="Timetable view" description="Your current class timetable snapshot.">
          <div className="space-y-3">
            {timetableEntries.length === 0 ? (
              <p className="text-sm text-slate-500">No timetable entries mapped to your class yet.</p>
            ) : (
              timetableEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900">{entry.title}</p>
                      <p className="text-sm text-slate-500">{entry.weekday} · {entry.start_time} - {entry.end_time}</p>
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
