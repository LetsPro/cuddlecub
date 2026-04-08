import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { ClassroomUpdate, SchoolClass, Section, TimetableEntry } from '../../types/app';

const timetableSeed = {
  class_id: '',
  section_id: '',
  weekday: 'monday',
  start_time: '',
  end_time: '',
  title: '',
  category: '',
};

const updateSeed = {
  class_id: '',
  section_id: '',
  title: '',
  description: '',
};

export function AcademicsPage() {
  const { school } = useAppContext();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [classroomUpdates, setClassroomUpdates] = useState<ClassroomUpdate[]>([]);
  const [timetableForm, setTimetableForm] = useState(timetableSeed);
  const [updateForm, setUpdateForm] = useState(updateSeed);
  const [message, setMessage] = useState<string | null>(null);

  const filteredSections = useMemo(
    () => sections.filter((section) => !timetableForm.class_id || section.class_id === timetableForm.class_id),
    [sections, timetableForm.class_id],
  );

  const updateSections = useMemo(
    () => sections.filter((section) => !updateForm.class_id || section.class_id === updateForm.class_id),
    [sections, updateForm.class_id],
  );

  useEffect(() => {
    void loadAcademics();
  }, [school.id]);

  async function loadAcademics() {
    setMessage(null);

    try {
      const [classResponse, sectionResponse, timetableResponse, updatesResponse] = await Promise.all([
        supabase.from('classes').select('*').eq('school_id', school.id).order('name'),
        supabase.from('sections').select('*').eq('school_id', school.id).order('name'),
        supabase.from('timetable_entries').select('*').eq('school_id', school.id).order('weekday').order('start_time'),
        supabase.from('classroom_updates').select('*').eq('school_id', school.id).order('published_at', { ascending: false }),
      ]);

      setClasses((classResponse.data ?? []) as SchoolClass[]);
      setSections((sectionResponse.data ?? []) as Section[]);
      setTimetableEntries((timetableResponse.data ?? []) as TimetableEntry[]);
      setClassroomUpdates((updatesResponse.data ?? []) as ClassroomUpdate[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleTimetableSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const { error } = await supabase.from('timetable_entries').insert({
        school_id: school.id,
        class_id: timetableForm.class_id,
        section_id: timetableForm.section_id || null,
        weekday: timetableForm.weekday,
        start_time: timetableForm.start_time,
        end_time: timetableForm.end_time,
        title: timetableForm.title,
        category: timetableForm.category || null,
      });

      if (error) throw error;
      setTimetableForm(timetableSeed);
      await loadAcademics();
      setMessage('Timetable entry added.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleUpdateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

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
      setUpdateForm(updateSeed);
      await loadAcademics();
      setMessage('Classroom update published.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  const classLookup = classes.reduce<Record<string, string>>((accumulator, schoolClass) => {
    accumulator[schoolClass.id] = schoolClass.name;
    return accumulator;
  }, {});

  const sectionLookup = sections.reduce<Record<string, string>>((accumulator, section) => {
    accumulator[section.id] = section.name;
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

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Timetable management" description="Set the day structure for each class or section.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleTimetableSubmit}>
            <div>
              <label className="form-label">Class</label>
              <select className="form-input" onChange={(event) => setTimetableForm((current) => ({ ...current, class_id: event.target.value, section_id: '' }))} value={timetableForm.class_id}>
                <option value="">Select class</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Section</label>
              <select className="form-input" onChange={(event) => setTimetableForm((current) => ({ ...current, section_id: event.target.value }))} value={timetableForm.section_id}>
                <option value="">All sections</option>
                {filteredSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
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
              <input className="form-input" onChange={(event) => setTimetableForm((current) => ({ ...current, start_time: event.target.value }))} type="time" value={timetableForm.start_time} />
            </div>
            <div>
              <label className="form-label">End time</label>
              <input className="form-input" onChange={(event) => setTimetableForm((current) => ({ ...current, end_time: event.target.value }))} type="time" value={timetableForm.end_time} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Activity title</label>
              <input className="form-input" onChange={(event) => setTimetableForm((current) => ({ ...current, title: event.target.value }))} placeholder="Story time" value={timetableForm.title} />
            </div>
            <div className="md:col-span-2">
              <button className="button-primary" type="submit">
                Add timetable entry
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Daily classroom update" description="Publish quick summaries for parents and administrators.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleUpdateSubmit}>
            <div>
              <label className="form-label">Class</label>
              <select className="form-input" onChange={(event) => setUpdateForm((current) => ({ ...current, class_id: event.target.value, section_id: '' }))} value={updateForm.class_id}>
                <option value="">Select class</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Section</label>
              <select className="form-input" onChange={(event) => setUpdateForm((current) => ({ ...current, section_id: event.target.value }))} value={updateForm.section_id}>
                <option value="">All sections</option>
                {updateSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Title</label>
              <input className="form-input" onChange={(event) => setUpdateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Today we learned about colors" value={updateForm.title} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Description</label>
              <textarea className="form-input min-h-28" onChange={(event) => setUpdateForm((current) => ({ ...current, description: event.target.value }))} value={updateForm.description} />
            </div>
            <div className="md:col-span-2">
              <button className="button-primary" type="submit">
                Publish update
              </button>
            </div>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Timetable overview" description="Review scheduled activities and class flow.">
          <DataTable
            columns={[
              { key: 'class', label: 'Class', render: (row) => classLookup[row.class_id] ?? 'Unknown class' },
              { key: 'section', label: 'Section', render: (row) => (row.section_id ? sectionLookup[row.section_id] ?? 'Unknown' : 'All sections') },
              { key: 'weekday', label: 'Day', render: (row) => row.weekday },
              { key: 'time', label: 'Time', render: (row) => `${row.start_time} - ${row.end_time}` },
              { key: 'title', label: 'Activity', render: (row) => row.title },
            ]}
            emptyMessage="No timetable entries added yet."
            rows={timetableEntries}
          />
        </SectionCard>

        <SectionCard title="Published classroom updates" description="Recent updates shared from the classroom.">
          <DataTable
            columns={[
              { key: 'class', label: 'Class', render: (row) => classLookup[row.class_id] ?? 'Unknown class' },
              { key: 'title', label: 'Title', render: (row) => <span className="font-bold">{row.title}</span> },
              { key: 'description', label: 'Summary', render: (row) => row.description ?? 'No description' },
              { key: 'published', label: 'Published', render: (row) => formatDateTime(row.published_at) },
            ]}
            emptyMessage="No classroom updates yet."
            rows={classroomUpdates}
          />
        </SectionCard>
      </div>
    </div>
  );
}
