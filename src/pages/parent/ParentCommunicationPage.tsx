import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { filterVisibleNotifications } from '../../lib/notifications';
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
      const { data, error } = await supabase.from('notifications').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(80);
      if (error) throw error;
      setNotifications(filterVisibleNotifications((data ?? []) as NotificationRecord[], 50));
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
        <div className="space-y-3">
          {notifications.map((notification) => (
            <article className="rounded-2xl border border-slate-100 bg-white p-4" key={notification.id}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{notification.title}</p><p className="mt-1 text-xs font-semibold text-slate-400">{formatDateTime(notification.sent_at || notification.scheduled_at)}</p></div><StatusBadge value={notification.status} /></div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{notification.message}</p>
              {notification.attachment_url ? <a className="mt-3 inline-flex text-sm font-bold theme-text-primary" href={notification.attachment_url} rel="noreferrer" target="_blank">View attachment</a> : null}
            </article>
          ))}
          {!notifications.length ? <p className="text-sm text-slate-500">No communication history found.</p> : null}
        </div>
      </SectionCard>
    </div>
  );
}
