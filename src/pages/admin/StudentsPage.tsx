import { useEffect, useMemo, useState } from 'react';
import { PencilLine, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { DataTable } from '../../components/DataTable';
import { MediaField } from '../../components/MediaField';
import { Modal } from '../../components/Modal';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { ToastMessage } from '../../lib/toast';
import { formatDate, getInitials } from '../../lib/utils';
import type { ParentRecord, SchoolClass, StudentRecord } from '../../types/app';

const emptyForm = {
  first_name: '',
  last_name: '',
  admission_number: '',
  dob: '',
  gender: 'female',
  class_id: '',
  medical_notes: '',
  allergy_details: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  photo_url: '',
  is_active: true,
};

export function StudentsPage() {
  const { school } = useAppContext();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [studentParents, setStudentParents] = useState<Record<string, string[]>>({});
  const [primaryParentMap, setPrimaryParentMap] = useState<Record<string, string>>({});
  const [form, setForm] = useState(emptyForm);
  const [linkedParentId, setLinkedParentId] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void loadStudents();
  }, [school.id]);

  async function loadStudents() {
    setMessage(null);

    try {
      const [studentResponse, parentResponse, classResponse, linkResponse] = await Promise.all([
        supabase
          .from('students')
          .select('*, classes(name)')
          .eq('school_id', school.id)
          .order('created_at', { ascending: false }),
        supabase.from('parents').select('*').eq('school_id', school.id).order('full_name'),
        supabase.from('classes').select('*').eq('school_id', school.id).order('name'),
        supabase.from('student_parents').select('student_id, parent_id, is_primary, parents(full_name)').eq('school_id', school.id),
      ]);

      if (studentResponse.error) throw studentResponse.error;
      if (parentResponse.error) throw parentResponse.error;
      if (classResponse.error) throw classResponse.error;
      if (linkResponse.error) throw linkResponse.error;

      const studentRows = ((studentResponse.data ?? []) as Array<Record<string, any>>).map((row) => ({
        ...(row as StudentRecord),
        class_name: row.classes?.name ?? null,
      }));

      const nextStudentParents: Record<string, string[]> = {};
      const nextPrimaryParentMap: Record<string, string> = {};

      ((linkResponse.data ?? []) as Array<Record<string, any>>).forEach((row) => {
        const studentId = row.student_id as string | undefined;
        const parentId = row.parent_id as string | undefined;
        const parentName = row.parents?.full_name as string | undefined;
        const isPrimary = Boolean(row.is_primary);

        if (!studentId || !parentName) {
          return;
        }

        nextStudentParents[studentId] = [...(nextStudentParents[studentId] ?? []), parentName];

        if (isPrimary && parentId) {
          nextPrimaryParentMap[studentId] = parentId;
        }
      });

      setStudents(studentRows);
      setParents((parentResponse.data ?? []) as ParentRecord[]);
      setClasses((classResponse.data ?? []) as SchoolClass[]);
      setStudentParents(nextStudentParents);
      setPrimaryParentMap(nextPrimaryParentMap);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function openCreateModal() {
    setEditingStudentId(null);
    setLinkedParentId('');
    setForm(emptyForm);
    setIsFormModalOpen(true);
  }

  function openEditModal(student: StudentRecord) {
    setEditingStudentId(student.id);
    setLinkedParentId(primaryParentMap[student.id] ?? '');
    setForm({
      first_name: student.first_name,
      last_name: student.last_name,
      admission_number: student.admission_number,
      dob: student.dob,
      gender: student.gender,
      class_id: student.class_id ?? '',
      medical_notes: student.medical_notes ?? '',
      allergy_details: student.allergy_details ?? '',
      emergency_contact_name: student.emergency_contact_name ?? '',
      emergency_contact_phone: student.emergency_contact_phone ?? '',
      photo_url: student.photo_url ?? '',
      is_active: student.is_active,
    });
    setIsFormModalOpen(true);
  }

  function closeFormModal() {
    setEditingStudentId(null);
    setLinkedParentId('');
    setForm(emptyForm);
    setIsFormModalOpen(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const isEditing = Boolean(editingStudentId);

    try {
      const payload = {
        school_id: school.id,
        first_name: form.first_name,
        last_name: form.last_name,
        admission_number: form.admission_number,
        dob: form.dob,
        gender: form.gender,
        class_id: form.class_id || null,
        section_id: null,
        medical_notes: form.medical_notes || null,
        allergy_details: form.allergy_details || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        photo_url: form.photo_url || null,
        is_active: form.is_active,
      };

      let studentId = editingStudentId;

      if (editingStudentId) {
        const { error } = await supabase.from('students').update(payload).eq('id', editingStudentId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('students').insert(payload).select('id').single();
        if (error) throw error;
        studentId = data.id as string;
      }

      if (studentId && linkedParentId) {
        const { error: clearPrimaryError } = await supabase
          .from('student_parents')
          .update({ is_primary: false })
          .eq('school_id', school.id)
          .eq('student_id', studentId)
          .eq('is_primary', true);

        if (clearPrimaryError) throw clearPrimaryError;

        const { error: linkError } = await supabase.from('student_parents').upsert({
          school_id: school.id,
          student_id: studentId,
          parent_id: linkedParentId,
          relationship: 'guardian',
          is_primary: true,
        });

        if (linkError) throw linkError;
      }

      await loadStudents();
      closeFormModal();
      setMessage(isEditing ? 'Student updated.' : 'Student added.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteStudent(student: StudentRecord) {
    const confirmed = window.confirm(`Delete ${student.first_name} ${student.last_name}? This will remove the student record and linked student history.`);

    if (!confirmed) {
      return;
    }

    setBusyDeleteId(student.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('students').delete().eq('id', student.id);
      if (error) throw error;

      await loadStudents();
      closeFormModal();
      setMessage('Student deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  const summary = useMemo(
    () => ({
      total: students.length,
      active: students.filter((student) => student.is_active).length,
      assigned: students.filter((student) => Boolean(student.class_id)).length,
      linked: students.filter((student) => (studentParents[student.id] ?? []).length > 0).length,
    }),
    [studentParents, students],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student Management"
        title="Admissions, records and parent links"
        description="Manage child profiles, classroom placement, health notes and parent linking from one clean student directory."
        actions={
          <button className="button-primary gap-2" onClick={openCreateModal} type="button">
            <Plus className="h-4 w-4" />
            Add student
          </button>
        }
      />
      <ToastMessage message={message} />

      <SectionCard
        title="Student list"
        description="A clean view of each child, their class placement, parent links and record status."
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{summary.total} total</span>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{summary.active} active</span>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{summary.assigned} assigned</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{summary.linked} linked</span>
          </div>
        }
      >
        <DataTable
          columns={[
            {
              key: 'student',
              label: 'Student',
              render: (row) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-extrabold text-slate-700">
                    {getInitials(`${row.first_name} ${row.last_name}`)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">
                      {row.first_name} {row.last_name}
                    </p>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{row.admission_number}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'class',
              label: 'Class',
              render: (row) => row.class_name ?? 'Unassigned',
            },
            { key: 'dob', label: 'DOB', render: (row) => formatDate(row.dob) },
            {
              key: 'parents',
              label: 'Linked parents',
              render: (row) => (
                <span className={(studentParents[row.id] ?? []).length ? 'text-slate-700' : 'text-slate-500'}>
                  {(studentParents[row.id] ?? []).length ? studentParents[row.id].join(', ') : 'Not linked'}
                </span>
              ),
            },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.is_active ? 'active' : 'inactive'} /> },
            {
              key: 'action',
              label: 'Action',
              render: (row) => (
                <button className="button-secondary px-3 py-2 text-xs" onClick={() => openEditModal(row)} type="button">
                  <PencilLine className="mr-1 h-3.5 w-3.5" />
                  Edit
                </button>
              ),
            },
          ]}
          emptyMessage="No students found."
          rows={students}
        />
      </SectionCard>

      <Modal
        description="Add the student profile, classroom placement, health details and primary parent link from one focused form."
        onClose={closeFormModal}
        open={isFormModalOpen}
        size="lg"
        title={editingStudentId ? 'Edit student' : 'Add student'}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">First name</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))}
              placeholder="First name"
              required
              value={form.first_name}
            />
          </div>
          <div>
            <label className="form-label">Last name</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))}
              placeholder="Last name"
              required
              value={form.last_name}
            />
          </div>
          <div>
            <label className="form-label">Admission number</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, admission_number: event.target.value }))}
              placeholder="Admission number"
              required
              value={form.admission_number}
            />
          </div>
          <div>
            <label className="form-label">Date of birth</label>
            <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, dob: event.target.value }))} required type="date" value={form.dob} />
          </div>
          <div>
            <label className="form-label">Gender</label>
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))} value={form.gender}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <MediaField
              helperText="Pick or upload the student photo from the shared media library."
              label="Student photo"
              onChange={(value) => setForm((current) => ({ ...current, photo_url: value }))}
              value={form.photo_url}
            />
          </div>
          <div>
            <label className="form-label">Class</label>
            <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, class_id: event.target.value }))} value={form.class_id}>
              <option value="">Select class</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Emergency contact name</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, emergency_contact_name: event.target.value }))}
              placeholder="Emergency contact name"
              value={form.emergency_contact_name}
            />
          </div>
          <div>
            <label className="form-label">Emergency contact phone</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, emergency_contact_phone: event.target.value }))}
              placeholder="Emergency contact phone"
              value={form.emergency_contact_phone}
            />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Primary parent link</label>
            <select className="form-input" onChange={(event) => setLinkedParentId(event.target.value)} value={linkedParentId}>
              <option value="">Select parent</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.full_name}
                </option>
              ))}
            </select>
          </div>
          <label className="md:col-span-2 flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <input checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} type="checkbox" />
            <div>
              <p className="font-semibold text-slate-700">Active student record</p>
              <p className="text-xs text-slate-500">Inactive students remain in the system but won’t appear as active admissions.</p>
            </div>
          </label>
          <div className="md:col-span-2">
            <label className="form-label">Medical notes</label>
            <textarea
              className="form-input min-h-24"
              onChange={(event) => setForm((current) => ({ ...current, medical_notes: event.target.value }))}
              placeholder="Medical notes"
              value={form.medical_notes}
            />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Allergy details</label>
            <textarea
              className="form-input min-h-24"
              onChange={(event) => setForm((current) => ({ ...current, allergy_details: event.target.value }))}
              placeholder="Allergy details"
              value={form.allergy_details}
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            {editingStudentId ? (
              <button
                className="button-danger mr-auto gap-2"
                disabled={busyDeleteId === editingStudentId}
                onClick={() => {
                  const currentStudent = students.find((student) => student.id === editingStudentId);
                  if (currentStudent) {
                    void handleDeleteStudent(currentStudent);
                  }
                }}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
                {busyDeleteId === editingStudentId ? 'Deleting...' : 'Delete student'}
              </button>
            ) : null}
            <button className="button-secondary" onClick={closeFormModal} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingStudentId ? 'Save changes' : 'Add student'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
