import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, GraduationCap, Megaphone, UserRound, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { daysUntil, formatDate, formatDateTime } from '../../lib/utils';
import type { DashboardMetrics } from '../../types/app';

interface BirthdayItem {
  name: string;
  audience: string;
  dob: string;
}

interface EventItem {
  id: string;
  title: string;
  start_at: string;
  event_type: string;
}

interface NotificationItem {
  id: string;
  title: string;
  channel: string;
  status: string;
  sent_at: string | null;
  scheduled_at: string | null;
}

const initialMetrics: DashboardMetrics = {
  totalStudents: 0,
  totalStaff: 0,
  totalParents: 0,
  todayStudentAttendance: 0,
  todayStaffAttendance: 0,
  pendingInvoices: 0,
  activityUpdates: 0,
};

const quickActions = [
  { label: 'Add student', to: '/students' },
  { label: 'Add teacher', to: '/staff' },
  { label: 'Add parent', to: '/parents' },
  { label: 'Send notice', to: '/communication' },
];

export function DashboardPage() {
  const { school } = useAppContext();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [birthdays, setBirthdays] = useState<BirthdayItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, [school.id]);

  async function loadDashboard() {
    setMessage(null);
    const today = new Date().toISOString().slice(0, 10);

    try {
      const [
        studentsCount,
        staffCount,
        parentsCount,
        studentAttendanceCount,
        staffAttendanceCount,
        pendingInvoiceCount,
        activityCount,
        studentBirthdays,
        staffBirthdays,
        upcomingEvents,
        recentNotifications,
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', school.id).eq('is_active', true),
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('school_id', school.id).eq('is_active', true),
        supabase.from('parents').select('*', { count: 'exact', head: true }).eq('school_id', school.id).eq('is_active', true),
        supabase
          .from('student_attendance')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('attendance_date', today),
        supabase
          .from('staff_attendance')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('attendance_date', today),
        supabase
          .from('fee_invoices')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .in('status', ['pending', 'partially_paid']),
        supabase
          .from('daily_activity_logs')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('activity_date', today),
        supabase.from('students').select('first_name, last_name, dob').eq('school_id', school.id).eq('is_active', true).limit(30),
        supabase.from('staff').select('full_name, dob').eq('school_id', school.id).eq('is_active', true).limit(20),
        supabase.from('events').select('id, title, start_at, event_type').eq('school_id', school.id).gte('start_at', today).order('start_at').limit(5),
        supabase.from('notifications').select('id, title, channel, status, sent_at, scheduled_at').eq('school_id', school.id).order('created_at', { ascending: false }).limit(5),
      ]);

      const studentBirthdayRows = ((studentBirthdays.data ?? []) as Array<{ first_name: string; last_name: string; dob: string }>).map((row) => ({
        name: `${row.first_name} ${row.last_name}`,
        audience: 'Student',
        dob: row.dob,
      }));
      const staffBirthdayRows = ((staffBirthdays.data ?? []) as Array<{ full_name: string; dob: string }>).map((row) => ({
        name: row.full_name,
        audience: 'Staff',
        dob: row.dob,
      }));

      setMetrics({
        totalStudents: studentsCount.count ?? 0,
        totalStaff: staffCount.count ?? 0,
        totalParents: parentsCount.count ?? 0,
        todayStudentAttendance: studentAttendanceCount.count ?? 0,
        todayStaffAttendance: staffAttendanceCount.count ?? 0,
        pendingInvoices: pendingInvoiceCount.count ?? 0,
        activityUpdates: activityCount.count ?? 0,
      });
      setBirthdays(
        [...studentBirthdayRows, ...staffBirthdayRows]
          .filter((row) => row.dob)
          .sort((left, right) => daysUntil(left.dob) - daysUntil(right.dob))
          .slice(0, 6),
      );
      setEvents((upcomingEvents.data ?? []) as EventItem[]);
      setNotifications((recentNotifications.data ?? []) as NotificationItem[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin Overview"
        title="Run the entire school from one place"
        description="Track admissions, student care, parent communication, billing, events and school branding with a single admin dashboard."
        actions={
          <>
            {quickActions.map((action) => (
              <Link key={action.to} className="button-secondary" to={action.to}>
                {action.label}
              </Link>
            ))}
          </>
        }
      />

      {message ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={GraduationCap} label="Total students" meta="Active children" value={metrics.totalStudents} />
        <StatCard icon={UserRound} label="Total staff" meta="Teachers and staff" tone="teal" value={metrics.totalStaff} />
        <StatCard icon={Users} label="Total parents" meta="Parent contacts" tone="slate" value={metrics.totalParents} />
        <StatCard icon={Wallet} label="Pending fee invoices" meta="Needs follow-up" value={metrics.pendingInvoices} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Today at a glance"
          description="Daily operations summary for attendance, child care and communication."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] p-5" style={{ background: 'rgb(var(--school-primary-rgb) / 0.1)' }}>
              <p className="text-sm font-semibold text-slate-500">Student attendance marked</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{metrics.todayStudentAttendance}</p>
              <p className="mt-2 text-sm text-slate-500">Today’s student check-ins recorded.</p>
            </div>
            <div className="rounded-[1.5rem] p-5" style={{ background: 'rgb(var(--school-secondary-rgb) / 0.1)' }}>
              <p className="text-sm font-semibold text-slate-500">Staff attendance marked</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{metrics.todayStaffAttendance}</p>
              <p className="mt-2 text-sm text-slate-500">Team attendance recorded for the day.</p>
            </div>
            <div className="rounded-[1.5rem] bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">Daily activity updates</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{metrics.activityUpdates}</p>
              <p className="mt-2 text-sm text-slate-500">Meal, nap, outdoor play and health notes shared.</p>
            </div>
            <div className="rounded-[1.5rem] bg-amber-50 p-5">
              <p className="text-sm font-semibold text-slate-500">Pending fee follow-ups</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{metrics.pendingInvoices}</p>
              <p className="mt-2 text-sm text-slate-500">Invoices still pending or partially paid.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Upcoming birthdays" description="Students and staff birthdays coming up next.">
          <div className="space-y-3">
            {birthdays.length === 0 ? (
              <p className="text-sm text-slate-500">No birthdays available yet.</p>
            ) : (
              birthdays.map((item) => (
                <div key={`${item.name}-${item.dob}`} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">
                      {item.audience} · {formatDate(item.dob)}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]"
                    style={{ background: 'rgb(var(--school-primary-rgb) / 0.14)', color: 'var(--school-primary)' }}
                  >
                    In {daysUntil(item.dob)} day{daysUntil(item.dob) === 1 ? '' : 's'}
                  </span>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Upcoming events" description="Calendar items that need attention or reminders.">
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming events scheduled.</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="flex items-start justify-between rounded-2xl border border-slate-100 p-4">
                  <div>
                    <p className="font-bold text-slate-900">{event.title}</p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                      <CalendarDays className="h-4 w-4" />
                      {formatDateTime(event.start_at)}
                    </div>
                  </div>
                  <StatusBadge value={event.event_type} />
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Recent notifications" description="Latest communication items logged in the system.">
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">No communication entries yet.</p>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900">{notification.title}</p>
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                        <Megaphone className="h-4 w-4" />
                        {notification.channel}
                      </div>
                    </div>
                    <StatusBadge value={notification.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <Clock3 className="h-3.5 w-3.5" />
                    {notification.sent_at ? `Sent ${formatDateTime(notification.sent_at)}` : `Scheduled ${formatDateTime(notification.scheduled_at)}`}
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
