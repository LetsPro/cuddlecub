import { useEffect, useState } from 'react';
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
    const channel = supabase
      .channel(`parent-requests-${parentRecord.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parent_requests', filter: `parent_id=eq.${parentRecord.id}` }, () => void loadRequests())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, student_id: event.target.value }))} required value={form.student_id}>
              <option value="">Select child</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name}
                </option>
              ))}
            </select>
            <input className="form-input" placeholder="Title" required onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} />
            <textarea className="form-input min-h-28" placeholder="Message" required onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} value={form.message} />
            <input className="form-input" type="date" onChange={(event) => setForm((current) => ({ ...current, requested_for: event.target.value }))} value={form.requested_for} />
            <input className="form-input" placeholder="Pickup person name (if applicable)" onChange={(event) => setForm((current) => ({ ...current, pickup_person_name: event.target.value }))} value={form.pickup_person_name} />
            <input className="form-input" placeholder="Pickup person phone (if applicable)" onChange={(event) => setForm((current) => ({ ...current, pickup_person_phone: event.target.value }))} value={form.pickup_person_phone} />
            <button className="button-primary" type="submit">Send request</button>
          </form>
        </SectionCard>

        <SectionCard title="Request history" description="Track request status and dates.">
          <div className="space-y-3">
            {requests.map((request) => (
              <article className="rounded-2xl border border-slate-100 bg-white p-4" key={request.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{request.title}</p><StatusBadge value={request.category} /></div><p className="mt-1 text-xs font-semibold text-slate-400">Sent {formatDateTime(request.created_at)}</p></div><StatusBadge value={request.status} /></div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{request.message}</p>
                {request.requested_for ? <p className="mt-2 text-xs font-semibold text-slate-400">Requested for {formatDate(request.requested_for)}</p> : null}
                {request.response_message ? (
                  <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">Response from {request.response_by_name || 'school'}</p><p className="mt-2 text-sm leading-6 text-slate-700">{request.response_message}</p>{request.responded_at ? <p className="mt-2 text-xs font-semibold text-slate-400">{formatDateTime(request.responded_at)}</p> : null}</div>
                ) : <p className="mt-3 text-sm text-slate-400">Waiting for school response.</p>}
              </article>
            ))}
            {!requests.length ? <p className="text-sm text-slate-500">No requests sent yet.</p> : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
