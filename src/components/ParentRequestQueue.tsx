import { useEffect, useState } from 'react';
import { MessageSquareReply } from 'lucide-react';
import { Modal } from './Modal';
import { SectionCard } from './SectionCard';
import { StatusBadge } from './StatusBadge';
import { useAppContext } from '../lib/app-context';
import { getErrorMessage, supabase } from '../lib/supabase';
import { formatDate, formatDateTime } from '../lib/utils';
import type { ParentRequest } from '../types/app';

interface RequestWithStudent extends ParentRequest {
  students?: { first_name: string; last_name: string; class_id: string | null; section_id: string | null } | null;
}

interface ParentRequestQueueProps {
  studentIds?: string[];
  title?: string;
  description?: string;
}

export function ParentRequestQueue({ studentIds, title = 'Parent requests', description = 'Review requests and send a response to the parent.' }: ParentRequestQueueProps) {
  const { profile, school } = useAppContext();
  const [requests, setRequests] = useState<RequestWithStudent[]>([]);
  const [selected, setSelected] = useState<RequestWithStudent | null>(null);
  const [status, setStatus] = useState('reviewed');
  const [response, setResponse] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (studentIds && !studentIds.length) {
      setRequests([]);
      return undefined;
    }
    void loadRequests();
    const channel = supabase
      .channel(`parent-request-queue-${profile.role}-${school.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parent_requests', filter: `school_id=eq.${school.id}` }, () => void loadRequests())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [school.id, studentIds?.join('|')]);

  async function loadRequests() {
    setMessage(null);
    try {
      let query = supabase.from('parent_requests').select('*, students(first_name, last_name, class_id, section_id)').eq('school_id', school.id).order('created_at', { ascending: false }).limit(80);
      if (studentIds) query = query.in('student_id', studentIds);
      const { data, error } = await query;
      if (error) throw error;
      setRequests((data ?? []) as RequestWithStudent[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function openResponse(request: RequestWithStudent) {
    setSelected(request);
    setStatus(request.status === 'submitted' ? 'reviewed' : request.status);
    setResponse(request.response_message ?? '');
    setMessage(null);
  }

  async function saveResponse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase.from('parent_requests').update({
        status,
        response_message: response,
        response_by_name: profile.full_name || (profile.role === 'admin' ? 'School admin' : 'Teacher'),
        response_by_role: profile.role,
        responded_at: new Date().toISOString(),
      }).eq('id', selected.id);
      if (error) throw error;
      setSelected(null);
      await loadRequests();
      setMessage('Response sent to parent.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionCard title={title} description={description}>
        {message ? <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div> : null}
        <div className="space-y-3">
          {requests.map((request) => {
            const studentName = request.students ? `${request.students.first_name} ${request.students.last_name}` : 'General request';
            return (
              <article className="rounded-2xl border border-slate-100 bg-white p-4" key={request.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{request.title}</p><StatusBadge value={request.category} /></div><p className="mt-1 text-sm text-slate-500">{studentName} · {formatDateTime(request.created_at)}</p></div>
                  <StatusBadge value={request.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{request.message}</p>
                {request.requested_for ? <p className="mt-2 text-xs font-semibold text-slate-400">Requested for {formatDate(request.requested_for)}</p> : null}
                {request.response_message ? <div className="mt-3 rounded-2xl bg-teal-50 p-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">Latest response</p><p className="mt-1 text-sm text-slate-700">{request.response_message}</p></div> : null}
                <button className="button-secondary mt-4 gap-2 px-3 py-2 text-xs" onClick={() => openResponse(request)} type="button"><MessageSquareReply className="h-4 w-4" />{request.response_message ? 'Update response' : 'Respond'}</button>
              </article>
            );
          })}
          {!requests.length ? <p className="text-sm text-slate-500">No parent requests available.</p> : null}
        </div>
      </SectionCard>

      <Modal description="Update the request status and write a reply visible in the parent portal." onClose={() => setSelected(null)} open={Boolean(selected)} title="Respond to parent request">
        <form className="space-y-4" onSubmit={saveResponse}>
          <div><label className="form-label">Status</label><select className="form-input" onChange={(event) => setStatus(event.target.value)} value={status}><option value="reviewed">Reviewed</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="completed">Completed</option><option value="needs_information">Needs information</option></select></div>
          <div><label className="form-label">Response to parent</label><textarea className="form-input min-h-32" onChange={(event) => setResponse(event.target.value)} required value={response} /></div>
          <div className="flex justify-end gap-3"><button className="button-secondary" onClick={() => setSelected(null)} type="button">Cancel</button><button className="button-primary" disabled={saving} type="submit">{saving ? 'Sending...' : 'Send response'}</button></div>
        </form>
      </Modal>
    </>
  );
}
