import { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { NotificationRecord } from '../../types/app';

const notificationSeed = {
  title: '',
  message: '',
  audience: 'class',
  status: 'scheduled',
  scheduled_at: '',
};

export function CommunicationPage() {
  const { school } = useAppContext();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notificationForm, setNotificationForm] = useState(notificationSeed);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadCommunication();
  }, [school.id]);

  async function loadCommunication() {
    setMessage(null);

    try {
      const notificationResponse = await supabase.from('notifications').select('*').eq('school_id', school.id).order('created_at', { ascending: false });
      if (notificationResponse.error) throw notificationResponse.error;
      setNotifications((notificationResponse.data ?? []) as NotificationRecord[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleNotificationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const { error } = await supabase.from('notifications').insert({
        school_id: school.id,
        title: notificationForm.title,
        message: notificationForm.message,
        channel: 'dashboard',
        audience: notificationForm.audience,
        status: notificationForm.status,
        scheduled_at: notificationForm.scheduled_at || null,
        sent_at: notificationForm.status === 'sent' ? new Date().toISOString() : null,
      });

      if (error) throw error;
      setNotificationForm(notificationSeed);
      await loadCommunication();
      setMessage('Notification queued in the log.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communication"
        title="Dashboard notices and communication logs"
        description="Create school notices that stay inside the dashboard feed for admins, staff and parents."
      />

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message}</div>
      ) : null}

      <div className="grid gap-6">
        <SectionCard title="Create dashboard notice" description="Log single, class-wise or school-wide notices that stay on the dashboard only.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleNotificationSubmit}>
            <div className="md:col-span-2">
              <label className="form-label">Title</label>
              <input className="form-input" onChange={(event) => setNotificationForm((current) => ({ ...current, title: event.target.value }))} value={notificationForm.title} />
            </div>
            <div>
              <label className="form-label">Audience</label>
              <select className="form-input" onChange={(event) => setNotificationForm((current) => ({ ...current, audience: event.target.value }))} value={notificationForm.audience}>
                <option value="single_parent">Single parent</option>
                <option value="class">Class-wise</option>
                <option value="school_wide">School-wide</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" onChange={(event) => setNotificationForm((current) => ({ ...current, status: event.target.value }))} value={notificationForm.status}>
                <option value="scheduled">Scheduled</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div>
              <label className="form-label">Scheduled for</label>
              <input className="form-input" onChange={(event) => setNotificationForm((current) => ({ ...current, scheduled_at: event.target.value }))} type="datetime-local" value={notificationForm.scheduled_at} />
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500">
              Delivery channel is fixed to <span className="font-semibold text-slate-800">Dashboard only</span>.
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Message</label>
              <textarea className="form-input min-h-28" onChange={(event) => setNotificationForm((current) => ({ ...current, message: event.target.value }))} value={notificationForm.message} />
            </div>
            <div className="md:col-span-2">
              <button className="button-primary" type="submit">
                Save notification
              </button>
            </div>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-6">
        <SectionCard title="Notification history" description="Recent dashboard communication activity with delivery status.">
          <DataTable
            columns={[
              { key: 'title', label: 'Title', render: (row) => <span className="font-bold">{row.title}</span> },
              { key: 'audience', label: 'Audience', render: (row) => row.audience },
              { key: 'time', label: 'Scheduled / sent', render: (row) => (row.sent_at ? formatDateTime(row.sent_at) : formatDateTime(row.scheduled_at)) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            ]}
            emptyMessage="No notifications logged."
            rows={notifications}
          />
        </SectionCard>
      </div>
    </div>
  );
}
