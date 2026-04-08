import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { buildStudentNameMap } from '../../lib/portal-data';
import { useParentPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { DailyActivityRecord, StudentProgressNote } from '../../types/app';

export function ParentDailyActivityPage() {
  const { students, message } = useParentPortal();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [activities, setActivities] = useState<DailyActivityRecord[]>([]);
  const [notes, setNotes] = useState<StudentProgressNote[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  const studentNameMap = useMemo(() => buildStudentNameMap(students), [students]);

  useEffect(() => {
    if (!students.length) return;
    setSelectedStudentId((current) => current || students[0].id);
    void loadActivityData();
  }, [students.map((student) => student.id).join('|')]);

  async function loadActivityData() {
    setLoadMessage(null);
    try {
      const [activityResponse, noteResponse] = await Promise.all([
        supabase.from('daily_activity_logs').select('*').in('student_id', students.map((student) => student.id)).order('activity_date', { ascending: false }).limit(80),
        supabase.from('student_progress_notes').select('*').in('student_id', students.map((student) => student.id)).eq('shared_with_parent', true).order('created_at', { ascending: false }).limit(50),
      ]);

      if (activityResponse.error) throw activityResponse.error;
      if (noteResponse.error) throw noteResponse.error;

      setActivities((activityResponse.data ?? []) as DailyActivityRecord[]);
      setNotes((noteResponse.data ?? []) as StudentProgressNote[]);
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  const filteredActivities = selectedStudentId ? activities.filter((activity) => activity.student_id === selectedStudentId) : activities;
  const filteredNotes = selectedStudentId ? notes.filter((note) => note.student_id === selectedStudentId) : notes;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily Activity"
        title="Meals, naps, mood and learning progress"
        description="View your child’s meal updates, nap records, washroom logs, mood notes, learning activities, observations and pickup information."
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <SectionCard title="Select child" description="Switch between linked children.">
        <select className="form-input max-w-sm" onChange={(event) => setSelectedStudentId(event.target.value)} value={selectedStudentId}>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.first_name} {student.last_name}
            </option>
          ))}
        </select>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Daily updates" description="The latest care and classroom updates shared for the selected child.">
          <DataTable
            columns={[
              { key: 'child', label: 'Child', render: (row) => studentNameMap[row.student_id] ?? 'Unknown child' },
              { key: 'date', label: 'Date', render: (row) => formatDate(row.activity_date) },
              { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.activity_type} /> },
              { key: 'summary', label: 'Summary', render: (row) => row.summary },
              { key: 'status', label: 'Tag', render: (row) => <StatusBadge value={row.status ?? 'logged'} /> },
            ]}
            emptyMessage="No daily activity updates found."
            rows={filteredActivities}
          />
        </SectionCard>

        <SectionCard title="Teacher observations" description="Progress notes explicitly shared with parents.">
          <DataTable
            columns={[
              { key: 'child', label: 'Child', render: (row) => studentNameMap[row.student_id] ?? 'Unknown child' },
              { key: 'title', label: 'Note', render: (row) => row.title },
              { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.note_type} /> },
              { key: 'summary', label: 'Summary', render: (row) => row.summary },
            ]}
            emptyMessage="No progress notes shared yet."
            rows={filteredNotes}
          />
        </SectionCard>
      </div>
    </div>
  );
}
