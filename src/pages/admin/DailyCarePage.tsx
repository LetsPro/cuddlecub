import { useEffect, useMemo, useState } from 'react';
import { Baby, HeartPulse, MoonStar, PencilLine, Soup, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
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

const activityTypes = [
  { value: 'meal', label: 'Meal update' },
  { value: 'nap', label: 'Nap / sleep' },
  { value: 'toilet', label: 'Toilet / washroom' },
  { value: 'mood', label: 'Mood / behavior' },
  { value: 'learning', label: 'Learning activity' },
  { value: 'outdoor', label: 'Outdoor play' },
  { value: 'health', label: 'Health observation' },
  { value: 'pickup', label: 'Pickup / drop status' },
  { value: 'incident', label: 'Incident report' },
  { value: 'behavior', label: 'Behavior' },
  { value: 'classroom', label: 'Classroom activity' },
];

function isVideoUrl(value: string) {
  return /\.(mp4|mov|m4v|webm|ogg)(\?.*)?$/i.test(value);
}

function renderMediaPreview(url: string | null | undefined) {
  if (!url) return '-';

  if (isVideoUrl(url)) {
    return (
      <a className="block w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100" href={url} rel="noreferrer" target="_blank">
        <video className="h-16 w-full object-cover" muted playsInline preload="metadata" src={url} />
      </a>
    );
  }

  return (
    <a className="block w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100" href={url} rel="noreferrer" target="_blank">
      <img alt="Daily activity media preview" className="h-16 w-full object-cover" decoding="async" loading="lazy" src={url} />
    </a>
  );
}

export function DailyCarePage() {
  const { school } = useAppContext();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<DailyActivityRecord[]>([]);
  const [form, setForm] = useState(activitySeed);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...activitySeed, image_url: '', shared_with_parent: false });
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadActivities();
  }, [school.id]);

  async function loadActivities() {
    setMessage(null);

    try {
      const [studentResponse, activityResponse] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', school.id).eq('is_active', true).order('first_name'),
        supabase
          .from('daily_activity_logs')
          .select('*')
          .eq('school_id', school.id)
          .order('activity_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(200),
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

  function openEditModal(activity: DailyActivityRecord) {
    setEditingActivityId(activity.id);
    setEditForm({
      student_id: activity.student_id,
      activity_date: activity.activity_date,
      activity_type: activity.activity_type,
      summary: activity.summary,
      details: activity.details ?? '',
      status: activity.status ?? '',
      image_url: activity.image_url ?? '',
      shared_with_parent: Boolean(activity.shared_with_parent),
    });
  }

  function closeEditModal() {
    setEditingActivityId(null);
    setEditForm({ ...activitySeed, image_url: '', shared_with_parent: false });
  }

  async function handleUpdateActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingActivityId) return;

    setMessage(null);

    try {
      const { error } = await supabase
        .from('daily_activity_logs')
        .update({
          student_id: editForm.student_id,
          activity_date: editForm.activity_date,
          activity_type: editForm.activity_type,
          summary: editForm.summary,
          details: editForm.details || null,
          status: editForm.status || null,
          image_url: editForm.image_url || null,
          shared_with_parent: editForm.shared_with_parent,
        })
        .eq('id', editingActivityId)
        .eq('school_id', school.id);

      if (error) throw error;
      closeEditModal();
      await loadActivities();
      setMessage('Daily activity updated.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteActivity(activity: DailyActivityRecord) {
    const studentName = studentLookup[activity.student_id] ?? 'this student';
    const confirmed = window.confirm(`Delete daily activity for ${studentName} on ${formatDate(activity.activity_date)}?`);

    if (!confirmed) return;

    setMessage(null);
    setBusyDeleteId(activity.id);

    try {
      const { error } = await supabase.from('daily_activity_logs').delete().eq('id', activity.id).eq('school_id', school.id);

      if (error) throw error;
      if (editingActivityId === activity.id) {
        closeEditModal();
      }
      await loadActivities();
      setMessage('Daily activity deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
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
  const activityLogsByDate = useMemo(() => {
    const grouped = new Map<string, DailyActivityRecord[]>();

    activityLogs.forEach((item) => {
      const existing = grouped.get(item.activity_date) ?? [];
      existing.push(item);
      grouped.set(item.activity_date, existing);
    });

    return Array.from(grouped.entries()).map(([activityDate, logs]) => ({ activityDate, logs }));
  }, [activityLogs]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily Activity"
        title="Daily activity updates from teachers"
        description="Review teacher-updated meals, naps, washroom visits, mood, learning moments, health observations and pickup updates date wise."
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
                {activityTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
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

        <SectionCard title="Teacher activity updates" description="Recent daily activity logs grouped date wise across the school.">
          <div className="space-y-5">
            {activityLogsByDate.map(({ activityDate, logs }) => (
              <div className="space-y-3" key={activityDate}>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="font-bold text-slate-900">{formatDate(activityDate)}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {logs.length} update{logs.length === 1 ? '' : 's'}
                  </p>
                </div>
                <DataTable
                  columns={[
                    { key: 'student', label: 'Student', render: (row) => studentLookup[row.student_id] ?? 'Unknown student' },
                    { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.activity_type} /> },
                    { key: 'summary', label: 'Summary', render: (row) => row.summary },
                    { key: 'media', label: 'Media', render: (row) => renderMediaPreview(row.image_url) },
                    { key: 'status', label: 'Tag', render: (row) => <StatusBadge value={row.status ?? 'logged'} /> },
                    { key: 'parent', label: 'Parent', render: (row) => <StatusBadge value={row.shared_with_parent ? 'shared' : 'not shared'} /> },
                    {
                      key: 'actions',
                      label: 'Actions',
                      render: (row) => (
                        <div className="flex flex-wrap gap-2">
                          <button className="button-secondary gap-2 px-3 py-2 text-xs" onClick={() => openEditModal(row)} type="button">
                            <PencilLine className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button className="button-danger gap-2 px-3 py-2 text-xs" disabled={busyDeleteId === row.id} onClick={() => void handleDeleteActivity(row)} type="button">
                            <Trash2 className="h-3.5 w-3.5" />
                            {busyDeleteId === row.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      ),
                    },
                  ]}
                  emptyMessage="No activity logs for this date."
                  rows={logs}
                />
              </div>
            ))}
            {!activityLogsByDate.length ? <p className="text-sm text-slate-500">No activity logs yet.</p> : null}
          </div>
        </SectionCard>
      </div>

      <Modal
        description="Update a saved teacher or admin daily activity entry."
        onClose={closeEditModal}
        open={Boolean(editingActivityId)}
        title="Edit daily activity"
      >
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleUpdateActivity}>
          <div className="sm:col-span-2">
            <label className="form-label">Student</label>
            <select className="form-input" onChange={(event) => setEditForm((current) => ({ ...current, student_id: event.target.value }))} required value={editForm.student_id}>
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
            <input className="form-input" onChange={(event) => setEditForm((current) => ({ ...current, activity_date: event.target.value }))} required type="date" value={editForm.activity_date} />
          </div>
          <div>
            <label className="form-label">Activity type</label>
            <select className="form-input" onChange={(event) => setEditForm((current) => ({ ...current, activity_type: event.target.value }))} value={editForm.activity_type}>
              {activityTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Summary</label>
            <input className="form-input" onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))} required value={editForm.summary} />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Detailed note</label>
            <textarea className="form-input min-h-28" onChange={(event) => setEditForm((current) => ({ ...current, details: event.target.value }))} value={editForm.details} />
          </div>
          <div>
            <label className="form-label">Status tag</label>
            <input className="form-input" onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))} value={editForm.status} />
          </div>
          <label className="self-end rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
            <input checked={editForm.shared_with_parent} className="mr-3" onChange={(event) => setEditForm((current) => ({ ...current, shared_with_parent: event.target.checked }))} type="checkbox" />
            Share with parent
          </label>
          <div className="space-y-3 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="form-label mb-0">Media</label>
              {editForm.image_url ? (
                <button className="button-secondary px-3 py-2 text-xs" onClick={() => setEditForm((current) => ({ ...current, image_url: '' }))} type="button">
                  Remove media
                </button>
              ) : null}
            </div>
            {editForm.image_url ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="h-56 bg-slate-100">
                  {isVideoUrl(editForm.image_url) ? (
                    <video className="h-full w-full object-cover" controls preload="metadata" src={editForm.image_url} />
                  ) : (
                    <img alt="Daily activity media preview" className="h-full w-full object-cover" decoding="async" src={editForm.image_url} />
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="truncate text-xs font-semibold text-slate-500">{isVideoUrl(editForm.image_url) ? 'Video' : 'Photo'}</span>
                  <a className="text-sm font-bold theme-text-primary" href={editForm.image_url} rel="noreferrer" target="_blank">Open media</a>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No media attached
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
            <button className="button-secondary" onClick={closeEditModal} type="button">Cancel</button>
            <button className="button-primary" type="submit">Save changes</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
