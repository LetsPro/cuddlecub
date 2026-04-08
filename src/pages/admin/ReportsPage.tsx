import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatCard } from '../../components/StatCard';
import { useAppContext } from '../../lib/app-context';
import { downloadCsv, formatCurrency } from '../../lib/utils';
import { getErrorMessage, supabase } from '../../lib/supabase';

interface ReportState {
  students: Array<Record<string, any>>;
  parents: Array<Record<string, any>>;
  staff: Array<Record<string, any>>;
  attendance: Array<Record<string, any>>;
  invoices: Array<Record<string, any>>;
  notifications: Array<Record<string, any>>;
}

export function ReportsPage() {
  const { school } = useAppContext();
  const [reportData, setReportData] = useState<ReportState>({
    students: [],
    parents: [],
    staff: [],
    attendance: [],
    invoices: [],
    notifications: [],
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadReports();
  }, [school.id]);

  async function loadReports() {
    setMessage(null);

    try {
      const [studentResponse, parentResponse, staffResponse, attendanceResponse, invoiceResponse, notificationResponse] = await Promise.all([
        supabase.from('students').select('first_name, last_name, admission_number, dob, is_active').eq('school_id', school.id).limit(500),
        supabase.from('parents').select('full_name, phone_number, email, is_active').eq('school_id', school.id).limit(500),
        supabase.from('staff').select('full_name, designation, role, is_active').eq('school_id', school.id).limit(500),
        supabase.from('student_attendance').select('student_id, attendance_date, status, late_minutes').eq('school_id', school.id).limit(500),
        supabase.from('fee_invoices').select('invoice_number, due_date, amount_due, amount_paid, status').eq('school_id', school.id).limit(500),
        supabase.from('notifications').select('title, channel, audience, status, scheduled_at, sent_at').eq('school_id', school.id).limit(500),
      ]);

      setReportData({
        students: (studentResponse.data ?? []) as Array<Record<string, any>>,
        parents: (parentResponse.data ?? []) as Array<Record<string, any>>,
        staff: (staffResponse.data ?? []) as Array<Record<string, any>>,
        attendance: (attendanceResponse.data ?? []) as Array<Record<string, any>>,
        invoices: (invoiceResponse.data ?? []) as Array<Record<string, any>>,
        notifications: (notificationResponse.data ?? []) as Array<Record<string, any>>,
      });
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  const totalOutstanding = reportData.invoices.reduce((sum, invoice) => sum + ((invoice.amount_due ?? 0) - (invoice.amount_paid ?? 0)), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports & Analytics"
        title="Operational exports and reporting"
        description="Export student, parent, staff, attendance, fee and communication data for MIS, finance reviews and client reporting."
      />

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Download} label="Students in report" value={reportData.students.length} />
        <StatCard icon={Download} label="Parents in report" tone="teal" value={reportData.parents.length} />
        <StatCard icon={Download} label="Staff in report" tone="slate" value={reportData.staff.length} />
        <StatCard icon={Download} label="Outstanding dues" value={formatCurrency(totalOutstanding)} />
      </div>

      <SectionCard title="Downloadable exports" description="Quick CSV exports for the most common school reports.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <button
            className="button-secondary justify-between"
            onClick={() =>
              downloadCsv(
                'students-report.csv',
                ['First Name', 'Last Name', 'Admission Number', 'DOB', 'Active'],
                reportData.students.map((row) => [row.first_name, row.last_name, row.admission_number, row.dob, row.is_active]),
              )
            }
            type="button"
          >
            Student report
            <Download className="h-4 w-4" />
          </button>
          <button
            className="button-secondary justify-between"
            onClick={() =>
              downloadCsv(
                'parents-report.csv',
                ['Full Name', 'Phone', 'Email', 'Active'],
                reportData.parents.map((row) => [row.full_name, row.phone_number, row.email, row.is_active]),
              )
            }
            type="button"
          >
            Parent report
            <Download className="h-4 w-4" />
          </button>
          <button
            className="button-secondary justify-between"
            onClick={() =>
              downloadCsv(
                'staff-report.csv',
                ['Full Name', 'Designation', 'Role', 'Active'],
                reportData.staff.map((row) => [row.full_name, row.designation, row.role, row.is_active]),
              )
            }
            type="button"
          >
            Staff report
            <Download className="h-4 w-4" />
          </button>
          <button
            className="button-secondary justify-between"
            onClick={() =>
              downloadCsv(
                'attendance-report.csv',
                ['Student ID', 'Attendance Date', 'Status', 'Late Minutes'],
                reportData.attendance.map((row) => [row.student_id, row.attendance_date, row.status, row.late_minutes]),
              )
            }
            type="button"
          >
            Attendance report
            <Download className="h-4 w-4" />
          </button>
          <button
            className="button-secondary justify-between"
            onClick={() =>
              downloadCsv(
                'fees-report.csv',
                ['Invoice Number', 'Due Date', 'Amount Due', 'Amount Paid', 'Status'],
                reportData.invoices.map((row) => [row.invoice_number, row.due_date, row.amount_due, row.amount_paid, row.status]),
              )
            }
            type="button"
          >
            Fee collection report
            <Download className="h-4 w-4" />
          </button>
          <button
            className="button-secondary justify-between"
            onClick={() =>
              downloadCsv(
                'notification-report.csv',
                ['Title', 'Channel', 'Audience', 'Status', 'Scheduled At', 'Sent At'],
                reportData.notifications.map((row) => [row.title, row.channel, row.audience, row.status, row.scheduled_at, row.sent_at]),
              )
            }
            type="button"
          >
            Notification report
            <Download className="h-4 w-4" />
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
