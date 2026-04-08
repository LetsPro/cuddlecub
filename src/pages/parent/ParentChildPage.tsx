import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { useAppContext } from '../../lib/app-context';
import { useParentPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { AdmissionRecord, SchoolClass, StaffRecord, StudentRecord } from '../../types/app';

export function ParentChildPage() {
  const { school } = useAppContext();
  const { students, message } = useParentPortal();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<StaffRecord[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!students.length) return;
    void loadChildContext();
  }, [students.map((student) => student.id).join('|')]);

  async function loadChildContext() {
    setLoadMessage(null);

    try {
      const [classResponse, teacherResponse, admissionResponse] = await Promise.all([
        supabase.from('classes').select('*').eq('school_id', school.id),
        supabase.from('staff').select('*').eq('school_id', school.id),
        supabase.from('admissions').select('*').in('student_id', students.map((student) => student.id)),
      ]);

      if (classResponse.error) throw classResponse.error;
      if (teacherResponse.error) throw teacherResponse.error;
      if (admissionResponse.error) throw admissionResponse.error;

      setClasses((classResponse.data ?? []) as SchoolClass[]);
      setTeachers((teacherResponse.data ?? []) as StaffRecord[]);
      setAdmissions((admissionResponse.data ?? []) as AdmissionRecord[]);
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? students[0] ?? null;
  const classLookup = useMemo(() => classes.reduce<Record<string, SchoolClass>>((acc, item) => ({ ...acc, [item.id]: item }), {}), [classes]);
  const teacherLookup = useMemo(() => teachers.reduce<Record<string, StaffRecord>>((acc, item) => ({ ...acc, [item.id]: item }), {}), [teachers]);

  function getTeacher(student: StudentRecord | null) {
    if (!student?.class_id) return null;
    const schoolClass = classLookup[student.class_id];
    const classTeacherId = schoolClass?.class_teacher_staff_id;
    return classTeacherId ? teacherLookup[classTeacherId] ?? null : null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Child Profile"
        title="Child details, classroom and teacher information"
        description="View student details, class and section, photo, admission data and the classroom teacher currently assigned."
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Children" description="Select a child to see the detailed profile.">
          <DataTable
            columns={[
              {
                key: 'child',
                label: 'Child',
                render: (row) => (
                  <button className="text-left" onClick={() => setSelectedStudentId(row.id)} type="button">
                    <p className="font-bold text-slate-900">{row.first_name} {row.last_name}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{row.admission_number}</p>
                  </button>
                ),
              },
              { key: 'class', label: 'Class', render: (row) => `${row.class_name ?? 'Unassigned'} · ${row.section_name ?? 'No section'}` },
              { key: 'dob', label: 'DOB', render: (row) => formatDate(row.dob) },
            ]}
            emptyMessage="No linked children found."
            rows={students}
          />
        </SectionCard>

        <SectionCard title="Selected child profile" description="Basic profile, health notes and admission context.">
          {!selectedStudent ? (
            <p className="text-sm text-slate-500">No child selected.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-900">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedStudent.class_name ?? 'Unassigned'} · {selectedStudent.section_name ?? 'No section'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Medical notes</p>
                <p className="mt-1 text-sm text-slate-700">{selectedStudent.medical_notes || selectedStudent.allergy_details || 'No shared notes.'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Teacher</p>
                <p className="mt-1 text-sm text-slate-700">{getTeacher(selectedStudent)?.full_name ?? 'Teacher not assigned yet'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Admission details</p>
                <p className="mt-1 text-sm text-slate-700">
                  {admissions.find((admission) => admission.student_id === selectedStudent.id)?.status ?? 'No admission record'} · {selectedStudent.admission_number}
                </p>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
