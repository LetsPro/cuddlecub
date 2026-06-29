import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ClassSelector } from '../../components/ClassSelector';
import { DataTable } from '../../components/DataTable';
import { MediaField } from '../../components/MediaField';
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
    useClassFilter(students, staffRecord?.class_teacher_for);

  const [publishedPosts, setPublishedPosts] = useState<ContentPost[]>([]);
  const [submissions, setSubmissions] = useState<StaffRequest[]>([]);
  const [submissionsQuery, setSubmissionsQuery] = useState('');
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
          .select('*')
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
      const { error } = await supabase.from('staff_requests').insert({
        school_id: school.id,
        staff_id: staffRecord.id,
        student_id: form.student_id || null,
        category: form.category,
        title: form.title,
        message: form.message,
        file_url: form.file_url || null,
        status: 'pending',
        priority: 'normal',
      });

      if (error) throw error;
      setForm({ category: 'birthday_photo', student_id: '', title: '', message: '', file_url: '' });
      await loadCelebrations();
      setSubmitMessage('Celebration content sent to admin.');
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
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
        <SectionCard title="Upcoming birthdays" description="Students in the selected class with birthdays coming up.">
          <div className="space-y-3">
            {upcomingBirthdays.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
                <div>
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="text-sm text-slate-500">{formatDate(item.dob)}</p>
                </div>
                <div className="text-sm font-semibold text-slate-500">{daysUntil(item.dob)} days</div>
              </div>
            ))}
            {upcomingBirthdays.length === 0 ? <p className="text-sm text-slate-500">No student birthdays found.</p> : null}
          </div>
        </SectionCard>

        <SectionCard title="Send content to admin" description="Birthday photo, event suggestion or celebration images.">
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
            <button className="button-primary" type="submit">Send to admin</button>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Your submissions" description="Celebrate support items already sent to admin.">
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="form-input pl-11" onChange={(event) => setSubmissionsQuery(event.target.value)} placeholder="Search submissions" value={submissionsQuery} />
            </div>
            <DataTable
              columns={[
                { key: 'category', label: 'Type', render: (row) => <StatusBadge value={row.category} /> },
                { key: 'title', label: 'Title', render: (row) => row.title },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                { key: 'file', label: 'Image', render: (row) => row.file_url ? <a className="font-bold theme-text-primary" href={row.file_url} rel="noreferrer" target="_blank">View</a> : '-' },
                { key: 'created', label: 'Created', render: (row) => formatDateTime(row.created_at) },
              ]}
              emptyMessage="No submissions yet."
              rows={displayedSubmissions}
            />
          </div>
        </SectionCard>

        <SectionCard title="Published school creatives" description="Recent posts available from the school content studio.">
          <DataTable
            columns={[
              { key: 'title', label: 'Title', render: (row) => row.title },
              { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.post_type} /> },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              { key: 'schedule', label: 'Scheduled', render: (row) => formatDateTime(row.scheduled_for) },
            ]}
            emptyMessage="No published creatives yet."
            rows={publishedPosts}
          />
        </SectionCard>
      </div>
    </div>
  );
}
