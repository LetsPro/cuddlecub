import { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { fetchAssignedClassIdsForStaff } from '../../lib/portal-data';
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

  useEffect(() => {
    if (!staffRecord) return;
    void loadSchedule();
  }, [staffRecord?.id, school.id]);

  async function loadSchedule() {
    setLoadMessage(null);

    try {
      const assignedClassIds = staffRecord ? await fetchAssignedClassIdsForStaff(staffRecord, school.id) : [];
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
          <DataTable
            columns={[
              { key: 'day', label: 'Day', render: (row) => row.weekday },
              { key: 'time', label: 'Time', render: (row) => `${row.start_time} - ${row.end_time}` },
              { key: 'title', label: 'Activity', render: (row) => row.title },
              { key: 'type', label: 'Category', render: (row) => <StatusBadge value={row.category ?? 'class'} /> },
            ]}
            emptyMessage="No timetable entries available."
            rows={timetableEntries}
          />
        </SectionCard>

        <SectionCard title="School event calendar" description="Upcoming events, meetings and special schedules.">
          <DataTable
            columns={[
              { key: 'title', label: 'Event', render: (row) => row.title },
              { key: 'time', label: 'Starts', render: (row) => formatDateTime(row.start_at) },
              { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.event_type} /> },
            ]}
            emptyMessage="No events scheduled."
            rows={events}
          />
        </SectionCard>
      </div>

      <SectionCard title="Holiday list" description="School closures and calendar exceptions.">
        <DataTable
          columns={[
            { key: 'title', label: 'Holiday', render: (row) => row.title },
            { key: 'date', label: 'Date', render: (row) => formatDate(row.holiday_date) },
            { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.holiday_type} /> },
          ]}
          emptyMessage="No holidays configured."
          rows={holidays}
        />
      </SectionCard>
    </div>
  );
}
