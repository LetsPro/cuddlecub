import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { MediaField } from '../../components/MediaField';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { buildStudentNameMap, formatStudentOption } from '../../lib/portal-data';
import { useStaffPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { ClassroomUpdate, HomeworkTask, LessonPlan, StudentProgressNote, WorksheetRecord } from '../../types/app';

export function StaffAcademicsPage() {
  const { school } = useAppContext();
  const { staffRecord, students, message } = useStaffPortal();
  const [worksheets, setWorksheets] = useState<WorksheetRecord[]>([]);
  const [tasks, setTasks] = useState<HomeworkTask[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [progressNotes, setProgressNotes] = useState<StudentProgressNote[]>([]);
  const [updates, setUpdates] = useState<ClassroomUpdate[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  const studentNameMap = useMemo(() => buildStudentNameMap(students), [students]);
  const defaultClassId = staffRecord?.class_teacher_for || students[0]?.class_id || '';
  const defaultSectionId = students[0]?.section_id || '';
  const assignedClasses = useMemo(() => {
    const classMap = new Map<string, string>();
    students.forEach((student) => {
      if (student.class_id) classMap.set(student.class_id, student.class_name || 'Assigned class');
    });
    return Array.from(classMap, ([id, name]) => ({ id, name }));
  }, [students]);
  const assignedSections = useMemo(() => {
    const sectionMap = new Map<string, { id: string; classId: string; name: string }>();
    students.forEach((student) => {
      if (student.section_id && student.class_id) {
        sectionMap.set(student.section_id, { id: student.section_id, classId: student.class_id, name: student.section_name || 'Assigned section' });
      }
    });
    return Array.from(sectionMap.values());
  }, [students]);

  const [worksheetForm, setWorksheetForm] = useState({ title: '', file_url: '', class_id: '', section_id: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', due_date: '', class_id: '', section_id: '' });
  const [lessonForm, setLessonForm] = useState({ title: '', objective: '', activity_details: '', lesson_date: '', class_id: '', section_id: '' });
  const [noteForm, setNoteForm] = useState({ student_id: '', note_type: 'observation', title: '', summary: '', shared_with_parent: true });
  const [updateForm, setUpdateForm] = useState({ title: '', description: '', class_id: '', section_id: '' });

  useEffect(() => {
    setWorksheetForm((current) => ({ ...current, class_id: defaultClassId, section_id: defaultSectionId }));
    setTaskForm((current) => ({ ...current, class_id: defaultClassId, section_id: defaultSectionId }));
    setLessonForm((current) => ({ ...current, class_id: defaultClassId, section_id: defaultSectionId }));
    setUpdateForm((current) => ({ ...current, class_id: defaultClassId, section_id: defaultSectionId }));
  }, [defaultClassId, defaultSectionId]);

  useEffect(() => {
    if (!defaultClassId && !students.length) return;
    void loadAcademicData();
  }, [school.id, defaultClassId, students.map((student) => student.id).join('|')]);

  async function loadAcademicData() {
    setLoadMessage(null);

    try {
      const [worksheetResponse, taskResponse, lessonResponse, noteResponse, updateResponse] = await Promise.all([
        supabase.from('worksheets').select('*').eq('school_id', school.id).order('uploaded_at', { ascending: false }).limit(20),
        supabase.from('homework_tasks').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('lesson_plans').select('*').eq('school_id', school.id).order('lesson_date', { ascending: false }).limit(20),
        students.length
          ? supabase.from('student_progress_notes').select('*').in('student_id', students.map((student) => student.id)).order('created_at', { ascending: false }).limit(30)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('classroom_updates').select('*').eq('school_id', school.id).order('published_at', { ascending: false }).limit(20),
      ]);

      if (worksheetResponse.error) throw worksheetResponse.error;
      if (taskResponse.error) throw taskResponse.error;
      if (lessonResponse.error) throw lessonResponse.error;
      if (noteResponse.error) throw noteResponse.error;
      if (updateResponse.error) throw updateResponse.error;

      setWorksheets((worksheetResponse.data ?? []) as WorksheetRecord[]);
      setTasks((taskResponse.data ?? []) as HomeworkTask[]);
      setLessonPlans((lessonResponse.data ?? []) as LessonPlan[]);
      setProgressNotes((noteResponse.data ?? []) as StudentProgressNote[]);
      setUpdates((updateResponse.data ?? []) as ClassroomUpdate[]);
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  async function saveWorksheet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadMessage(null);
    try {
      const { error } = await supabase.from('worksheets').insert({
        school_id: school.id,
        class_id: worksheetForm.class_id,
        section_id: worksheetForm.section_id || null,
        title: worksheetForm.title,
        file_url: worksheetForm.file_url,
      });
      if (error) throw error;
      setWorksheetForm({ title: '', file_url: '', class_id: defaultClassId, section_id: defaultSectionId });
      await loadAcademicData();
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  async function saveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadMessage(null);
    try {
      const { error } = await supabase.from('homework_tasks').insert({
        school_id: school.id,
        class_id: taskForm.class_id,
        section_id: taskForm.section_id || null,
        created_by_staff_id: staffRecord?.id ?? null,
        title: taskForm.title,
        description: taskForm.description || null,
        due_date: taskForm.due_date || null,
        status: 'assigned',
      });
      if (error) throw error;
      setTaskForm({ title: '', description: '', due_date: '', class_id: defaultClassId, section_id: defaultSectionId });
      await loadAcademicData();
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  async function saveLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadMessage(null);
    try {
      const { error } = await supabase.from('lesson_plans').insert({
        school_id: school.id,
        class_id: lessonForm.class_id,
        section_id: lessonForm.section_id || null,
        lesson_date: lessonForm.lesson_date || new Date().toISOString().slice(0, 10),
        title: lessonForm.title,
        objective: lessonForm.objective || null,
        activity_details: lessonForm.activity_details || null,
      });
      if (error) throw error;
      setLessonForm({ title: '', objective: '', activity_details: '', lesson_date: '', class_id: defaultClassId, section_id: defaultSectionId });
      await loadAcademicData();
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  async function saveProgressNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadMessage(null);
    try {
      const { error } = await supabase.from('student_progress_notes').insert({
        school_id: school.id,
        student_id: noteForm.student_id,
        created_by_staff_id: staffRecord?.id ?? null,
        note_type: noteForm.note_type,
        title: noteForm.title,
        summary: noteForm.summary,
        shared_with_parent: noteForm.shared_with_parent,
      });
      if (error) throw error;
      setNoteForm({ student_id: '', note_type: 'observation', title: '', summary: '', shared_with_parent: true });
      await loadAcademicData();
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  async function saveUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadMessage(null);
    try {
      const { error } = await supabase.from('classroom_updates').insert({
        school_id: school.id,
        class_id: updateForm.class_id,
        section_id: updateForm.section_id || null,
        title: updateForm.title,
        description: updateForm.description || null,
        published_at: new Date().toISOString(),
      });
      if (error) throw error;
      setUpdateForm({ title: '', description: '', class_id: defaultClassId, section_id: defaultSectionId });
      await loadAcademicData();
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic Support"
        title="Worksheets, tasks and progress notes"
        description="Upload worksheets, assign class activity tasks, add lesson summaries, write observations and publish class updates for admin and parents."
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Upload worksheet" description="Add a worksheet or activity file for your class.">
          <form className="grid gap-4" onSubmit={saveWorksheet}>
            <PlacementFields
              classes={assignedClasses}
              classId={worksheetForm.class_id}
              onChange={(classId, sectionId) => setWorksheetForm((current) => ({ ...current, class_id: classId, section_id: sectionId }))}
              sectionId={worksheetForm.section_id}
              sections={assignedSections}
            />
            <input className="form-input" placeholder="Worksheet title" required onChange={(event) => setWorksheetForm((current) => ({ ...current, title: event.target.value }))} value={worksheetForm.title} />
            <MediaField
              helperText="Upload an image or select one already available in the school media library."
              label="Worksheet image"
              onChange={(value) => setWorksheetForm((current) => ({ ...current, file_url: value }))}
              previewHeightClassName="h-36"
              value={worksheetForm.file_url}
            />
            <button className="button-primary" disabled={!worksheetForm.class_id || !worksheetForm.file_url} type="submit">Save worksheet</button>
          </form>
        </SectionCard>

        <SectionCard title="Add homework / activity task" description="Share take-home or classroom tasks.">
          <form className="grid gap-4" onSubmit={saveTask}>
            <PlacementFields
              classes={assignedClasses}
              classId={taskForm.class_id}
              onChange={(classId, sectionId) => setTaskForm((current) => ({ ...current, class_id: classId, section_id: sectionId }))}
              sectionId={taskForm.section_id}
              sections={assignedSections}
            />
            <input className="form-input" placeholder="Task title" required onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} value={taskForm.title} />
            <textarea className="form-input min-h-28" placeholder="Task description" onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} value={taskForm.description} />
            <input className="form-input" type="date" onChange={(event) => setTaskForm((current) => ({ ...current, due_date: event.target.value }))} value={taskForm.due_date} />
            <button className="button-primary" disabled={!taskForm.class_id} type="submit">Save task</button>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Add lesson summary" description="Record what was covered in class.">
          <form className="grid gap-4" onSubmit={saveLesson}>
            <PlacementFields
              classes={assignedClasses}
              classId={lessonForm.class_id}
              onChange={(classId, sectionId) => setLessonForm((current) => ({ ...current, class_id: classId, section_id: sectionId }))}
              sectionId={lessonForm.section_id}
              sections={assignedSections}
            />
            <input className="form-input" placeholder="Lesson title" required onChange={(event) => setLessonForm((current) => ({ ...current, title: event.target.value }))} value={lessonForm.title} />
            <input className="form-input" placeholder="Objective" onChange={(event) => setLessonForm((current) => ({ ...current, objective: event.target.value }))} value={lessonForm.objective} />
            <textarea className="form-input min-h-28" placeholder="Activity summary" onChange={(event) => setLessonForm((current) => ({ ...current, activity_details: event.target.value }))} value={lessonForm.activity_details} />
            <input className="form-input" type="date" onChange={(event) => setLessonForm((current) => ({ ...current, lesson_date: event.target.value }))} value={lessonForm.lesson_date} />
            <button className="button-primary" disabled={!lessonForm.class_id} type="submit">Save lesson summary</button>
          </form>
        </SectionCard>

        <SectionCard title="Maintain child progress notes" description="Store observations and decide whether they are shared with parents.">
          <form className="grid gap-4" onSubmit={saveProgressNote}>
            <select className="form-input" required onChange={(event) => setNoteForm((current) => ({ ...current, student_id: event.target.value }))} value={noteForm.student_id}>
              <option value="">Select student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {formatStudentOption(student)}
                </option>
              ))}
            </select>
            <select className="form-input" onChange={(event) => setNoteForm((current) => ({ ...current, note_type: event.target.value }))} value={noteForm.note_type}>
              <option value="observation">Observation remark</option>
              <option value="learning_progress">Learning progress</option>
              <option value="behavior">Behavior note</option>
            </select>
            <input className="form-input" placeholder="Note title" required onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))} value={noteForm.title} />
            <textarea className="form-input min-h-28" placeholder="Summary" required onChange={(event) => setNoteForm((current) => ({ ...current, summary: event.target.value }))} value={noteForm.summary} />
            <label className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
              <input checked={noteForm.shared_with_parent} className="mr-3" onChange={(event) => setNoteForm((current) => ({ ...current, shared_with_parent: event.target.checked }))} type="checkbox" />
              Share note with parent
            </label>
            <button className="button-primary" type="submit">Save progress note</button>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Share class update" description="Publish a quick class update for admin and families.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={saveUpdate}>
          <PlacementFields
            classes={assignedClasses}
            classId={updateForm.class_id}
            onChange={(classId, sectionId) => setUpdateForm((current) => ({ ...current, class_id: classId, section_id: sectionId }))}
            sectionId={updateForm.section_id}
            sections={assignedSections}
          />
          <input className="form-input" placeholder="Update title" required onChange={(event) => setUpdateForm((current) => ({ ...current, title: event.target.value }))} value={updateForm.title} />
          <input className="form-input" placeholder="Update description" onChange={(event) => setUpdateForm((current) => ({ ...current, description: event.target.value }))} value={updateForm.description} />
          <button className="button-primary" disabled={!updateForm.class_id} type="submit">Publish update</button>
        </form>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Recent worksheets and tasks" description="Latest academic assets you can revisit.">
          <div className="space-y-6">
            <DataTable
              columns={[
                { key: 'title', label: 'Worksheet', render: (row) => <span className="font-bold">{row.title}</span> },
                { key: 'uploaded', label: 'Uploaded', render: (row) => formatDate(row.uploaded_at) },
                { key: 'file', label: 'File', render: (row) => row.file_url },
              ]}
              emptyMessage="No worksheets uploaded."
              rows={worksheets}
            />
            <DataTable
              columns={[
                { key: 'title', label: 'Task', render: (row) => <span className="font-bold">{row.title}</span> },
                { key: 'due', label: 'Due date', render: (row) => formatDate(row.due_date) },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              ]}
              emptyMessage="No homework tasks assigned."
              rows={tasks}
            />
          </div>
        </SectionCard>

        <SectionCard title="Lessons, progress and updates" description="Recent summaries and child-specific progress notes.">
          <div className="space-y-6">
            <DataTable
              columns={[
                { key: 'title', label: 'Lesson', render: (row) => <span className="font-bold">{row.title}</span> },
                { key: 'date', label: 'Date', render: (row) => formatDate(row.lesson_date) },
                { key: 'objective', label: 'Objective', render: (row) => row.objective ?? '-' },
              ]}
              emptyMessage="No lesson summaries."
              rows={lessonPlans}
            />
            <DataTable
              columns={[
                { key: 'student', label: 'Student', render: (row) => studentNameMap[row.student_id] ?? 'Unknown student' },
                { key: 'title', label: 'Note', render: (row) => row.title },
                { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.note_type} /> },
                { key: 'share', label: 'Shared', render: (row) => <StatusBadge value={row.shared_with_parent ? 'shared' : 'internal'} /> },
              ]}
              emptyMessage="No progress notes yet."
              rows={progressNotes}
            />
            <DataTable
              columns={[
                { key: 'title', label: 'Class update', render: (row) => row.title },
                { key: 'published', label: 'Published', render: (row) => formatDate(row.published_at) },
              ]}
              emptyMessage="No class updates published."
              rows={updates}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

interface PlacementFieldsProps {
  classes: Array<{ id: string; name: string }>;
  sections: Array<{ id: string; classId: string; name: string }>;
  classId: string;
  sectionId: string;
  onChange: (classId: string, sectionId: string) => void;
}

function PlacementFields({ classes, sections, classId, sectionId, onChange }: PlacementFieldsProps) {
  const availableSections = sections.filter((section) => section.classId === classId);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="form-label">Assigned class</label>
        <select className="form-input" onChange={(event) => onChange(event.target.value, '')} required value={classId}>
          <option value="">Select class</option>
          {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">Section</label>
        <select className="form-input" onChange={(event) => onChange(classId, event.target.value)} value={sectionId}>
          <option value="">All sections</option>
          {availableSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
        </select>
      </div>
    </div>
  );
}
