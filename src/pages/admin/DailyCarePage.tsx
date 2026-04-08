import { useEffect, useMemo, useState } from 'react';
import { Baby, HeartPulse, MoonStar, Soup } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { DailyActivityRecord, StudentRecord } from '../../types/app';

const activitySeed = {
  student_id: '',
  activity_date: new Date().toISOString().slice(0, 10),
  activity_type: 'meal',
  summary: '',
  details: '',
  status: '',
};

export function DailyCarePage() {
  const { school } = useAppContext();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<DailyActivityRecord[]>([]);
  const [form, setForm] = useState(activitySeed);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadActivities();
  }, [school.id]);

  async function loadActivities() {
    setMessage(null);

    try {
      const [studentResponse, activityResponse] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', school.id).eq('is_active', true).order('first_name'),
        supabase.from('daily_activity_logs').select('*').eq('school_id', school.id).order('activity_date', { ascending: false }).limit(50),
      ]);

      setStudents((studentResponse.data ?? []) as StudentRecord[]);
      setActivityLogs((activityResponse.data ?? []) as DailyActivityRecord[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const { error } = await supabase.from('daily_activity_logs').insert({
        school_id: school.id,
        student_id: form.student_id,
        activity_date: form.activity_date,
        activity_type: form.activity_type,
        summary: form.summary,
        details: form.details || null,
        status: form.status || null,
      });

      if (error) throw error;
      setForm(activitySeed);
      await loadActivities();
      setMessage('Daily activity logged.');
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

  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = activityLogs.filter((item) => item.activity_date === today);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily Activity"
        title="Child care updates for preschool operations"
        description="Track meals, naps, washroom visits, mood, learning moments, health observations and pickup updates in one daily journal."
      />

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Soup} label="Meal updates today" value={todayLogs.filter((item) => item.activity_type === 'meal').length} />
        <StatCard icon={MoonStar} label="Nap updates today" tone="teal" value={todayLogs.filter((item) => item.activity_type === 'nap').length} />
        <StatCard icon={HeartPulse} label="Health notes today" tone="slate" value={todayLogs.filter((item) => item.activity_type === 'health').length} />
        <StatCard icon={Baby} label="Pickup/drop updates" value={todayLogs.filter((item) => item.activity_type === 'pickup').length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Log activity" description="Capture the daily care events parents expect to see.">
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
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, activity_date: event.target.value }))} type="date" value={form.activity_date} />
            </div>
            <div>
              <label className="form-label">Activity type</label>
              <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, activity_type: event.target.value }))} value={form.activity_type}>
                <option value="meal">Meal update</option>
                <option value="nap">Nap / sleep</option>
                <option value="toilet">Toilet / washroom</option>
                <option value="mood">Mood / behavior</option>
                <option value="learning">Learning activity</option>
                <option value="outdoor">Outdoor play</option>
                <option value="health">Health observation</option>
                <option value="pickup">Pickup / drop status</option>
                <option value="incident">Incident report</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Summary</label>
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Finished lunch well" value={form.summary} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Detailed note</label>
              <textarea className="form-input min-h-28" onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))} value={form.details} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Status tag</label>
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} placeholder="normal, required follow-up, picked-up" value={form.status} />
            </div>
            <div className="md:col-span-2">
              <button className="button-primary" type="submit">
                Save activity update
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Activity feed" description="Recent daily care updates across the school.">
          <DataTable
            columns={[
              { key: 'student', label: 'Student', render: (row) => studentLookup[row.student_id] ?? 'Unknown student' },
              { key: 'date', label: 'Date', render: (row) => formatDate(row.activity_date) },
              { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.activity_type} /> },
              { key: 'summary', label: 'Summary', render: (row) => row.summary },
              { key: 'status', label: 'Tag', render: (row) => <StatusBadge value={row.status ?? 'logged'} /> },
            ]}
            emptyMessage="No activity logs yet."
            rows={activityLogs}
          />
        </SectionCard>
      </div>
    </div>
  );
}
