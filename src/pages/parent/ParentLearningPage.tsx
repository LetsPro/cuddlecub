import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, CalendarDays, Download, School } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useParentPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { ClassroomUpdate, HomeworkTask, LessonPlan, StudentProgressNote, TimetableEntry, WorksheetRecord } from '../../types/app';

export function ParentLearningPage() {
  const { students, message } = useParentPortal();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [updates, setUpdates] = useState<ClassroomUpdate[]>([]);
  const [tasks, setTasks] = useState<HomeworkTask[]>([]);
  const [lessons, setLessons] = useState<LessonPlan[]>([]);
  const [worksheets, setWorksheets] = useState<WorksheetRecord[]>([]);
  const [progressNotes, setProgressNotes] = useState<StudentProgressNote[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? students[0] ?? null;

  useEffect(() => {
    if (!students.length) return;
    setSelectedStudentId((current) => current || students[0].id);
    void loadLearningData();
  }, [students.map((student) => student.id).join('|')]);

  async function loadLearningData() {
    setLoadMessage(null);
    try {
      const studentIds = students.map((student) => student.id);
      const classIds = Array.from(new Set(students.map((student) => student.class_id).filter(Boolean))) as string[];
      const updateQuery = classIds.length
        ? supabase.from('classroom_updates').select('*').in('class_id', classIds).order('published_at', { ascending: false }).limit(60)
        : Promise.resolve({ data: [], error: null });
      const taskQuery = classIds.length
        ? supabase.from('homework_tasks').select('*').in('class_id', classIds).order('created_at', { ascending: false }).limit(60)
        : Promise.resolve({ data: [], error: null });
      const lessonQuery = classIds.length
        ? supabase.from('lesson_plans').select('*').in('class_id', classIds).order('lesson_date', { ascending: false }).limit(60)
        : Promise.resolve({ data: [], error: null });
      const worksheetQuery = classIds.length
        ? supabase.from('worksheets').select('*').in('class_id', classIds).order('uploaded_at', { ascending: false }).limit(60)
        : Promise.resolve({ data: [], error: null });
      const timetableQuery = classIds.length
        ? supabase.from('timetable_entries').select('*').in('class_id', classIds).order('weekday').order('start_time').limit(80)
        : Promise.resolve({ data: [], error: null });

      const [updateResponse, taskResponse, lessonResponse, worksheetResponse, progressNoteResponse, timetableResponse] = await Promise.all([
        updateQuery,
        taskQuery,
        lessonQuery,
        worksheetQuery,
        studentIds.length
          ? supabase.from('student_progress_notes').select('*').in('student_id', studentIds).eq('shared_with_parent', true).order('created_at', { ascending: false }).limit(80)
          : Promise.resolve({ data: [], error: null }),
        timetableQuery,
      ]);

      if (updateResponse.error) throw updateResponse.error;
      if (taskResponse.error) throw taskResponse.error;
      if (lessonResponse.error) throw lessonResponse.error;
      if (worksheetResponse.error) throw worksheetResponse.error;
      if (progressNoteResponse.error) throw progressNoteResponse.error;
      if (timetableResponse.error) throw timetableResponse.error;

      setUpdates((updateResponse.data ?? []) as ClassroomUpdate[]);
      setTasks((taskResponse.data ?? []) as HomeworkTask[]);
      setLessons((lessonResponse.data ?? []) as LessonPlan[]);
      setWorksheets((worksheetResponse.data ?? []) as WorksheetRecord[]);
      setProgressNotes((progressNoteResponse.data ?? []) as StudentProgressNote[]);
      setTimetable((timetableResponse.data ?? []) as TimetableEntry[]);
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  const belongsToSelectedClass = (item: { class_id: string }) =>
    Boolean(selectedStudent?.class_id && item.class_id === selectedStudent.class_id);

  const visibleUpdates = useMemo(() => updates.filter(belongsToSelectedClass), [updates, selectedStudent?.class_id]);
  const visibleTasks = useMemo(() => tasks.filter(belongsToSelectedClass), [tasks, selectedStudent?.class_id]);
  const visibleLessons = useMemo(() => lessons.filter(belongsToSelectedClass), [lessons, selectedStudent?.class_id]);
  const visibleWorksheets = useMemo(() => worksheets.filter(belongsToSelectedClass), [worksheets, selectedStudent?.class_id]);
  const visibleProgressNotes = useMemo(
    () => progressNotes.filter((item) => item.student_id === selectedStudent?.id),
    [progressNotes, selectedStudent?.id],
  );
  const visibleTimetable = useMemo(() => timetable.filter(belongsToSelectedClass), [timetable, selectedStudent?.class_id]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Learning" title="Classroom and teacher updates" description="See class updates, homework, lessons, worksheets, and the weekly timetable." />

      {message || loadMessage ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div> : null}

      <SectionCard title="Child" description="Choose a child to see information for their class.">
        <select className="form-input max-w-sm" onChange={(event) => setSelectedStudentId(event.target.value)} value={selectedStudent?.id ?? ''}>
          {students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name} - {student.class_name ?? 'No class'}</option>)}
        </select>
      </SectionCard>

      <SectionCard title="Class updates" description="Messages shared by the teacher for this class.">
        <SimpleList empty="No class updates yet.">
          {visibleUpdates.map((item) => <InfoCard key={item.id} title={item.title} text={item.description} meta={formatDate(item.published_at)} />)}
        </SimpleList>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Homework" description="Tasks assigned for home or class.">
          <SimpleList empty="No homework assigned.">
            {visibleTasks.map((item) => (
              <InfoCard key={item.id} title={item.title} text={item.description} meta={item.due_date ? `Due ${formatDate(item.due_date)}` : 'No due date'} badge={item.status} />
            ))}
          </SimpleList>
        </SectionCard>

        <SectionCard title="Recent lessons" description="What the class has been learning.">
          <SimpleList empty="No lesson updates yet.">
            {visibleLessons.map((item) => <InfoCard key={item.id} title={item.title} text={item.activity_details || item.objective} meta={formatDate(item.lesson_date)} />)}
          </SimpleList>
        </SectionCard>
      </div>

      <SectionCard title="Progress notes" description="Teacher observations shared for this child.">
        <SimpleList empty="No progress notes shared yet.">
          {visibleProgressNotes.map((item) => (
            <InfoCard
              badge={item.note_type}
              key={item.id}
              meta={formatDate(item.created_at)}
              text={item.summary}
              title={item.title}
            />
          ))}
        </SimpleList>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Worksheets" description="Files shared for the class.">
          <SimpleList empty="No worksheets shared.">
            {visibleWorksheets.map((item) => (
              <a className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 transition hover:bg-slate-50" href={item.file_url} key={item.id} rel="noreferrer" target="_blank">
                <div><p className="font-bold text-slate-900">{item.title}</p><p className="mt-1 text-sm text-slate-500">Added {formatDate(item.uploaded_at)}</p></div>
                <Download className="h-5 w-5 text-slate-400" />
              </a>
            ))}
          </SimpleList>
        </SectionCard>

        <SectionCard title="Weekly timetable" description="Regular class schedule.">
          <SimpleList empty="No timetable shared.">
            {visibleTimetable.map((item) => (
              <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4" key={item.id}>
                <div className="rounded-xl bg-brand-50 p-2 text-brand-700"><CalendarDays className="h-5 w-5" /></div>
                <div><p className="font-bold text-slate-900">{item.title}</p><p className="mt-1 text-sm text-slate-500">{item.weekday} · {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}</p></div>
              </div>
            ))}
          </SimpleList>
        </SectionCard>
      </div>
    </div>
  );
}

function SimpleList({ children, empty }: { children: React.ReactNode; empty: string }) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  return <div className="space-y-3">{count ? children : <p className="text-sm text-slate-500">{empty}</p>}</div>;
}

function InfoCard({ title, text, meta, badge }: { title: string; text?: string | null; meta: string; badge?: string }) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-slate-50 p-2 text-slate-500">{badge ? <BookOpenText className="h-5 w-5" /> : <School className="h-5 w-5" />}</div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-slate-900">{title}</p>{badge ? <StatusBadge value={badge} /> : null}</div>{text ? <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p> : null}<p className="mt-2 text-xs font-semibold text-slate-400">{meta}</p></div>
      </div>
    </article>
  );
}
