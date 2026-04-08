import { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { NotificationRecord } from '../../types/app';

interface TemplateRecord {
  id: string;
  name: string;
  audience: string;
  template_type: string;
  body: string;
  is_approved: boolean;
}

const templateSeed = {
  name: '',
  audience: 'parents',
  template_type: 'custom_announcement',
  body: '',
};

const notificationSeed = {
  title: '',
  message: '',
  channel: 'whatsapp',
  audience: 'class',
  status: 'scheduled',
  scheduled_at: '',
};

export function CommunicationPage() {
  const { school } = useAppContext();
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [templateForm, setTemplateForm] = useState(templateSeed);
  const [notificationForm, setNotificationForm] = useState(notificationSeed);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadCommunication();
  }, [school.id]);

  async function loadCommunication() {
    setMessage(null);

    try {
      const [templateResponse, notificationResponse] = await Promise.all([
        supabase.from('whatsapp_templates').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
        supabase.from('notifications').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
      ]);

      setTemplates((templateResponse.data ?? []) as TemplateRecord[]);
      setNotifications((notificationResponse.data ?? []) as NotificationRecord[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleTemplateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const { error } = await supabase.from('whatsapp_templates').insert({
        school_id: school.id,
        name: templateForm.name,
        audience: templateForm.audience,
        template_type: templateForm.template_type,
        body: templateForm.body,
        is_approved: true,
      });

      if (error) throw error;
      setTemplateForm(templateSeed);
      await loadCommunication();
      setMessage('WhatsApp template added.');
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
        channel: notificationForm.channel,
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
        title="WhatsApp-ready notices and communication logs"
        description="Prepare approved templates, create fee reminders, absence alerts, holiday notices and school-wide announcements ready for AiSensy integration."
      />

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Approved template management" description="Save reusable templates for common school messages.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleTemplateSubmit}>
            <div>
              <label className="form-label">Template name</label>
              <input className="form-input" onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} value={templateForm.name} />
            </div>
            <div>
              <label className="form-label">Audience</label>
              <select className="form-input" onChange={(event) => setTemplateForm((current) => ({ ...current, audience: event.target.value }))} value={templateForm.audience}>
                <option value="parents">Parents</option>
                <option value="staff">Staff</option>
                <option value="school_wide">School-wide</option>
                <option value="class_wise">Class-wise</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Template type</label>
              <select className="form-input" onChange={(event) => setTemplateForm((current) => ({ ...current, template_type: event.target.value }))} value={templateForm.template_type}>
                <option value="admission_confirmation">Admission confirmation</option>
                <option value="fee_due">Fee due reminder</option>
                <option value="fee_paid">Fee paid confirmation</option>
                <option value="absence_alert">Absence alert</option>
                <option value="holiday_notice">Holiday notice</option>
                <option value="event_invite">Event invitation</option>
                <option value="custom_announcement">Custom announcement</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Template body</label>
              <textarea className="form-input min-h-28" onChange={(event) => setTemplateForm((current) => ({ ...current, body: event.target.value }))} value={templateForm.body} />
            </div>
            <div className="md:col-span-2">
              <button className="button-primary" type="submit">
                Save template
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Create notification" description="Log single, class-wise or school-wide communication items.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleNotificationSubmit}>
            <div className="md:col-span-2">
              <label className="form-label">Title</label>
              <input className="form-input" onChange={(event) => setNotificationForm((current) => ({ ...current, title: event.target.value }))} value={notificationForm.title} />
            </div>
            <div>
              <label className="form-label">Channel</label>
              <select className="form-input" onChange={(event) => setNotificationForm((current) => ({ ...current, channel: event.target.value }))} value={notificationForm.channel}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="dashboard">Dashboard only</option>
              </select>
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

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Template library" description="Current templates configured for recurrent workflows.">
          <DataTable
            columns={[
              { key: 'name', label: 'Template', render: (row) => <span className="font-bold">{row.name}</span> },
              { key: 'audience', label: 'Audience', render: (row) => row.audience },
              { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.template_type} /> },
              { key: 'approval', label: 'Approval', render: (row) => <StatusBadge value={row.is_approved ? 'approved' : 'pending'} /> },
            ]}
            emptyMessage="No templates created yet."
            rows={templates}
          />
        </SectionCard>

        <SectionCard title="Notification history" description="Recent communication activity with delivery status.">
          <DataTable
            columns={[
              { key: 'title', label: 'Title', render: (row) => <span className="font-bold">{row.title}</span> },
              { key: 'channel', label: 'Channel', render: (row) => row.channel },
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
