import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, PencilLine, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { ToastMessage } from '../../lib/toast';
import { formatDateTime } from '../../lib/utils';
import type { EventRecord } from '../../types/app';

interface HolidayRecord {
  id: string;
  title: string;
  holiday_date: string;
  holiday_type: string;
}

const eventSeed = {
  title: '',
  event_type: 'event',
  start_at: '',
  end_at: '',
  target_audience: 'parents',
  description: '',
};

function toDateTimeInput(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function EventsPage() {
  const { school } = useAppContext();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [form, setForm] = useState(eventSeed);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void loadEvents();
  }, [school.id]);

  async function loadEvents() {
    setMessage(null);

    try {
      const [eventResponse, holidayResponse] = await Promise.all([
        supabase.from('events').select('*').eq('school_id', school.id).order('start_at'),
        supabase.from('school_holidays').select('*').eq('school_id', school.id).order('holiday_date'),
      ]);

      if (eventResponse.error) throw eventResponse.error;
      if (holidayResponse.error) throw holidayResponse.error;

      setEvents((eventResponse.data ?? []) as EventRecord[]);
      setHolidays((holidayResponse.data ?? []) as HolidayRecord[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function openCreateModal() {
    setEditingEventId(null);
    setForm(eventSeed);
    setIsFormModalOpen(true);
  }

  function openEditModal(eventRow: EventRecord) {
    setEditingEventId(eventRow.id);
    setForm({
      title: eventRow.title,
      event_type: eventRow.event_type,
      start_at: toDateTimeInput(eventRow.start_at),
      end_at: toDateTimeInput(eventRow.end_at),
      target_audience: eventRow.target_audience ?? 'parents',
      description: eventRow.description ?? '',
    });
    setIsFormModalOpen(true);
  }

  function closeFormModal() {
    setEditingEventId(null);
    setForm(eventSeed);
    setIsFormModalOpen(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const payload = {
        school_id: school.id,
        title: form.title,
        event_type: form.event_type,
        start_at: form.start_at,
        end_at: form.end_at || null,
        target_audience: form.target_audience || null,
        description: form.description || null,
      };

      if (editingEventId) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingEventId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('events').insert(payload);
        if (error) throw error;
      }

      await loadEvents();
      closeFormModal();
      setMessage(editingEventId ? 'Event updated.' : 'Event added to the calendar.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteEvent(eventRow: EventRecord) {
    const confirmed = window.confirm(`Delete ${eventRow.title}? This will remove the event from the school calendar.`);

    if (!confirmed) {
      return;
    }

    setBusyDeleteId(eventRow.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('events').delete().eq('id', eventRow.id);
      if (error) throw error;

      await loadEvents();
      closeFormModal();
      setMessage('Event deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  const summary = useMemo(
    () => ({
      total: events.length,
      schoolWide: events.filter((event) => (event.target_audience ?? 'school_wide') === 'school_wide').length,
      meetings: events.filter((event) => event.event_type === 'meeting').length,
      holidays: holidays.length,
    }),
    [events, holidays.length],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Events & Calendar"
        title="Events, holidays and important dates"
        description="Manage school functions, meetings, competitions and reminder-ready calendar items in a cleaner event directory."
        actions={
          <button className="button-primary gap-2" onClick={openCreateModal} type="button">
            <CalendarPlus className="h-4 w-4" />
            Add event
          </button>
        }
      />
      <ToastMessage message={message} />

      <SectionCard
        title="Event list"
        description="School calendar items with quick edit access and clean scheduling details."
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{summary.total} events</span>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{summary.schoolWide} school-wide</span>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{summary.meetings} meetings</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{summary.holidays} holidays</span>
          </div>
        }
      >
        <DataTable
          columns={[
            { key: 'title', label: 'Event', render: (row) => <span className="font-bold text-slate-900">{row.title}</span> },
            { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.event_type} /> },
            {
              key: 'schedule',
              label: 'Schedule',
              render: (row) => (
                <div>
                  <p className="text-slate-700">{formatDateTime(row.start_at)}</p>
                  <p className="text-xs text-slate-500">{row.end_at ? `Ends ${formatDateTime(row.end_at)}` : 'Single time slot'}</p>
                </div>
              ),
            },
            { key: 'audience', label: 'Audience', render: (row) => row.target_audience ?? 'School' },
            {
              key: 'action',
              label: 'Action',
              render: (row) => (
                <button className="button-secondary px-3 py-2 text-xs" onClick={() => openEditModal(row)} type="button">
                  <PencilLine className="mr-1 h-3.5 w-3.5" />
                  Edit
                </button>
              ),
            },
          ]}
          emptyMessage="No events created yet."
          rows={events}
        />
      </SectionCard>

      <SectionCard title="Holiday list" description="Configured calendar closures and special off-days.">
        <DataTable
          columns={[
            { key: 'title', label: 'Holiday', render: (row) => <span className="font-bold">{row.title}</span> },
            { key: 'date', label: 'Date', render: (row) => row.holiday_date },
            { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.holiday_type} /> },
          ]}
          emptyMessage="No holidays available."
          rows={holidays}
        />
      </SectionCard>

      <Modal
        description="Create a new calendar item or update an existing one without leaving the event directory."
        onClose={closeFormModal}
        open={isFormModalOpen}
        title={editingEventId ? 'Edit event' : 'Add event'}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Event title"
              required
              value={form.title}
            />
          </div>
          <div>
            <label className="form-label">Type</label>
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, event_type: event.target.value }))} value={form.event_type}>
              <option value="event">Event</option>
              <option value="meeting">Parent meeting</option>
              <option value="competition">Competition</option>
              <option value="celebration">Celebration</option>
              <option value="reminder">Reminder</option>
            </select>
          </div>
          <div>
            <label className="form-label">Audience</label>
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, target_audience: event.target.value }))} value={form.target_audience}>
              <option value="parents">Parents</option>
              <option value="staff">Staff</option>
              <option value="school_wide">School-wide</option>
              <option value="class_wise">Class-wise</option>
            </select>
          </div>
          <div>
            <label className="form-label">Start at</label>
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, start_at: event.target.value }))} required type="datetime-local" value={form.start_at} />
          </div>
          <div>
            <label className="form-label">End at</label>
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, end_at: event.target.value }))} type="datetime-local" value={form.end_at} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Description</label>
            <textarea
              className="form-input min-h-28"
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Description or reminder note"
              value={form.description}
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            {editingEventId ? (
              <button
                className="button-danger mr-auto gap-2"
                disabled={busyDeleteId === editingEventId}
                onClick={() => {
                  const currentEvent = events.find((eventRow) => eventRow.id === editingEventId);
                  if (currentEvent) {
                    void handleDeleteEvent(currentEvent);
                  }
                }}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
                {busyDeleteId === editingEventId ? 'Deleting...' : 'Delete event'}
              </button>
            ) : null}
            <button className="button-secondary" onClick={closeFormModal} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingEventId ? 'Save changes' : 'Save event'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
