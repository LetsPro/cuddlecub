import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, PencilLine, Plus, Search, Trash2 } from 'lucide-react';
import { ClassSelector } from '../../components/ClassSelector';
import { DataTable } from '../../components/DataTable';
import { MediaField } from '../../components/MediaField';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { buildStudentNameMap, formatStudentOption } from '../../lib/portal-data';
import { useClassFilter, useStaffPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { ClassroomUpdate, HomeworkTask, LessonPlan, StudentProgressNote, WorksheetRecord } from '../../types/app';

const worksheetSeed = { title: '', file_url: '', class_id: '' };
const taskSeed = { title: '', description: '', due_date: '', class_id: '' };
const lessonSeed = { title: '', objective: '', activity_details: '', lesson_date: '', class_id: '' };
const noteSeed = { student_id: '', note_type: 'observation', title: '', summary: '', shared_with_parent: true };
const updateSeed = { title: '', description: '', class_id: '' };

type AcademicModal = 'worksheet' | 'task' | 'lesson' | 'note' | 'update';

export function StaffAcademicsPage() {
  const { school } = useAppContext();
  const { staffRecord, students, message } = useStaffPortal();
  const { availableClasses, selectedClassId, setSelectedClassId, filteredStudents, studentCounts } =
    useClassFilter(students, staffRecord?.assigned_class_ids?.[0] ?? staffRecord?.class_teacher_for);
  const [worksheets, setWorksheets] = useState<WorksheetRecord[]>([]);
  const [tasks, setTasks] = useState<HomeworkTask[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [progressNotes, setProgressNotes] = useState<StudentProgressNote[]>([]);
  const [updates, setUpdates] = useState<ClassroomUpdate[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeModal, setActiveModal] = useState<AcademicModal | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);

  const [worksheetForm, setWorksheetForm] = useState(worksheetSeed);
  const [taskForm, setTaskForm] = useState(taskSeed);
  const [lessonForm, setLessonForm] = useState(lessonSeed);
  const [noteForm, setNoteForm] = useState(noteSeed);
  const [updateForm, setUpdateForm] = useState(updateSeed);

  const studentNameMap = useMemo(() => buildStudentNameMap(students), [students]);
  const assignedClasses = useMemo(() => {
    const classMap = new Map<string, string>();
    students.forEach((student) => {
      if (student.class_id) classMap.set(student.class_id, student.class_name || 'Assigned class');
    });
    return Array.from(classMap, ([id, name]) => ({ id, name }));
  }, [students]);
  const classLookup = useMemo(
    () => assignedClasses.reduce<Record<string, string>>((accumulator, schoolClass) => ({ ...accumulator, [schoolClass.id]: schoolClass.name }), {}),
    [assignedClasses],
  );
  const assignedClassIds = useMemo(() => assignedClasses.map((schoolClass) => schoolClass.id), [assignedClasses]);
  const currentClassId = selectedClassId || assignedClassIds[0] || '';

  useEffect(() => {
    if (!assignedClassIds.length && !students.length) return;
    void loadAcademicData();
  }, [school.id, assignedClassIds.join('|'), students.map((student) => student.id).join('|')]);

  async function loadAcademicData() {
    setLoadMessage(null);

    try {
      const worksheetQuery = supabase.from('worksheets').select('*').eq('school_id', school.id).order('uploaded_at', { ascending: false }).limit(100);
      const taskQuery = supabase.from('homework_tasks').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(100);
      const lessonQuery = supabase.from('lesson_plans').select('*').eq('school_id', school.id).order('lesson_date', { ascending: false }).limit(100);
      const updateQuery = supabase.from('classroom_updates').select('*').eq('school_id', school.id).order('published_at', { ascending: false }).limit(100);

      if (assignedClassIds.length) {
        worksheetQuery.in('class_id', assignedClassIds);
        taskQuery.in('class_id', assignedClassIds);
        lessonQuery.in('class_id', assignedClassIds);
        updateQuery.in('class_id', assignedClassIds);
      }

      const [worksheetResponse, taskResponse, lessonResponse, noteResponse, updateResponse] = await Promise.all([
        worksheetQuery,
        taskQuery,
        lessonQuery,
        students.length
          ? supabase.from('student_progress_notes').select('*').in('student_id', students.map((student) => student.id)).order('created_at', { ascending: false }).limit(100)
          : Promise.resolve({ data: [], error: null }),
        updateQuery,
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

  function openModal(modal: AcademicModal) {
    setEditingId(null);
    setActiveModal(modal);
    setWorksheetForm({ ...worksheetSeed, class_id: currentClassId });
    setTaskForm({ ...taskSeed, class_id: currentClassId });
    setLessonForm({ ...lessonSeed, class_id: currentClassId });
    setNoteForm(noteSeed);
    setUpdateForm({ ...updateSeed, class_id: currentClassId });
  }

  function closeModal() {
    setActiveModal(null);
    setEditingId(null);
  }

  function openEditWorksheet(row: WorksheetRecord) {
    setEditingId(row.id);
    setWorksheetForm({ title: row.title, file_url: row.file_url, class_id: row.class_id });
    setActiveModal('worksheet');
  }

  function openEditTask(row: HomeworkTask) {
    setEditingId(row.id);
    setTaskForm({ title: row.title, description: row.description ?? '', due_date: row.due_date ?? '', class_id: row.class_id });
    setActiveModal('task');
  }

  function openEditLesson(row: LessonPlan) {
    setEditingId(row.id);
    setLessonForm({
      title: row.title,
      objective: row.objective ?? '',
      activity_details: row.activity_details ?? '',
      lesson_date: row.lesson_date ?? '',
      class_id: row.class_id,
    });
    setActiveModal('lesson');
  }

  function openEditNote(row: StudentProgressNote) {
    setEditingId(row.id);
    setNoteForm({
      student_id: row.student_id,
      note_type: row.note_type,
      title: row.title,
      summary: row.summary,
      shared_with_parent: row.shared_with_parent,
    });
    setActiveModal('note');
  }

  function openEditUpdate(row: ClassroomUpdate) {
    setEditingId(row.id);
    setUpdateForm({ title: row.title, description: row.description ?? '', class_id: row.class_id });
    setActiveModal('update');
  }

  async function saveWorksheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadMessage(null);
    try {
      const payload = {
        school_id: school.id,
        class_id: worksheetForm.class_id,
        section_id: null,
        title: worksheetForm.title,
        file_url: worksheetForm.file_url,
      };
      const { error } = editingId
        ? await supabase.from('worksheets').update(payload).eq('id', editingId)
        : await supabase.from('worksheets').insert(payload);
      if (error) throw error;
      await loadAcademicData();
      closeModal();
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadMessage(null);
    try {
      const payload = {
        school_id: school.id,
        class_id: taskForm.class_id,
        section_id: null,
        created_by_staff_id: staffRecord?.id ?? null,
        title: taskForm.title,
        description: taskForm.description || null,
        due_date: taskForm.due_date || null,
        status: 'assigned',
      };
      const { error } = editingId
        ? await supabase.from('homework_tasks').update(payload).eq('id', editingId)
        : await supabase.from('homework_tasks').insert(payload);
      if (error) throw error;
      await loadAcademicData();
      closeModal();
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  async function saveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadMessage(null);
    try {
      const payload = {
        school_id: school.id,
        class_id: lessonForm.class_id,
        section_id: null,
        lesson_date: lessonForm.lesson_date || new Date().toISOString().slice(0, 10),
        title: lessonForm.title,
        objective: lessonForm.objective || null,
        activity_details: lessonForm.activity_details || null,
      };
      const { error } = editingId
        ? await supabase.from('lesson_plans').update(payload).eq('id', editingId)
        : await supabase.from('lesson_plans').insert(payload);
      if (error) throw error;
      await loadAcademicData();
      closeModal();
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  async function saveProgressNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadMessage(null);
    try {
      const payload = {
        school_id: school.id,
        student_id: noteForm.student_id,
        created_by_staff_id: staffRecord?.id ?? null,
        note_type: noteForm.note_type,
        title: noteForm.title,
        summary: noteForm.summary,
        shared_with_parent: noteForm.shared_with_parent,
      };
      const { error } = editingId
        ? await supabase.from('student_progress_notes').update(payload).eq('id', editingId)
        : await supabase.from('student_progress_notes').insert(payload);
      if (error) throw error;
      await loadAcademicData();
      closeModal();
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  async function saveUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadMessage(null);
    try {
      const payload = {
        school_id: school.id,
        class_id: updateForm.class_id,
        section_id: null,
        title: updateForm.title,
        description: updateForm.description || null,
      };
      const { error } = editingId
        ? await supabase.from('classroom_updates').update(payload).eq('id', editingId)
        : await supabase.from('classroom_updates').insert({ ...payload, published_at: new Date().toISOString() });
      if (error) throw error;
      await loadAcademicData();
      closeModal();
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  async function deleteRow(table: 'worksheets' | 'homework_tasks' | 'lesson_plans' | 'student_progress_notes' | 'classroom_updates', id: string, label: string) {
    if (!window.confirm(`Delete "${label}"?`)) return;

    setBusyDeleteId(id);
    setLoadMessage(null);
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      await loadAcademicData();
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  const selectedStudentIdSet = useMemo(() => new Set(filteredStudents.map((student) => student.id)), [filteredStudents]);
  const normalizedQuery = query.trim().toLowerCase();
  const classFilter = (row: { class_id: string }) => !selectedClassId || row.class_id === selectedClassId;
  const textFilter = (...values: Array<string | null | undefined>) =>
    !normalizedQuery || values.some((value) => (value ?? '').toLowerCase().includes(normalizedQuery));

  const displayedWorksheets = useMemo(
    () => worksheets.filter((row) => classFilter(row) && textFilter(row.title, classLookup[row.class_id])),
    [worksheets, selectedClassId, normalizedQuery, classLookup],
  );
  const displayedTasks = useMemo(
    () => tasks.filter((row) => classFilter(row) && textFilter(row.title, row.description, classLookup[row.class_id])),
    [tasks, selectedClassId, normalizedQuery, classLookup],
  );
  const displayedLessonPlans = useMemo(
    () => lessonPlans.filter((row) => classFilter(row) && textFilter(row.title, row.objective, row.activity_details, classLookup[row.class_id])),
    [lessonPlans, selectedClassId, normalizedQuery, classLookup],
  );
  const displayedProgressNotes = useMemo(
    () =>
      progressNotes.filter((row) => {
        if (!selectedStudentIdSet.has(row.student_id)) return false;
        return textFilter(row.title, row.summary, row.note_type, studentNameMap[row.student_id]);
      }),
    [progressNotes, selectedStudentIdSet, normalizedQuery, studentNameMap],
  );
  const displayedUpdates = useMemo(
    () => updates.filter((row) => classFilter(row) && textFilter(row.title, row.description, classLookup[row.class_id])),
    [updates, selectedClassId, normalizedQuery, classLookup],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <button className="button-primary gap-2" disabled={!currentClassId} onClick={() => openModal('worksheet')} type="button">
            <Plus className="h-4 w-4" />
            Add worksheet
          </button>
        }
        eyebrow="Academic Support"
        title="Class academics"
        description="Add class updates, homework, worksheets, lessons and progress notes. Parents only see records for their child or child class."
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <SectionCard title="Filter" description="View academic records class wise.">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <ClassSelector
            classes={availableClasses}
            counts={studentCounts}
            onChange={setSelectedClassId}
            selectedClassId={selectedClassId}
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="form-input pl-11" onChange={(event) => setQuery(event.target.value)} placeholder="Search all academic data" value={query} />
          </div>
        </div>
      </SectionCard>

      <AcademicTable
        actionLabel="Add worksheet"
        emptyMessage="No worksheets uploaded."
        onAdd={() => openModal('worksheet')}
        title="Worksheets"
      >
        <DataTable
          columns={[
            { key: 'class', label: 'Class', render: (row) => classLookup[row.class_id] ?? 'Class' },
            { key: 'title', label: 'Worksheet', render: (row) => <span className="font-bold">{row.title}</span> },
            { key: 'uploaded', label: 'Uploaded', render: (row) => formatDate(row.uploaded_at) },
            {
              key: 'file',
              label: 'File',
              render: (row) => (
                <a className="inline-flex items-center gap-2 font-semibold text-brand-700" href={row.file_url} rel="noreferrer" target="_blank">
                  <Download className="h-4 w-4" />
                  Open
                </a>
              ),
            },
            { key: 'actions', label: 'Action', render: (row) => <RowActions busy={busyDeleteId === row.id} onDelete={() => void deleteRow('worksheets', row.id, row.title)} onEdit={() => openEditWorksheet(row)} /> },
          ]}
          emptyMessage="No worksheets uploaded."
          rows={displayedWorksheets}
        />
      </AcademicTable>

      <AcademicTable actionLabel="Add homework" emptyMessage="No homework tasks assigned." onAdd={() => openModal('task')} title="Homework / activity tasks">
        <DataTable
          columns={[
            { key: 'class', label: 'Class', render: (row) => classLookup[row.class_id] ?? 'Class' },
            { key: 'title', label: 'Task', render: (row) => <span className="font-bold">{row.title}</span> },
            { key: 'due', label: 'Due', render: (row) => (row.due_date ? formatDate(row.due_date) : 'No due date') },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            { key: 'actions', label: 'Action', render: (row) => <RowActions busy={busyDeleteId === row.id} onDelete={() => void deleteRow('homework_tasks', row.id, row.title)} onEdit={() => openEditTask(row)} /> },
          ]}
          emptyMessage="No homework tasks assigned."
          rows={displayedTasks}
        />
      </AcademicTable>

      <AcademicTable actionLabel="Add lesson" emptyMessage="No lesson summaries." onAdd={() => openModal('lesson')} title="Lesson summaries">
        <DataTable
          columns={[
            { key: 'class', label: 'Class', render: (row) => classLookup[row.class_id] ?? 'Class' },
            { key: 'title', label: 'Lesson', render: (row) => <span className="font-bold">{row.title}</span> },
            { key: 'date', label: 'Date', render: (row) => formatDate(row.lesson_date) },
            { key: 'objective', label: 'Objective', render: (row) => row.objective ?? '-' },
            { key: 'actions', label: 'Action', render: (row) => <RowActions busy={busyDeleteId === row.id} onDelete={() => void deleteRow('lesson_plans', row.id, row.title)} onEdit={() => openEditLesson(row)} /> },
          ]}
          emptyMessage="No lesson summaries."
          rows={displayedLessonPlans}
        />
      </AcademicTable>

      <AcademicTable actionLabel="Add progress note" emptyMessage="No progress notes yet." onAdd={() => openModal('note')} title="Progress notes">
        <DataTable
          columns={[
            { key: 'student', label: 'Student', render: (row) => studentNameMap[row.student_id] ?? 'Unknown student' },
            { key: 'title', label: 'Note', render: (row) => <span className="font-bold">{row.title}</span> },
            { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.note_type} /> },
            { key: 'share', label: 'Shared', render: (row) => <StatusBadge value={row.shared_with_parent ? 'shared' : 'internal'} /> },
            { key: 'actions', label: 'Action', render: (row) => <RowActions busy={busyDeleteId === row.id} onDelete={() => void deleteRow('student_progress_notes', row.id, row.title)} onEdit={() => openEditNote(row)} /> },
          ]}
          emptyMessage="No progress notes yet."
          rows={displayedProgressNotes}
        />
      </AcademicTable>

      <AcademicTable actionLabel="Add class update" emptyMessage="No class updates published." onAdd={() => openModal('update')} title="Class updates">
        <DataTable
          columns={[
            { key: 'class', label: 'Class', render: (row) => classLookup[row.class_id] ?? 'Class' },
            { key: 'title', label: 'Update', render: (row) => <span className="font-bold">{row.title}</span> },
            { key: 'published', label: 'Published', render: (row) => formatDate(row.published_at) },
            { key: 'actions', label: 'Action', render: (row) => <RowActions busy={busyDeleteId === row.id} onDelete={() => void deleteRow('classroom_updates', row.id, row.title)} onEdit={() => openEditUpdate(row)} /> },
          ]}
          emptyMessage="No class updates published."
          rows={displayedUpdates}
        />
      </AcademicTable>

      <Modal description="Upload or select a worksheet file for one class." onClose={closeModal} open={activeModal === 'worksheet'} size="lg" title={editingId ? 'Edit worksheet' : 'Add worksheet'}>
        <form className="grid gap-4" onSubmit={saveWorksheet}>
          <PlacementFields classes={assignedClasses} classId={worksheetForm.class_id} onChange={(classId) => setWorksheetForm((current) => ({ ...current, class_id: classId }))} />
          <input className="form-input" onChange={(event) => setWorksheetForm((current) => ({ ...current, title: event.target.value }))} placeholder="Worksheet title" required value={worksheetForm.title} />
          <MediaField helperText="Upload an image or select a file from the school media library." label="Worksheet file" onChange={(value) => setWorksheetForm((current) => ({ ...current, file_url: value }))} previewHeightClassName="h-36" value={worksheetForm.file_url} />
          <ModalActions closeModal={closeModal} disabled={!worksheetForm.class_id || !worksheetForm.file_url} label={editingId ? 'Save worksheet' : 'Add worksheet'} />
        </form>
      </Modal>

      <Modal description="Add or edit a homework/activity task for one class." onClose={closeModal} open={activeModal === 'task'} size="lg" title={editingId ? 'Edit homework' : 'Add homework'}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={saveTask}>
          <PlacementFields classes={assignedClasses} classId={taskForm.class_id} onChange={(classId) => setTaskForm((current) => ({ ...current, class_id: classId }))} />
          <input className="form-input" onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} placeholder="Task title" required value={taskForm.title} />
          <textarea className="form-input min-h-28 md:col-span-2" onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} placeholder="Task description" value={taskForm.description} />
          <input className="form-input" onChange={(event) => setTaskForm((current) => ({ ...current, due_date: event.target.value }))} type="date" value={taskForm.due_date} />
          <ModalActions closeModal={closeModal} disabled={!taskForm.class_id} label={editingId ? 'Save homework' : 'Add homework'} />
        </form>
      </Modal>

      <Modal description="Record what was covered in class." onClose={closeModal} open={activeModal === 'lesson'} size="lg" title={editingId ? 'Edit lesson' : 'Add lesson'}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={saveLesson}>
          <PlacementFields classes={assignedClasses} classId={lessonForm.class_id} onChange={(classId) => setLessonForm((current) => ({ ...current, class_id: classId }))} />
          <input className="form-input" onChange={(event) => setLessonForm((current) => ({ ...current, title: event.target.value }))} placeholder="Lesson title" required value={lessonForm.title} />
          <input className="form-input" onChange={(event) => setLessonForm((current) => ({ ...current, objective: event.target.value }))} placeholder="Objective" value={lessonForm.objective} />
          <input className="form-input" onChange={(event) => setLessonForm((current) => ({ ...current, lesson_date: event.target.value }))} type="date" value={lessonForm.lesson_date} />
          <textarea className="form-input min-h-28 md:col-span-2" onChange={(event) => setLessonForm((current) => ({ ...current, activity_details: event.target.value }))} placeholder="Activity summary" value={lessonForm.activity_details} />
          <ModalActions closeModal={closeModal} disabled={!lessonForm.class_id} label={editingId ? 'Save lesson' : 'Add lesson'} />
        </form>
      </Modal>

      <Modal description="Store observations and choose whether parents can view them." onClose={closeModal} open={activeModal === 'note'} size="lg" title={editingId ? 'Edit progress note' : 'Add progress note'}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={saveProgressNote}>
          <select className="form-input" onChange={(event) => setNoteForm((current) => ({ ...current, student_id: event.target.value }))} required value={noteForm.student_id}>
            <option value="">Select student</option>
            {filteredStudents.map((student) => (
              <option key={student.id} value={student.id}>{formatStudentOption(student)}</option>
            ))}
          </select>
          <select className="form-input" onChange={(event) => setNoteForm((current) => ({ ...current, note_type: event.target.value }))} value={noteForm.note_type}>
            <option value="observation">Observation remark</option>
            <option value="learning_progress">Learning progress</option>
            <option value="behavior">Behavior note</option>
          </select>
          <input className="form-input md:col-span-2" onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))} placeholder="Note title" required value={noteForm.title} />
          <textarea className="form-input min-h-28 md:col-span-2" onChange={(event) => setNoteForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Summary" required value={noteForm.summary} />
          <label className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
            <input checked={noteForm.shared_with_parent} className="mr-3" onChange={(event) => setNoteForm((current) => ({ ...current, shared_with_parent: event.target.checked }))} type="checkbox" />
            Share note with parent
          </label>
          <ModalActions closeModal={closeModal} label={editingId ? 'Save note' : 'Add note'} />
        </form>
      </Modal>

      <Modal description="Publish a quick class update for parents." onClose={closeModal} open={activeModal === 'update'} size="lg" title={editingId ? 'Edit class update' : 'Add class update'}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={saveUpdate}>
          <PlacementFields classes={assignedClasses} classId={updateForm.class_id} onChange={(classId) => setUpdateForm((current) => ({ ...current, class_id: classId }))} />
          <input className="form-input" onChange={(event) => setUpdateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Update title" required value={updateForm.title} />
          <textarea className="form-input min-h-28 md:col-span-2" onChange={(event) => setUpdateForm((current) => ({ ...current, description: event.target.value }))} placeholder="Update description" value={updateForm.description} />
          <ModalActions closeModal={closeModal} disabled={!updateForm.class_id} label={editingId ? 'Save update' : 'Publish update'} />
        </form>
      </Modal>
    </div>
  );
}

interface PlacementFieldsProps {
  classes: Array<{ id: string; name: string }>;
  classId: string;
  onChange: (classId: string) => void;
}

function PlacementFields({ classes, classId, onChange }: PlacementFieldsProps) {
  return (
    <div>
      <label className="form-label">Class</label>
      <select className="form-input" onChange={(event) => onChange(event.target.value)} required value={classId}>
        <option value="">Select class</option>
        {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
      </select>
    </div>
  );
}

function AcademicTable({ actionLabel, children, onAdd, title }: { actionLabel: string; children: React.ReactNode; emptyMessage: string; onAdd: () => void; title: string }) {
  return (
    <SectionCard
      action={
        <button className="button-primary gap-2" onClick={onAdd} type="button">
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      }
      title={title}
    >
      {children}
    </SectionCard>
  );
}

function RowActions({ busy, onDelete, onEdit }: { busy: boolean; onDelete: () => void; onEdit: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button className="button-secondary px-3 py-2 text-xs" onClick={onEdit} type="button">
        <PencilLine className="h-3.5 w-3.5" />
        Edit
      </button>
      <button className="button-danger px-3 py-2 text-xs" disabled={busy} onClick={onDelete} type="button">
        <Trash2 className="h-3.5 w-3.5" />
        {busy ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  );
}

function ModalActions({ closeModal, disabled, label }: { closeModal: () => void; disabled?: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-3 pt-2 md:col-span-2">
      <button className="button-secondary" onClick={closeModal} type="button">
        Cancel
      </button>
      <button className="button-primary" disabled={disabled} type="submit">
        {label}
      </button>
    </div>
  );
}
