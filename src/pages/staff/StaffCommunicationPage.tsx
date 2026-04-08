import { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { useStaffPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { StaffRequest } from '../../types/app';

export function StaffCommunicationPage() {
  const { school } = useAppContext();
  const { staffRecord, students, message } = useStaffPortal();
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [form, setForm] = useState({
    category: 'update_request',
    student_id: '',
    title: '',
    message: '',
    file_url: '',
    priority: 'normal',
  });
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!staffRecord) return;
    void loadRequests();
  }, [staffRecord?.id]);

  async function loadRequests() {
    if (!staffRecord) return;

    try {
      const { data, error } = await supabase
        .from('staff_requests')
        .select('*')
        .eq('staff_id', staffRecord.id)
        .order('created_at', { ascending: false })
        .limit(40);

      if (error) throw error;
      setRequests((data ?? []) as StaffRequest[]);
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
        priority: form.priority,
      });

      if (error) throw error;
      setForm({ category: 'update_request', student_id: '', title: '', message: '', file_url: '', priority: 'normal' });
      await loadRequests();
      setSubmitMessage('Request submitted to admin.');
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communication Support"
        title="Requests, incidents and urgent flags"
        description="Send update requests to admin, submit notices for approval, share class photos, report incidents and flag urgent concerns."
      />

      {message || submitMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || submitMessage}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Create request" description="Anything that needs admin visibility or approval goes here.">
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} value={form.category}>
              <option value="update_request">Update request to admin</option>
              <option value="notice_approval">Notice for approval</option>
              <option value="class_photo">Share class photo</option>
              <option value="incident">Incident report</option>
              <option value="urgent_concern">Urgent student concern</option>
            </select>
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, student_id: event.target.value }))} value={form.student_id}>
              <option value="">No student specific link</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name}
                </option>
              ))}
            </select>
            <input className="form-input" placeholder="Title" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} />
            <textarea className="form-input min-h-28" placeholder="Message" onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} value={form.message} />
            <input className="form-input" placeholder="File or photo URL (optional)" onChange={(event) => setForm((current) => ({ ...current, file_url: event.target.value }))} value={form.file_url} />
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} value={form.priority}>
              <option value="normal">Normal priority</option>
              <option value="high">High priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <button className="button-primary" type="submit">Submit request</button>
          </form>
        </SectionCard>

        <SectionCard title="Request history" description="Track what you’ve submitted and its current status.">
          <DataTable
            columns={[
              { key: 'category', label: 'Category', render: (row) => <StatusBadge value={row.category} /> },
              { key: 'title', label: 'Title', render: (row) => row.title },
              { key: 'priority', label: 'Priority', render: (row) => <StatusBadge value={row.priority} /> },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              { key: 'created', label: 'Created', render: (row) => formatDateTime(row.created_at) },
            ]}
            emptyMessage="No requests created yet."
            rows={requests}
          />
        </SectionCard>
      </div>
    </div>
  );
}
