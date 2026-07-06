import { useEffect, useMemo, useState } from 'react';
import { Eye, ImagePlus, PencilLine, Search, Trash2 } from 'lucide-react';
import { ClassSelector } from '../../components/ClassSelector';
import { DataTable } from '../../components/DataTable';
import { MediaPickerModal } from '../../components/MediaPickerModal';
import { Modal } from '../../components/Modal';
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
const activityTypes = [
  { value: 'meal', label: 'Meal' },
  { value: 'nap', label: 'Nap' },
  { value: 'toilet', label: 'Washroom' },
  { value: 'mood', label: 'Mood' },
  { value: 'health', label: 'Health' },
  { value: 'behavior', label: 'Behavior' },
  { value: 'learning', label: 'Learning progress' },
  { value: 'classroom', label: 'Classroom activity' },
  { value: 'pickup', label: 'Pickup / drop' },
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

export function StaffDailyActivityPage() {
  const { school } = useAppContext();
  const { staffRecord, students, message } = useStaffPortal();
  const { availableClasses, selectedClassId, setSelectedClassId, filteredStudents, studentCounts } =
    useClassFilter(students, staffRecord?.assigned_class_ids?.[0] ?? staffRecord?.class_teacher_for);

  const [logs, setLogs] = useState<DailyActivityRecord[]>([]);
  const [logsQuery, setLogsQuery] = useState('');
  const [form, setForm] = useState({
    student_ids: [] as string[],
    activity_date: today,
    activity_type: 'meal',
    summary: '',
    details: '',
    status: '',
    media_urls: [] as string[],
    shared_with_parent: true,
  });
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [editMediaPickerOpen, setEditMediaPickerOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    student_id: '',
    activity_date: today,
    activity_type: 'meal',
    summary: '',
    details: '',
    status: '',
    image_url: '',
    shared_with_parent: true,
  });
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [previewActivity, setPreviewActivity] = useState<DailyActivityRecord | null>(null);
  const studentNameMap = useMemo(() => buildStudentNameMap(students), [students]);

  useEffect(() => {
    if (!students.length) return;
    void loadLogs();
  }, [students.map((student) => student.id).join('|')]);

  useEffect(() => {
    const availableStudentIds = new Set(filteredStudents.map((student) => student.id));
    setForm((current) => ({
      ...current,
      student_ids: current.student_ids.filter((studentId) => availableStudentIds.has(studentId)),
    }));
  }, [filteredStudents.map((student) => student.id).join('|')]);

  async function loadLogs() {
    try {
      const { data, error } = await supabase
        .from('daily_activity_logs')
        .select('*')
        .in('student_id', students.map((student) => student.id))
        .order('activity_date', { ascending: false })
        .order('created_at', { ascending: false })
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
      const mediaUrls = form.media_urls.length ? form.media_urls : [null];
      const rows = form.student_ids.flatMap((studentId) =>
        mediaUrls.map((mediaUrl) => ({
          school_id: school.id,
          student_id: studentId,
          activity_date: form.activity_date,
          activity_type: form.activity_type,
          summary: form.summary,
          details: form.details || null,
          status: form.status || null,
          image_url: mediaUrl,
          shared_with_parent: form.shared_with_parent,
        })),
      );

      const { error } = await supabase.from('daily_activity_logs').insert(rows);

      if (error) throw error;
      setForm({ student_ids: [], activity_date: today, activity_type: 'meal', summary: '', details: '', status: '', media_urls: [], shared_with_parent: true });
      await loadLogs();
      setSubmitMessage(rows.length === 1 ? 'Daily update sent.' : `${rows.length} daily updates sent.`);
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  function toggleStudent(studentId: string) {
    setForm((current) => ({
      ...current,
      student_ids: current.student_ids.includes(studentId)
        ? current.student_ids.filter((id) => id !== studentId)
        : [...current.student_ids, studentId],
    }));
  }

  function toggleAllFilteredStudents(checked: boolean) {
    setForm((current) => ({
      ...current,
      student_ids: checked ? filteredStudents.map((student) => student.id) : [],
    }));
  }

  function removeMediaUrl(value: string) {
    setForm((current) => ({
      ...current,
      media_urls: current.media_urls.filter((url) => url !== value),
    }));
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
    setEditMediaPickerOpen(false);
    setEditForm({
      student_id: '',
      activity_date: today,
      activity_type: 'meal',
      summary: '',
      details: '',
      status: '',
      image_url: '',
      shared_with_parent: true,
    });
  }

  async function handleUpdateActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingActivityId) return;

    setSubmitMessage(null);

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
      await loadLogs();
      setSubmitMessage('Daily update saved.');
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteActivity(activity: DailyActivityRecord) {
    const studentName = studentNameMap[activity.student_id] ?? 'this student';
    const confirmed = window.confirm(`Delete daily update for ${studentName} on ${formatDate(activity.activity_date)}?`);

    if (!confirmed) return;

    setSubmitMessage(null);
    setBusyDeleteId(activity.id);

    try {
      const { error } = await supabase.from('daily_activity_logs').delete().eq('id', activity.id).eq('school_id', school.id);

      if (error) throw error;
      if (editingActivityId === activity.id) {
        closeEditModal();
      }
      if (previewActivity?.id === activity.id) {
        setPreviewActivity(null);
      }
      await loadLogs();
      setSubmitMessage('Daily update deleted.');
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
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

      <div className="grid gap-6 2xl:grid-cols-[minmax(28rem,32rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionCard title="Add daily update" description="Send one care or learning update to selected students.">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="form-label mb-0">Students</label>
                <label className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <input
                    checked={filteredStudents.length > 0 && form.student_ids.length === filteredStudents.length}
                    className="mr-2"
                    onChange={(event) => toggleAllFilteredStudents(event.target.checked)}
                    type="checkbox"
                  />
                  Select all
                </label>
              </div>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2">
                {filteredStudents.map((student) => (
                  <label className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" key={student.id}>
                    <input checked={form.student_ids.includes(student.id)} onChange={() => toggleStudent(student.id)} type="checkbox" />
                    <span>{formatStudentOption(student)}</span>
                  </label>
                ))}
                {!filteredStudents.length ? <p className="px-3 py-4 text-sm text-slate-500">No students found for this class.</p> : null}
              </div>
              <p className="mt-2 text-xs text-slate-500">{form.student_ids.length} selected</p>
            </div>
            <div>
              <label className="form-label">Date</label>
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, activity_date: event.target.value }))} type="date" value={form.activity_date} />
            </div>
            <div>
              <label className="form-label">Type</label>
              <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, activity_type: event.target.value }))} value={form.activity_type}>
                {activityTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Summary</label>
              <input className="form-input" required onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} value={form.summary} />
            </div>
            <div className="sm:col-span-2">
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
            <div className="sm:col-span-2">
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <label className="form-label mb-0">Media</label>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Optional classroom, meal, activity, or learning photos and videos to share with parents.</p>
                  </div>
                  <button className="button-secondary gap-2" onClick={() => setMediaPickerOpen(true)} type="button">
                    <ImagePlus className="h-4 w-4" />
                    Add media
                  </button>
                </div>
                {form.media_urls.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                    {form.media_urls.map((url) => (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" key={url}>
                        <div className="h-36 bg-slate-100">
                          {isVideoUrl(url) ? (
                            <video className="h-full w-full object-cover" controls preload="metadata" src={url} />
                          ) : (
                            <img alt="Selected daily update media" className="h-full w-full object-cover" decoding="async" loading="lazy" src={url} />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="truncate text-xs font-semibold text-slate-500">{isVideoUrl(url) ? 'Video' : 'Photo'}</span>
                          <button className="text-rose-600 transition hover:text-rose-700" onClick={() => removeMediaUrl(url)} type="button">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No media selected
                  </div>
                )}
              </div>
            </div>
            <div className="sm:col-span-2">
              <button className="button-primary" disabled={!form.student_ids.length} type="submit">Send update</button>
            </div>
          </form>
          </SectionCard>
        </div>

        <div className="min-w-0">
          <SectionCard title="Recent updates" description="Latest daily activity logs for the selected class.">
          <div className="min-w-0 space-y-4">
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
                { key: 'image', label: 'Media', render: (row) => renderMediaPreview(row.image_url) },
                { key: 'share', label: 'Shared', render: (row) => <StatusBadge value={row.shared_with_parent ? 'shared' : 'internal'} /> },
                {
                  key: 'preview',
                  label: 'Actions',
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <button className="button-secondary gap-2 !px-3 !py-2 text-xs" onClick={() => setPreviewActivity(row)} type="button">
                        <Eye className="h-4 w-4" />
                        Open
                      </button>
                      <button className="button-secondary gap-2 !px-3 !py-2 text-xs" onClick={() => openEditModal(row)} type="button">
                        <PencilLine className="h-4 w-4" />
                        Edit
                      </button>
                      <button className="button-danger gap-2 !px-3 !py-2 text-xs" disabled={busyDeleteId === row.id} onClick={() => void handleDeleteActivity(row)} type="button">
                        <Trash2 className="h-4 w-4" />
                        {busyDeleteId === row.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  ),
                },
              ]}
              emptyMessage="No daily activity entries yet."
              rows={displayedLogs}
            />
          </div>
          </SectionCard>
        </div>
      </div>

      <MediaPickerModal
        allowCropInMultiple
        allowMultiple
        allowVideos
        description="Choose existing photos or videos, or upload new media for this daily update."
        onClose={() => setMediaPickerOpen(false)}
        onSelectMultiple={(assets) => {
          setForm((current) => ({ ...current, media_urls: assets.map((asset) => asset.public_url) }));
          setMediaPickerOpen(false);
        }}
        open={mediaPickerOpen}
        selectedUrls={form.media_urls}
        title="Select daily update media"
      />

      <Modal
        description="Update this saved daily activity entry."
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
                  {formatStudentOption(student)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Date</label>
            <input className="form-input" onChange={(event) => setEditForm((current) => ({ ...current, activity_date: event.target.value }))} required type="date" value={editForm.activity_date} />
          </div>
          <div>
            <label className="form-label">Type</label>
            <select className="form-input" onChange={(event) => setEditForm((current) => ({ ...current, activity_type: event.target.value }))} value={editForm.activity_type}>
              {activityTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Summary</label>
            <input className="form-input" onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))} required value={editForm.summary} />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Details</label>
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <label className="form-label mb-0">Media</label>
                <p className="mt-1 text-xs leading-5 text-slate-500">Preview, replace, or remove the photo/video attached to this update.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {editForm.image_url ? (
                  <button className="button-secondary px-3 py-2 text-xs" onClick={() => setEditForm((current) => ({ ...current, image_url: '' }))} type="button">
                    Remove media
                  </button>
                ) : null}
                <button className="button-secondary gap-2 px-3 py-2 text-xs" onClick={() => setEditMediaPickerOpen(true)} type="button">
                  <ImagePlus className="h-4 w-4" />
                  {editForm.image_url ? 'Replace media' : 'Add media'}
                </button>
              </div>
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

      <MediaPickerModal
        allowVideos
        description="Choose a replacement photo or video for this saved daily update."
        onClose={() => setEditMediaPickerOpen(false)}
        onSelect={(asset) => {
          setEditForm((current) => ({ ...current, image_url: asset.public_url }));
          setEditMediaPickerOpen(false);
        }}
        open={editMediaPickerOpen}
        selectedUrl={editForm.image_url}
        title="Replace daily update media"
      />

      <Modal
        description="Review this saved daily activity exactly from the teacher side."
        onClose={() => setPreviewActivity(null)}
        open={Boolean(previewActivity)}
        title="Daily activity preview"
      >
        {previewActivity ? (
          <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
            {previewActivity.image_url ? (
              isVideoUrl(previewActivity.image_url) ? (
                <video className="block h-56 w-full bg-slate-100 object-cover sm:h-72" controls preload="metadata" src={previewActivity.image_url} />
              ) : (
                <a className="block h-56 bg-slate-100 sm:h-72" href={previewActivity.image_url} rel="noreferrer" target="_blank">
                  <img alt={previewActivity.summary} className="h-full w-full object-cover" decoding="async" src={previewActivity.image_url} />
                </a>
              )
            ) : (
              <div className="flex h-28 items-center justify-center bg-slate-50 text-sm text-slate-500">No media attached</div>
            )}
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={previewActivity.activity_type} />
                  {previewActivity.status ? <StatusBadge value={previewActivity.status} /> : null}
                </div>
                <p className="text-xs font-semibold text-slate-400">{formatDate(previewActivity.activity_date)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Student</p>
                <p className="mt-1 font-bold text-slate-900">{studentNameMap[previewActivity.student_id] ?? 'Unknown student'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Summary</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{previewActivity.summary}</p>
              </div>
              {previewActivity.details ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Details</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{previewActivity.details}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <StatusBadge value={previewActivity.shared_with_parent ? 'shared with parent' : 'internal only'} />
                {previewActivity.image_url ? (
                  <a className="text-sm font-bold theme-text-primary" href={previewActivity.image_url} rel="noreferrer" target="_blank">
                    Open media
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ) : null}
      </Modal>
    </div>
  );
}
