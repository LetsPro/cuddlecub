import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, CreditCard, Download, HeartPulse } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { ThemedLoader } from '../../components/ThemedLoader';
import { useAppContext } from '../../lib/app-context';
import { openBrandedInvoicePdf } from '../../lib/invoices';
import { buildStudentNameMap } from '../../lib/portal-data';
import { useParentPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import type { ContentPost, EventRecord, FeeInvoice, NotificationRecord } from '../../types/app';

interface AttendanceRow {
  student_id: string;
  status: string;
}

interface ActivityRow {
  student_id: string;
  summary: string;
}

export function ParentDashboardPage() {
  const { school } = useAppContext();
  const { parentRecord, students, loading, message } = useParentPortal();
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const studentIds = useMemo(() => students.map((student) => student.id), [students]);
  const studentNameMap = useMemo(() => buildStudentNameMap(students), [students]);

  useEffect(() => {
    if (!parentRecord || !students.length) return;
    void loadDashboard();
  }, [parentRecord?.id, school.id, studentIds.join('|')]);

  async function loadDashboard() {
    setLoadMessage(null);

    try {
      const [
        attendanceResponse,
        activityResponse,
        invoiceResponse,
        notificationResponse,
        eventResponse,
        postResponse,
      ] = await Promise.all([
        supabase.from('student_attendance').select('student_id, status').in('student_id', studentIds).eq('attendance_date', today),
        supabase.from('daily_activity_logs').select('student_id, summary').in('student_id', studentIds).eq('activity_date', today),
        supabase.from('fee_invoices').select('*').in('student_id', studentIds).order('due_date', { ascending: true }).limit(10),
        supabase.from('notifications').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(6),
        supabase.from('events').select('*').eq('school_id', school.id).gte('start_at', today).order('start_at').limit(5),
        supabase.from('content_posts').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(6),
      ]);

      if (attendanceResponse.error) throw attendanceResponse.error;
      if (activityResponse.error) throw activityResponse.error;
      if (invoiceResponse.error) throw invoiceResponse.error;
      if (notificationResponse.error) throw notificationResponse.error;
      if (eventResponse.error) throw eventResponse.error;
      if (postResponse.error) throw postResponse.error;

      setAttendance((attendanceResponse.data ?? []) as AttendanceRow[]);
      setActivities((activityResponse.data ?? []) as ActivityRow[]);
      setInvoices((invoiceResponse.data ?? []) as FeeInvoice[]);
      setNotifications((notificationResponse.data ?? []) as NotificationRecord[]);
      setEvents((eventResponse.data ?? []) as EventRecord[]);
      setPosts((postResponse.data ?? []) as ContentPost[]);
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  if (loading) {
    return (
      <SectionCard title="Parent dashboard" description="Loading your child summary.">
        <ThemedLoader description="Preparing attendance, daily activity, fee, and notice updates." label="Loading dashboard..." size="sm" />
      </SectionCard>
    );
  }

  if (!parentRecord) {
    return (
      <SectionCard title="Parent access pending" description="Your sign-in email must match the parent record created by the school.">
        <p className="text-sm text-slate-500">No linked parent record was found for this account yet.</p>
      </SectionCard>
    );
  }

  const pendingAmount = invoices
    .filter((invoice) => invoice.status !== 'paid')
    .reduce((sum, invoice) => sum + ((invoice.amount_due ?? 0) - (invoice.amount_paid ?? 0)), 0);

  function downloadInvoice(invoice: FeeInvoice) {
    if (!parentRecord) return;

    try {
      void openBrandedInvoicePdf({
        school,
        invoice,
        studentName: studentNameMap[invoice.student_id] ?? 'Child',
        parentName: parentRecord.full_name,
        parentPhone: parentRecord.whatsapp_number || parentRecord.phone_number || 'Not set',
      });
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Parent Dashboard"
        title="Everything important about your child, today"
        description="See attendance, daily activity, pending fees, notices, upcoming events and shared posts in one simple portal."
        actions={
          <>
            <Link className="button-secondary" to="/parent/child">Child profile</Link>
            <Link className="button-secondary" to="/parent/fees">Fees</Link>
            <Link className="button-secondary" to="/parent/requests">Send request</Link>
          </>
        }
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Bell} label="Today's attendance" value={`${attendance.length}/${students.length}`} meta="Children marked today" />
        <StatCard icon={HeartPulse} label="Today's activity updates" tone="teal" value={activities.length} meta="Care and learning notes" />
        <StatCard icon={CreditCard} label="Pending fees" tone="amber" value={formatCurrency(pendingAmount)} meta="Outstanding amount" />
        <StatCard icon={CalendarDays} label="Upcoming events" tone="slate" value={events.length} meta="Next school dates" />
      </div>

      <SectionCard title="Fee invoices" description="Recent invoices are available here for quick download.">
        <div className="space-y-3">
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-500">No invoices available.</p>
          ) : (
            invoices.slice(0, 5).map((invoice) => (
              <div key={invoice.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{invoice.invoice_number}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {studentNameMap[invoice.student_id] ?? 'Child'} · Due {formatDate(invoice.due_date)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge value={invoice.status} />
                    <span className="text-sm font-bold text-slate-700">{formatCurrency(invoice.amount_due - (invoice.amount_paid ?? 0))}</span>
                  </div>
                </div>
                <button className="button-secondary gap-2 px-3 py-2 text-xs" onClick={() => downloadInvoice(invoice)} type="button">
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </button>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="Child profile summary" description="Quick summary cards for linked children.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => (
            <div key={student.id} className="rounded-2xl border border-slate-100 bg-white p-4">
              <p className="font-bold text-slate-900">{student.first_name} {student.last_name}</p>
              <p className="mt-1 text-sm text-slate-500">{student.class_name ?? 'Unassigned'} · {student.section_name ?? 'No section'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge value={attendance.find((item) => item.student_id === student.id)?.status ?? 'pending'} />
                <StatusBadge value={activities.find((item) => item.student_id === student.id) ? 'activity updated' : 'awaiting update'} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Notices and reminders" description="Recent school communication sent to parents.">
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">No notices available.</p>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900">{notification.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{notification.message}</p>
                    </div>
                    <StatusBadge value={notification.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Events and greetings" description="Upcoming events and recently published creative posts.">
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-100 p-4">
                <p className="font-bold text-slate-900">{event.title}</p>
                <p className="mt-1 text-sm text-slate-500">{formatDateTime(event.start_at)}</p>
              </div>
            ))}
            {posts.slice(0, 2).map((post) => (
              <div key={post.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-900">{post.title}</p>
                <p className="mt-1 text-sm text-slate-500">{post.caption ?? 'Shared school creative'}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
