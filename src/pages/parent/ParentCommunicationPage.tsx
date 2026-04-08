import { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { useParentPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { NotificationRecord } from '../../types/app';

export function ParentCommunicationPage() {
  const { school } = useAppContext();
  const { message } = useParentPortal();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadCommunication();
  }, [school.id]);

  async function loadCommunication() {
    setLoadMessage(null);
    try {
      const { data, error } = await supabase.from('notifications').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      setNotifications((data ?? []) as NotificationRecord[]);
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communication"
        title="School notices, alerts and reminders"
        description="Review school notices, event reminders, holiday alerts, emergency messages and other updates sent through the parent communication channel."
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <SectionCard title="Communication history" description="Recent messages delivered through the school notification system.">
        <DataTable
          columns={[
            { key: 'title', label: 'Title', render: (row) => row.title },
            { key: 'message', label: 'Message', render: (row) => row.message },
            { key: 'channel', label: 'Channel', render: (row) => row.channel },
            { key: 'time', label: 'Sent / scheduled', render: (row) => formatDateTime(row.sent_at || row.scheduled_at) },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          ]}
          emptyMessage="No communication history found."
          rows={notifications}
        />
      </SectionCard>
    </div>
  );
}
