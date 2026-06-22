import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
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
          <div className="space-y-4">
            {filteredActivities.map((activity) => (
              <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white" key={activity.id}>
                {activity.image_url ? <a className="block h-52 bg-slate-100" href={activity.image_url} rel="noreferrer" target="_blank"><img alt={activity.summary} className="h-full w-full object-cover" src={activity.image_url} /></a> : null}
                <div className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge value={activity.activity_type} /><p className="text-xs font-semibold text-slate-400">{formatDate(activity.activity_date)}</p></div><p className="mt-3 font-bold text-slate-900">{activity.summary}</p>{activity.details ? <p className="mt-2 text-sm leading-6 text-slate-600">{activity.details}</p> : null}{activity.status ? <div className="mt-3"><StatusBadge value={activity.status} /></div> : null}</div>
              </article>
            ))}
            {!filteredActivities.length ? <p className="text-sm text-slate-500">No daily activity updates found.</p> : null}
          </div>
        </SectionCard>

        <SectionCard title="Teacher observations" description="Progress notes explicitly shared with parents.">
          <div className="space-y-3">
            {filteredNotes.map((note) => <article className="rounded-2xl border border-slate-100 bg-white p-4" key={note.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-slate-900">{note.title}</p><StatusBadge value={note.note_type} /></div><p className="mt-2 text-sm leading-6 text-slate-600">{note.summary}</p><p className="mt-2 text-xs font-semibold text-slate-400">{formatDate(note.created_at)}</p></article>)}
            {!filteredNotes.length ? <p className="text-sm text-slate-500">No progress notes shared yet.</p> : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
