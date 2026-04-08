import { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { useParentPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate, formatDateTime } from '../../lib/utils';
import type { ContentPost, EventRecord } from '../../types/app';

interface HolidayRecord {
  id: string;
  title: string;
  holiday_date: string;
  holiday_type: string;
}

export function ParentEventsPage() {
  const { school } = useAppContext();
  const { message } = useParentPortal();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadEvents();
  }, [school.id]);

  async function loadEvents() {
    setLoadMessage(null);

    try {
      const [eventResponse, holidayResponse, postResponse] = await Promise.all([
        supabase.from('events').select('*').eq('school_id', school.id).order('start_at'),
        supabase.from('school_holidays').select('*').eq('school_id', school.id).order('holiday_date'),
        supabase.from('content_posts').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(24),
      ]);

      if (eventResponse.error) throw eventResponse.error;
      if (holidayResponse.error) throw holidayResponse.error;
      if (postResponse.error) throw postResponse.error;

      setEvents((eventResponse.data ?? []) as EventRecord[]);
      setHolidays((holidayResponse.data ?? []) as HolidayRecord[]);
      setPosts((postResponse.data ?? []) as ContentPost[]);
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Events & Media"
        title="Upcoming events, shared photos and school creatives"
        description="Browse school events, holiday dates and the shared media or creative posts published by the school."
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Upcoming events" description="School dates and event details.">
          <DataTable
            columns={[
              { key: 'title', label: 'Event', render: (row) => row.title },
              { key: 'time', label: 'Starts', render: (row) => formatDateTime(row.start_at) },
              { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.event_type} /> },
              { key: 'audience', label: 'Audience', render: (row) => row.target_audience ?? 'School' },
            ]}
            emptyMessage="No events scheduled."
            rows={events}
          />
        </SectionCard>

        <SectionCard title="Holiday list" description="School closure dates and special breaks.">
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

      <SectionCard title="Shared photos and creatives" description="Recent media and celebration posts published by the school.">
        <DataTable
          columns={[
            { key: 'title', label: 'Post', render: (row) => row.title },
            { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.post_type} /> },
            { key: 'caption', label: 'Caption', render: (row) => row.caption ?? 'Shared creative' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          ]}
          emptyMessage="No shared posts available."
          rows={posts}
        />
      </SectionCard>
    </div>
  );
}
