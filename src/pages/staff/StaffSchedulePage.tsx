import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { useStaffPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate, formatDateTime } from '../../lib/utils';
import type { EventRecord, TimetableEntry } from '../../types/app';

interface HolidayRecord {
  id: string;
  title: string;
  holiday_date: string;
  holiday_type: string;
}

export function StaffSchedulePage() {
  const { school } = useAppContext();
  const { staffRecord, message } = useStaffPortal();
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [timetableQuery, setTimetableQuery] = useState('');
  const [eventsQuery, setEventsQuery] = useState('');
  const [holidaysQuery, setHolidaysQuery] = useState('');

  useEffect(() => {
    if (!staffRecord) return;
    void loadSchedule();
  }, [staffRecord?.id, school.id]);

  async function loadSchedule() {
    setLoadMessage(null);

    try {
      const assignedClassIds = staffRecord?.assigned_class_ids ?? (staffRecord?.class_teacher_for ? [staffRecord.class_teacher_for] : []);
      const timetableQuery = supabase.from('timetable_entries').select('*').eq('school_id', school.id).order('weekday').order('start_time');
      const assignedTimetableQuery = assignedClassIds.length ? timetableQuery.in('class_id', assignedClassIds) : timetableQuery;
      const [timetableResponse, eventResponse, holidayResponse] = await Promise.all([
        assignedTimetableQuery,
        supabase.from('events').select('*').eq('school_id', school.id).order('start_at'),
        supabase.from('school_holidays').select('*').eq('school_id', school.id).order('holiday_date'),
      ]);

      if (timetableResponse.error) throw timetableResponse.error;
      if (eventResponse.error) throw eventResponse.error;
      if (holidayResponse.error) throw holidayResponse.error;

      setTimetableEntries((timetableResponse.data ?? []) as TimetableEntry[]);
      setEvents((eventResponse.data ?? []) as EventRecord[]);
      setHolidays((holidayResponse.data ?? []) as HolidayRecord[]);
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  const displayedTimetable = useMemo(() => {
    const q = timetableQuery.trim().toLowerCase();
    return q ? timetableEntries.filter((r) => r.title.toLowerCase().includes(q) || r.weekday.toLowerCase().includes(q)) : timetableEntries;
  }, [timetableEntries, timetableQuery]);

  const displayedEvents = useMemo(() => {
    const q = eventsQuery.trim().toLowerCase();
    return q ? events.filter((r) => r.title.toLowerCase().includes(q)) : events;
  }, [events, eventsQuery]);

  const displayedHolidays = useMemo(() => {
    const q = holidaysQuery.trim().toLowerCase();
    return q ? holidays.filter((r) => r.title.toLowerCase().includes(q) || r.holiday_date.includes(q)) : holidays;
  }, [holidays, holidaysQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Schedule & Calendar"
        title="Timetable, meetings and school calendar"
        description="Review your timetable, assigned events, school meetings and holiday calendar from one schedule view."
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Timetable" description="Your class routine and assigned activities.">
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="form-input pl-11" onChange={(event) => setTimetableQuery(event.target.value)} placeholder="Search by activity or day" value={timetableQuery} />
            </div>
            <DataTable
              columns={[
                { key: 'day', label: 'Day', render: (row) => row.weekday },
                { key: 'time', label: 'Time', render: (row) => `${row.start_time} - ${row.end_time}` },
                { key: 'title', label: 'Activity', render: (row) => row.title },
                { key: 'type', label: 'Category', render: (row) => <StatusBadge value={row.category ?? 'class'} /> },
              ]}
              emptyMessage="No timetable entries available."
              rows={displayedTimetable}
            />
          </div>
        </SectionCard>

        <SectionCard title="School event calendar" description="Upcoming events, meetings and special schedules.">
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="form-input pl-11" onChange={(event) => setEventsQuery(event.target.value)} placeholder="Search events" value={eventsQuery} />
            </div>
            <DataTable
              columns={[
                { key: 'title', label: 'Event', render: (row) => row.title },
                { key: 'time', label: 'Starts', render: (row) => formatDateTime(row.start_at) },
                { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.event_type} /> },
              ]}
              emptyMessage="No events scheduled."
              rows={displayedEvents}
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Holiday list" description="School closures and calendar exceptions.">
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="form-input pl-11" onChange={(event) => setHolidaysQuery(event.target.value)} placeholder="Search holidays" value={holidaysQuery} />
          </div>
          <DataTable
            columns={[
              { key: 'title', label: 'Holiday', render: (row) => row.title },
              { key: 'date', label: 'Date', render: (row) => formatDate(row.holiday_date) },
              { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.holiday_type} /> },
            ]}
            emptyMessage="No holidays configured."
            rows={displayedHolidays}
          />
        </div>
      </SectionCard>
    </div>
  );
}
