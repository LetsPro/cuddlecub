import { useEffect, useState } from 'react';
import { PencilLine, Plus, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { ClassroomUpdate, SchoolClass, TimetableEntry } from '../../types/app';

const timetableSeed = {
  class_id: '',
  weekday: 'monday',
  start_time: '',
  end_time: '',
  title: '',
  category: '',
};

const updateSeed = {
  class_id: '',
  title: '',
  description: '',
};

type AcademicsModal = 'timetable' | 'update';

export function AcademicsPage() {
  const { school } = useAppContext();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [classroomUpdates, setClassroomUpdates] = useState<ClassroomUpdate[]>([]);
  const [timetableForm, setTimetableForm] = useState(timetableSeed);
  const [updateForm, setUpdateForm] = useState(updateSeed);
  const [editingTimetableId, setEditingTimetableId] = useState<string | null>(null);
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [academicsModal, setAcademicsModal] = useState<AcademicsModal | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAcademics();
  }, [school.id]);

  async function loadAcademics() {
    setMessage(null);

    try {
      const [classResponse, timetableResponse, updatesResponse] = await Promise.all([
        supabase.from('classes').select('*').eq('school_id', school.id).order('name'),
        supabase.from('timetable_entries').select('*').eq('school_id', school.id).order('weekday').order('start_time'),
        supabase.from('classroom_updates').select('*').eq('school_id', school.id).order('published_at', { ascending: false }),
      ]);

      if (classResponse.error) throw classResponse.error;
      if (timetableResponse.error) throw timetableResponse.error;
      if (updatesResponse.error) throw updatesResponse.error;

      setClasses((classResponse.data ?? []) as SchoolClass[]);
      setTimetableEntries((timetableResponse.data ?? []) as TimetableEntry[]);
      setClassroomUpdates((updatesResponse.data ?? []) as ClassroomUpdate[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function openAddTimetable() {
    setEditingTimetableId(null);
    setTimetableForm(timetableSeed);
    setAcademicsModal('timetable');
  }

  function openEditTimetable(entry: TimetableEntry) {
    setEditingTimetableId(entry.id);
    setTimetableForm({
      class_id: entry.class_id,
      weekday: entry.weekday,
      start_time: entry.start_time,
      end_time: entry.end_time,
      title: entry.title,
      category: entry.category ?? '',
    });
    setAcademicsModal('timetable');
  }

  function openAddUpdate() {
    setEditingUpdateId(null);
    setUpdateForm(updateSeed);
    setAcademicsModal('update');
  }

  function openEditUpdate(update: ClassroomUpdate) {
    setEditingUpdateId(update.id);
    setUpdateForm({
      class_id: update.class_id,
      title: update.title,
      description: update.description ?? '',
    });
    setAcademicsModal('update');
  }

  function closeAcademicsModal() {
    setAcademicsModal(null);
    setEditingTimetableId(null);
    setEditingUpdateId(null);
    setTimetableForm(timetableSeed);
    setUpdateForm(updateSeed);
  }

  async function handleTimetableSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const payload = {
      school_id: school.id,
      class_id: timetableForm.class_id,
      section_id: null,
      weekday: timetableForm.weekday,
      start_time: timetableForm.start_time,
      end_time: timetableForm.end_time,
      title: timetableForm.title,
      category: timetableForm.category || null,
    };

    try {
      if (editingTimetableId) {
        const { error } = await supabase.from('timetable_entries').update(payload).eq('id', editingTimetableId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('timetable_entries').insert(payload);
        if (error) throw error;
      }

      await loadAcademics();
      closeAcademicsModal();
      setMessage(editingTimetableId ? 'Timetable entry updated.' : 'Timetable entry added.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleUpdateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const payload = {
      school_id: school.id,
      class_id: updateForm.class_id,
      section_id: null,
      title: updateForm.title,
      description: updateForm.description || null,
    };

    try {
      if (editingUpdateId) {
        const { error } = await supabase.from('classroom_updates').update(payload).eq('id', editingUpdateId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('classroom_updates').insert({
          ...payload,
          published_at: new Date().toISOString(),
        });
        if (error) throw error;
      }

      await loadAcademics();
      closeAcademicsModal();
      setMessage(editingUpdateId ? 'Classroom update saved.' : 'Classroom update published.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteTimetable(entry: TimetableEntry) {
    const confirmed = window.confirm(`Delete timetable entry "${entry.title}"?`);

    if (!confirmed) {
      return;
    }

    setBusyDeleteId(entry.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('timetable_entries').delete().eq('id', entry.id);
      if (error) throw error;

      await loadAcademics();
      setMessage('Timetable entry deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  async function handleDeleteUpdate(update: ClassroomUpdate) {
    const confirmed = window.confirm(`Delete classroom update "${update.title}"?`);

    if (!confirmed) {
      return;
    }

    setBusyDeleteId(update.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('classroom_updates').delete().eq('id', update.id);
      if (error) throw error;

      await loadAcademics();
      setMessage('Classroom update deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  const classLookup = classes.reduce<Record<string, string>>((accumulator, schoolClass) => {
    accumulator[schoolClass.id] = schoolClass.name;
    return accumulator;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic Management"
        title="Timetable, activities and classroom publishing"
        description="Manage class routines, activity scheduling and daily classroom updates that can later be extended into lesson plans and worksheet sharing."
      />

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Timetable overview"
          description="Review scheduled activities and class flow."
          action={
            <button className="button-primary gap-2" onClick={openAddTimetable} type="button">
              <Plus className="h-4 w-4" />
              Add timetable
            </button>
          }
        >
          <DataTable
            columns={[
              { key: 'class', label: 'Class', render: (row) => classLookup[row.class_id] ?? 'Unknown class' },
              { key: 'weekday', label: 'Day', render: (row) => row.weekday },
              { key: 'time', label: 'Time', render: (row) => `${row.start_time} - ${row.end_time}` },
              { key: 'title', label: 'Activity', render: (row) => row.title },
              {
                key: 'action',
                label: 'Action',
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary px-3 py-2 text-xs" onClick={() => openEditTimetable(row)} type="button">
                      <PencilLine className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button className="button-danger px-3 py-2 text-xs" disabled={busyDeleteId === row.id} onClick={() => void handleDeleteTimetable(row)} type="button">
                      <Trash2 className="h-3.5 w-3.5" />
                      {busyDeleteId === row.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ),
              },
            ]}
            emptyMessage="No timetable entries added yet."
            rows={timetableEntries}
          />
        </SectionCard>

        <SectionCard
          title="Published classroom updates"
          description="Recent updates shared from the classroom."
          action={
            <button className="button-primary gap-2" onClick={openAddUpdate} type="button">
              <Plus className="h-4 w-4" />
              Add update
            </button>
          }
        >
          <DataTable
            columns={[
              { key: 'class', label: 'Class', render: (row) => classLookup[row.class_id] ?? 'Unknown class' },
              { key: 'title', label: 'Title', render: (row) => <span className="font-bold">{row.title}</span> },
              { key: 'description', label: 'Summary', render: (row) => row.description ?? 'No description' },
              { key: 'published', label: 'Published', render: (row) => formatDateTime(row.published_at) },
              {
                key: 'action',
                label: 'Action',
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary px-3 py-2 text-xs" onClick={() => openEditUpdate(row)} type="button">
                      <PencilLine className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button className="button-danger px-3 py-2 text-xs" disabled={busyDeleteId === row.id} onClick={() => void handleDeleteUpdate(row)} type="button">
                      <Trash2 className="h-3.5 w-3.5" />
                      {busyDeleteId === row.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ),
              },
            ]}
            emptyMessage="No classroom updates yet."
            rows={classroomUpdates}
          />
        </SectionCard>
      </div>

      <Modal
        description="Choose a class, weekday and activity timing."
        onClose={closeAcademicsModal}
        open={academicsModal === 'timetable'}
        title={editingTimetableId ? 'Edit timetable entry' : 'Add timetable entry'}
        size="lg"
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleTimetableSubmit}>
          <div>
            <label className="form-label">Class</label>
            <select className="form-input" onChange={(event) => setTimetableForm((current) => ({ ...current, class_id: event.target.value }))} required value={timetableForm.class_id}>
              <option value="">Select class</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Weekday</label>
            <select className="form-input" onChange={(event) => setTimetableForm((current) => ({ ...current, weekday: event.target.value }))} value={timetableForm.weekday}>
              <option value="monday">Monday</option>
              <option value="tuesday">Tuesday</option>
              <option value="wednesday">Wednesday</option>
              <option value="thursday">Thursday</option>
              <option value="friday">Friday</option>
              <option value="saturday">Saturday</option>
            </select>
          </div>
          <div>
            <label className="form-label">Category</label>
            <input className="form-input" onChange={(event) => setTimetableForm((current) => ({ ...current, category: event.target.value }))} placeholder="circle time" value={timetableForm.category} />
          </div>
          <div>
            <label className="form-label">Start time</label>
            <input className="form-input" onChange={(event) => setTimetableForm((current) => ({ ...current, start_time: event.target.value }))} required type="time" value={timetableForm.start_time} />
          </div>
          <div>
            <label className="form-label">End time</label>
            <input className="form-input" onChange={(event) => setTimetableForm((current) => ({ ...current, end_time: event.target.value }))} required type="time" value={timetableForm.end_time} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Activity title</label>
            <input className="form-input" onChange={(event) => setTimetableForm((current) => ({ ...current, title: event.target.value }))} placeholder="Story time" required value={timetableForm.title} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button className="button-secondary" onClick={closeAcademicsModal} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingTimetableId ? 'Save timetable' : 'Add timetable'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        description="Publish or edit a classroom summary for a class."
        onClose={closeAcademicsModal}
        open={academicsModal === 'update'}
        title={editingUpdateId ? 'Edit classroom update' : 'Add classroom update'}
        size="lg"
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleUpdateSubmit}>
          <div>
            <label className="form-label">Class</label>
            <select className="form-input" onChange={(event) => setUpdateForm((current) => ({ ...current, class_id: event.target.value }))} required value={updateForm.class_id}>
              <option value="">Select class</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Title</label>
            <input className="form-input" onChange={(event) => setUpdateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Today we learned about colors" required value={updateForm.title} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Description</label>
            <textarea className="form-input min-h-28" onChange={(event) => setUpdateForm((current) => ({ ...current, description: event.target.value }))} value={updateForm.description} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button className="button-secondary" onClick={closeAcademicsModal} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              Send update
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
