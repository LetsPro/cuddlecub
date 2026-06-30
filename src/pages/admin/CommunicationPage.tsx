import { useEffect, useState } from 'react';
import { FileText, Paperclip, PencilLine, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { ParentRequestQueue } from '../../components/ParentRequestQueue';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { uploadMediaAsset } from '../../lib/media';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate, formatDateTime } from '../../lib/utils';
import type { NotificationRecord } from '../../types/app';

const notificationSeed = {
  title: '',
  message: '',
  audience: 'class',
  status: 'scheduled',
  scheduled_at: '',
  visible_from: '',
  visible_to: '',
  attachment_url: '',
};

export function CommunicationPage() {
  const { profile, school } = useAppContext();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notificationForm, setNotificationForm] = useState(notificationSeed);
  const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
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

    if (notificationForm.visible_from && notificationForm.visible_to && notificationForm.visible_to < notificationForm.visible_from) {
      setMessage('Show to date cannot be before show from date.');
      return;
    }

    try {
      setUploadingAttachment(Boolean(attachmentFile));
      const attachmentUrl = attachmentFile
        ? (
            await uploadMediaAsset({
              schoolId: school.id,
              userId: profile.user_id,
              file: attachmentFile,
              label: `${notificationForm.title || 'Notice'} attachment`,
            })
          ).public_url
        : notificationForm.attachment_url || null;

      const payload = {
        school_id: school.id,
        title: notificationForm.title,
        message: notificationForm.message,
        channel: 'dashboard',
        audience: notificationForm.audience,
        status: notificationForm.status,
        scheduled_at: notificationForm.scheduled_at || null,
        sent_at: notificationForm.status === 'sent' ? new Date().toISOString() : null,
        visible_from: notificationForm.visible_from || null,
        visible_to: notificationForm.visible_to || null,
        attachment_url: attachmentUrl,
      };

      const { error } = editingNotificationId
        ? await supabase.from('notifications').update(payload).eq('id', editingNotificationId)
        : await supabase.from('notifications').insert(payload);

      if (error) throw error;
      setNotificationForm(notificationSeed);
      setEditingNotificationId(null);
      setAttachmentFile(null);
      await loadCommunication();
      setMessage(editingNotificationId ? 'Notification updated.' : 'Notification queued in the log.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setUploadingAttachment(false);
    }
  }

  function editNotification(notification: NotificationRecord) {
    setEditingNotificationId(notification.id);
    setAttachmentFile(null);
    setNotificationForm({
      title: notification.title,
      message: notification.message,
      audience: notification.audience,
      status: notification.status,
      scheduled_at: notification.scheduled_at ? notification.scheduled_at.slice(0, 16) : '',
      visible_from: notification.visible_from ?? '',
      visible_to: notification.visible_to ?? '',
      attachment_url: notification.attachment_url ?? '',
    });
  }

  function resetNotificationForm() {
    setEditingNotificationId(null);
    setAttachmentFile(null);
    setNotificationForm(notificationSeed);
  }

  async function deleteNotification(notification: NotificationRecord) {
    const confirmed = window.confirm(`Delete notification "${notification.title}"?`);
    if (!confirmed) return;

    setBusyDeleteId(notification.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('notifications').delete().eq('id', notification.id);
      if (error) throw error;
      if (editingNotificationId === notification.id) {
        resetNotificationForm();
      }
      await loadCommunication();
      setMessage('Notification deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
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

      <ParentRequestQueue description="All parent requests for the school. Review them, update status, and send a response." title="Requests from parents" />

      <div className="grid gap-6">
        <SectionCard title={editingNotificationId ? 'Edit dashboard notice' : 'Create dashboard notice'} description="Log single, class-wise or school-wide notices that stay on the dashboard only.">
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
            <div>
              <label className="form-label">Show from</label>
              <input className="form-input" onChange={(event) => setNotificationForm((current) => ({ ...current, visible_from: event.target.value }))} type="date" value={notificationForm.visible_from} />
            </div>
            <div>
              <label className="form-label">Show to</label>
              <input className="form-input" min={notificationForm.visible_from || undefined} onChange={(event) => setNotificationForm((current) => ({ ...current, visible_to: event.target.value }))} type="date" value={notificationForm.visible_to} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500">
              Delivery channel is fixed to <span className="font-semibold text-slate-800">Dashboard only</span>.
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Message</label>
              <textarea className="form-input min-h-28" onChange={(event) => setNotificationForm((current) => ({ ...current, message: event.target.value }))} value={notificationForm.message} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Attachment</label>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                <input
                  accept="image/*,application/pdf"
                  className="form-input"
                  onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
                <input
                  className="form-input"
                  onChange={(event) => setNotificationForm((current) => ({ ...current, attachment_url: event.target.value }))}
                  placeholder="Or paste PDF/image URL"
                  value={notificationForm.attachment_url}
                />
              </div>
              {attachmentFile ? (
                <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Paperclip className="h-3.5 w-3.5" />
                  {attachmentFile.name}
                </p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <div className="flex flex-wrap justify-end gap-3">
                {editingNotificationId ? <button className="button-secondary" onClick={resetNotificationForm} type="button">Cancel edit</button> : null}
                <button className="button-primary" disabled={uploadingAttachment} type="submit">
                  {uploadingAttachment ? 'Uploading attachment...' : editingNotificationId ? 'Update notification' : 'Save notification'}
                </button>
              </div>
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
              { key: 'visible', label: 'Visible dates', render: (row) => `${row.visible_from ? formatDate(row.visible_from) : 'Now'} - ${row.visible_to ? formatDate(row.visible_to) : 'No end date'}` },
              {
                key: 'attachment',
                label: 'Attachment',
                render: (row) =>
                  row.attachment_url ? (
                    <a className="inline-flex items-center gap-1 text-sm font-bold theme-text-primary" href={row.attachment_url} rel="noreferrer" target="_blank">
                      <FileText className="h-4 w-4" />
                      View
                    </a>
                  ) : (
                    <span className="text-slate-400">None</span>
                  ),
              },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              {
                key: 'action',
                label: 'Action',
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary px-3 py-2 text-xs" onClick={() => editNotification(row)} type="button">
                      <PencilLine className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button className="button-danger px-3 py-2 text-xs" disabled={busyDeleteId === row.id} onClick={() => void deleteNotification(row)} type="button">
                      <Trash2 className="h-3.5 w-3.5" />
                      {busyDeleteId === row.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ),
              },
            ]}
            emptyMessage="No notifications logged."
            rows={notifications}
          />
        </SectionCard>
      </div>
    </div>
  );
}
