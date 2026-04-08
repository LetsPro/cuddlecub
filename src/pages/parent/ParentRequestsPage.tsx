import { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { useParentPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate, formatDateTime } from '../../lib/utils';
import type { ParentRequest } from '../../types/app';

export function ParentRequestsPage() {
  const { school } = useAppContext();
  const { parentRecord, students, message } = useParentPortal();
  const [requests, setRequests] = useState<ParentRequest[]>([]);
  const [form, setForm] = useState({
    category: 'leave',
    student_id: '',
    title: '',
    message: '',
    requested_for: '',
    pickup_person_name: '',
    pickup_person_phone: '',
  });
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!parentRecord) return;
    void loadRequests();
  }, [parentRecord?.id]);

  async function loadRequests() {
    if (!parentRecord) return;
    try {
      const { data, error } = await supabase.from('parent_requests').select('*').eq('parent_id', parentRecord.id).order('created_at', { ascending: false }).limit(40);
      if (error) throw error;
      setRequests((data ?? []) as ParentRequest[]);
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parentRecord) return;
    setSubmitMessage(null);

    try {
      const { error } = await supabase.from('parent_requests').insert({
        school_id: school.id,
        parent_id: parentRecord.id,
        student_id: form.student_id || null,
        category: form.category,
        title: form.title,
        message: form.message,
        requested_for: form.requested_for || null,
        pickup_person_name: form.pickup_person_name || null,
        pickup_person_phone: form.pickup_person_phone || null,
        status: 'submitted',
      });

      if (error) throw error;
      setForm({ category: 'leave', student_id: '', title: '', message: '', requested_for: '', pickup_person_name: '', pickup_person_phone: '' });
      await loadRequests();
      setSubmitMessage('Request sent to school.');
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leave & Requests"
        title="Leave, pickup authorization and school notes"
        description="Apply leave for your child, send pickup authorization, share a note, or request a meeting or callback."
      />

      {message || submitMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || submitMessage}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="New request" description="Send a new request to the school.">
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} value={form.category}>
              <option value="leave">Apply leave</option>
              <option value="pickup_authorization">Pickup authorization</option>
              <option value="note">Note to school</option>
              <option value="meeting">Request meeting</option>
              <option value="callback">Request callback</option>
            </select>
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, student_id: event.target.value }))} value={form.student_id}>
              <option value="">Select child</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name}
                </option>
              ))}
            </select>
            <input className="form-input" placeholder="Title" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} />
            <textarea className="form-input min-h-28" placeholder="Message" onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} value={form.message} />
            <input className="form-input" type="date" onChange={(event) => setForm((current) => ({ ...current, requested_for: event.target.value }))} value={form.requested_for} />
            <input className="form-input" placeholder="Pickup person name (if applicable)" onChange={(event) => setForm((current) => ({ ...current, pickup_person_name: event.target.value }))} value={form.pickup_person_name} />
            <input className="form-input" placeholder="Pickup person phone (if applicable)" onChange={(event) => setForm((current) => ({ ...current, pickup_person_phone: event.target.value }))} value={form.pickup_person_phone} />
            <button className="button-primary" type="submit">Send request</button>
          </form>
        </SectionCard>

        <SectionCard title="Request history" description="Track request status and dates.">
          <DataTable
            columns={[
              { key: 'category', label: 'Type', render: (row) => <StatusBadge value={row.category} /> },
              { key: 'title', label: 'Title', render: (row) => row.title },
              { key: 'for', label: 'Requested for', render: (row) => formatDate(row.requested_for) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              { key: 'created', label: 'Created', render: (row) => formatDateTime(row.created_at) },
            ]}
            emptyMessage="No requests sent yet."
            rows={requests}
          />
        </SectionCard>
      </div>
    </div>
  );
}
