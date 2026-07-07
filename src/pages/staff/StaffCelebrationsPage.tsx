import { useEffect, useMemo, useState } from 'react';
import { PencilLine, Plus, Search, Trash2 } from 'lucide-react';
import { ClassSelector } from '../../components/ClassSelector';
import { MediaField } from '../../components/MediaField';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { useClassFilter, useStaffPortal } from '../../lib/portal-hooks';
import { formatStudentOption } from '../../lib/portal-data';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { daysUntil, formatDate, formatDateTime } from '../../lib/utils';
import type { ContentPost, StaffRequest } from '../../types/app';

interface BirthdayRow {
  id: string;
  name: string;
  dob: string;
}

export function StaffCelebrationsPage() {
  const { school } = useAppContext();
  const { staffRecord, students, message } = useStaffPortal();
  const { availableClasses, selectedClassId, setSelectedClassId, filteredStudents, studentCounts } =
    useClassFilter(students, staffRecord?.assigned_class_ids?.[0] ?? staffRecord?.class_teacher_for);

  const [publishedPosts, setPublishedPosts] = useState<ContentPost[]>([]);
  const [submissions, setSubmissions] = useState<StaffRequest[]>([]);
  const [submissionsQuery, setSubmissionsQuery] = useState('');
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [isCelebrationModalOpen, setIsCelebrationModalOpen] = useState(false);
  const [form, setForm] = useState({
    category: 'birthday_photo',
    student_id: '',
    title: '',
    message: '',
    file_url: '',
  });
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!staffRecord) return;
    void loadCelebrations();
  }, [staffRecord?.id, students.map((student) => student.id).join('|')]);

  async function loadCelebrations() {
    if (!staffRecord) return;

    try {
      const [postResponse, submissionResponse] = await Promise.all([
        supabase.from('content_posts').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(20),
        supabase
          .from('staff_requests')
          .select('*, students(first_name, last_name, class_id, classes(name))')
          .eq('staff_id', staffRecord.id)
          .in('category', ['birthday_photo', 'content_suggestion', 'celebration_photo'])
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (postResponse.error) throw postResponse.error;
      if (submissionResponse.error) throw submissionResponse.error;

      setPublishedPosts((postResponse.data ?? []) as ContentPost[]);
      setSubmissions((submissionResponse.data ?? []) as StaffRequest[]);
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staffRecord) return;

    setSubmitMessage(null);

    try {
      const payload = {
        school_id: school.id,
        staff_id: staffRecord.id,
        student_id: form.student_id || null,
        category: form.category,
        title: form.title,
        message: form.message,
        file_url: form.file_url || null,
        status: 'pending',
        priority: 'normal',
      };
      const { error } = editingSubmissionId
        ? await supabase.from('staff_requests').update(payload).eq('id', editingSubmissionId).eq('staff_id', staffRecord.id)
        : await supabase.from('staff_requests').insert(payload);

      if (error) throw error;
      resetForm();
      await loadCelebrations();
      setSubmitMessage(editingSubmissionId ? 'Celebration content updated.' : 'Celebration content sent to admin.');
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  function resetForm() {
    setEditingSubmissionId(null);
    setForm({ category: 'birthday_photo', student_id: '', title: '', message: '', file_url: '' });
    setIsCelebrationModalOpen(false);
  }

  function openAddCelebration() {
    setEditingSubmissionId(null);
    setForm({ category: 'birthday_photo', student_id: '', title: '', message: '', file_url: '' });
    setSubmitMessage(null);
    setIsCelebrationModalOpen(true);
  }

  function startEditSubmission(row: StaffRequest) {
    setEditingSubmissionId(row.id);
    setForm({
      category: row.category,
      student_id: row.student_id ?? '',
      title: row.title,
      message: row.message,
      file_url: row.file_url ?? '',
    });
    setSubmitMessage(null);
    setIsCelebrationModalOpen(true);
  }

  async function deleteSubmission(row: StaffRequest) {
    if (!staffRecord || !window.confirm(`Delete "${row.title}"?`)) return;

    setBusyDeleteId(row.id);
    setSubmitMessage(null);

    try {
      const { error } = await supabase.from('staff_requests').delete().eq('id', row.id).eq('staff_id', staffRecord.id);
      if (error) throw error;
      if (editingSubmissionId === row.id) resetForm();
      await loadCelebrations();
      setSubmitMessage('Celebration content deleted.');
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  const upcomingBirthdays = useMemo<BirthdayRow[]>(
    () =>
      filteredStudents
        .map((student) => ({ id: student.id, name: `${student.first_name} ${student.last_name}`, dob: student.dob }))
        .sort((left, right) => daysUntil(left.dob) - daysUntil(right.dob))
        .slice(0, 8),
    [filteredStudents],
  );

  const displayedSubmissions = useMemo(() => {
    const q = submissionsQuery.trim().toLowerCase();
    return q ? submissions.filter((r) => r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)) : submissions;
  }, [submissions, submissionsQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Birthday & Event Support"
        title="Celebrations, photos and creative suggestions"
        description="Review birthday lists, upload student photos for creatives, suggest event content and see the published school posts."
        actions={
          <button className="button-primary gap-2" onClick={openAddCelebration} type="button">
            <Plus className="h-4 w-4" />
            Add celebration
          </button>
        }
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

      <SectionCard
        action={
          <button className="button-primary gap-2" onClick={openAddCelebration} type="button">
            <Plus className="h-4 w-4" />
            Add celebration
          </button>
        }
        title="Upcoming birthdays"
        description="Students in the selected class with birthdays coming up."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {upcomingBirthdays.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-500">{formatDate(item.dob)}</p>
              </div>
              <div className="shrink-0 text-sm font-semibold text-slate-500">{daysUntil(item.dob)} days</div>
            </div>
          ))}
          {upcomingBirthdays.length === 0 ? <p className="text-sm text-slate-500">No student birthdays found.</p> : null}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Your submissions" description="Celebrate support items already sent to admin.">
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="form-input pl-11" onChange={(event) => setSubmissionsQuery(event.target.value)} placeholder="Search submissions" value={submissionsQuery} />
            </div>
            <div className="space-y-3">
              {displayedSubmissions.map((row) => (
                <article key={row.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    {row.file_url ? (
                      <img alt={row.title} className="h-28 w-full rounded-xl object-cover sm:w-32" src={row.file_url} />
                    ) : (
                      <div className="flex h-28 w-full items-center justify-center rounded-xl bg-slate-50 text-sm font-semibold text-slate-400 sm:w-32">
                        No image
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <StatusBadge value={row.category} />
                          <p className="mt-2 font-bold text-slate-900">{row.title}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button className="button-secondary px-3 py-2 text-xs" onClick={() => startEditSubmission(row)} type="button">
                            <PencilLine className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button className="button-danger px-3 py-2 text-xs" disabled={busyDeleteId === row.id} onClick={() => void deleteSubmission(row)} type="button">
                            <Trash2 className="h-3.5 w-3.5" />
                            {busyDeleteId === row.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{row.message}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          {row.students ? `${row.students.first_name} ${row.students.last_name}` : 'School celebration'}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">{row.students?.classes?.name ?? 'All classes'}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1">{formatDateTime(row.created_at)}</span>
                      </div>
                      {row.file_url ? (
                        <a className="mt-3 inline-flex text-sm font-bold theme-text-primary" href={row.file_url} rel="noreferrer" target="_blank">
                          View image
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
              {displayedSubmissions.length === 0 ? <p className="text-sm text-slate-500">No submissions yet.</p> : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Published school creatives" description="Recent posts available from the school content studio.">
          <div className="space-y-3">
            {publishedPosts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{post.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{post.caption ?? 'School creative'}</p>
                  </div>
                  <StatusBadge value={post.post_type} />
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {formatDateTime(post.scheduled_for)}
                </p>
              </article>
            ))}
            {publishedPosts.length === 0 ? <p className="text-sm text-slate-500">No published creatives yet.</p> : null}
          </div>
        </SectionCard>
      </div>

      <Modal
        description="Add a birthday photo, class celebration photo or event content suggestion."
        onClose={resetForm}
        open={isCelebrationModalOpen}
        size="lg"
        title={editingSubmissionId ? 'Edit celebration' : 'Add celebration'}
      >
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} value={form.category}>
            <option value="birthday_photo">Birthday photo</option>
            <option value="content_suggestion">Event content suggestion</option>
            <option value="celebration_photo">Class celebration photo</option>
          </select>
          <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, student_id: event.target.value }))} value={form.student_id}>
            <option value="">No student link</option>
            {filteredStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {formatStudentOption(student)}
              </option>
            ))}
          </select>
          <input className="form-input" placeholder="Title" required onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} />
          <textarea className="form-input min-h-28" placeholder="Message" required onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} value={form.message} />
          <MediaField
            helperText="Upload the birthday or celebration image to send with this request."
            label="Celebration image"
            onChange={(value) => setForm((current) => ({ ...current, file_url: value }))}
            previewHeightClassName="h-36"
            value={form.file_url}
          />
          <div className="flex justify-end gap-3 pt-2">
            <button className="button-secondary" onClick={resetForm} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingSubmissionId ? 'Save celebration' : 'Add celebration'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
