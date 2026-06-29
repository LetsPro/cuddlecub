import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ClassSelector } from '../../components/ClassSelector';
import { DataTable } from '../../components/DataTable';
import { MediaField } from '../../components/MediaField';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { buildStudentNameMap, formatStudentOption } from '../../lib/portal-data';
import { useClassFilter, useStaffPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { DailyActivityRecord } from '../../types/app';

const today = new Date().toISOString().slice(0, 10);

export function StaffDailyActivityPage() {
  const { school } = useAppContext();
  const { staffRecord, students, message } = useStaffPortal();
  const { availableClasses, selectedClassId, setSelectedClassId, filteredStudents, studentCounts } =
    useClassFilter(students, staffRecord?.class_teacher_for);

  const [logs, setLogs] = useState<DailyActivityRecord[]>([]);
  const [logsQuery, setLogsQuery] = useState('');
  const [form, setForm] = useState({
    student_id: '',
    activity_date: today,
    activity_type: 'meal',
    summary: '',
    details: '',
    status: '',
    image_url: '',
    shared_with_parent: true,
  });
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const studentNameMap = useMemo(() => buildStudentNameMap(students), [students]);

  useEffect(() => {
    if (!students.length) return;
    void loadLogs();
  }, [students.map((student) => student.id).join('|')]);

  async function loadLogs() {
    try {
      const { data, error } = await supabase
        .from('daily_activity_logs')
        .select('*')
        .in('student_id', students.map((student) => student.id))
        .order('activity_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs((data ?? []) as DailyActivityRecord[]);
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitMessage(null);

    try {
      const { error } = await supabase.from('daily_activity_logs').insert({
        school_id: school.id,
        student_id: form.student_id,
        activity_date: form.activity_date,
        activity_type: form.activity_type,
        summary: form.summary,
        details: form.details || null,
        status: form.status || null,
        image_url: form.image_url || null,
        shared_with_parent: form.shared_with_parent,
      });

      if (error) throw error;
      setForm({ student_id: '', activity_date: today, activity_type: 'meal', summary: '', details: '', status: '', image_url: '', shared_with_parent: true });
      await loadLogs();
      setSubmitMessage('Daily activity saved.');
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  const filteredStudentIdSet = useMemo(() => new Set(filteredStudents.map((s) => s.id)), [filteredStudents]);

  const displayedLogs = useMemo(() => {
    const normalized = logsQuery.trim().toLowerCase();
    return logs.filter((row) => {
      if (!filteredStudentIdSet.has(row.student_id)) return false;
      if (!normalized) return true;
      const name = (studentNameMap[row.student_id] ?? '').toLowerCase();
      return name.includes(normalized) || row.activity_type.includes(normalized) || row.summary.toLowerCase().includes(normalized);
    });
  }, [logs, filteredStudentIdSet, logsQuery, studentNameMap]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily Activity"
        title="Publish child care and learning updates"
        description="Log meal, nap, washroom, mood, health, behavior, learning progress and pickup updates, then share the summary with parents."
      />

      {message || submitMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || submitMessage}</div>
      ) : null}

      <ClassSelector
        classes={availableClasses}
        counts={studentCounts}
        onChange={setSelectedClassId}
        selectedClassId={selectedClassId}
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Add daily update" description="Create a single activity log entry for a child.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="md:col-span-2">
              <label className="form-label">Student</label>
              <select className="form-input" required onChange={(event) => setForm((current) => ({ ...current, student_id: event.target.value }))} value={form.student_id}>
                <option value="">Select student</option>
                {filteredStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {formatStudentOption(student)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Date</label>
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, activity_date: event.target.value }))} type="date" value={form.activity_date} />
            </div>
            <div>
              <label className="form-label">Type</label>
              <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, activity_type: event.target.value }))} value={form.activity_type}>
                <option value="meal">Meal</option>
                <option value="nap">Nap</option>
                <option value="toilet">Washroom</option>
                <option value="mood">Mood</option>
                <option value="health">Health</option>
                <option value="behavior">Behavior</option>
                <option value="learning">Learning progress</option>
                <option value="classroom">Classroom activity</option>
                <option value="pickup">Pickup / drop</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Summary</label>
              <input className="form-input" required onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} value={form.summary} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Details</label>
              <textarea className="form-input min-h-28" onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))} value={form.details} />
            </div>
            <div>
              <label className="form-label">Status tag</label>
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} value={form.status} />
            </div>
            <label className="self-end rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
              <input checked={form.shared_with_parent} className="mr-3" onChange={(event) => setForm((current) => ({ ...current, shared_with_parent: event.target.checked }))} type="checkbox" />
              Share with parent
            </label>
            <div className="md:col-span-2">
              <MediaField
                helperText="Optional classroom, meal, activity, or learning photo to share with the parent."
                label="Activity image"
                onChange={(value) => setForm((current) => ({ ...current, image_url: value }))}
                previewHeightClassName="h-40"
                value={form.image_url}
              />
            </div>
            <div className="md:col-span-2">
              <button className="button-primary" type="submit">Save update</button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Recent updates" description="Latest daily activity logs for the selected class.">
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="form-input pl-11" onChange={(event) => setLogsQuery(event.target.value)} placeholder="Search by name, type or summary" value={logsQuery} />
            </div>
            <DataTable
              columns={[
                { key: 'student', label: 'Student', render: (row) => studentNameMap[row.student_id] ?? 'Unknown student' },
                { key: 'date', label: 'Date', render: (row) => formatDate(row.activity_date) },
                { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.activity_type} /> },
                { key: 'summary', label: 'Summary', render: (row) => row.summary },
                { key: 'image', label: 'Image', render: (row) => row.image_url ? <a className="font-bold theme-text-primary" href={row.image_url} rel="noreferrer" target="_blank">View image</a> : '-' },
                { key: 'share', label: 'Shared', render: (row) => <StatusBadge value={row.shared_with_parent ? 'shared' : 'internal'} /> },
              ]}
              emptyMessage="No daily activity entries yet."
              rows={displayedLogs}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
