import { useEffect, useMemo, useState } from 'react';
import { UserRound } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { useAppContext } from '../../lib/app-context';
import { useParentPortal } from '../../lib/portal-hooks';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { AdmissionRecord, ClassTeacherAssignment, SchoolClass, StaffRecord, StudentRecord } from '../../types/app';

export function ParentChildPage() {
  const { school } = useAppContext();
  const { students, message } = useParentPortal();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<StaffRecord[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<ClassTeacherAssignment[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!students.length) return;
    void loadChildContext();
  }, [students.map((student) => student.id).join('|')]);

  async function loadChildContext() {
    setLoadMessage(null);

    try {
      const [classResponse, teacherResponse, assignmentResponse, admissionResponse] = await Promise.all([
        supabase.from('classes').select('*').eq('school_id', school.id),
        supabase.from('staff').select('*').eq('school_id', school.id),
        supabase.from('class_teacher_assignments').select('*').eq('school_id', school.id),
        supabase.from('admissions').select('*').in('student_id', students.map((student) => student.id)),
      ]);

      if (classResponse.error) throw classResponse.error;
      if (teacherResponse.error) throw teacherResponse.error;
      if (assignmentResponse.error) throw assignmentResponse.error;
      if (admissionResponse.error) throw admissionResponse.error;

      setClasses((classResponse.data ?? []) as SchoolClass[]);
      setTeachers((teacherResponse.data ?? []) as StaffRecord[]);
      setTeacherAssignments((assignmentResponse.data ?? []) as ClassTeacherAssignment[]);
      setAdmissions((admissionResponse.data ?? []) as AdmissionRecord[]);
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? students[0] ?? null;
  const classLookup = useMemo(() => classes.reduce<Record<string, SchoolClass>>((acc, item) => ({ ...acc, [item.id]: item }), {}), [classes]);
  const teacherLookup = useMemo(() => teachers.reduce<Record<string, StaffRecord>>((acc, item) => ({ ...acc, [item.id]: item }), {}), [teachers]);

  function getTeachers(student: StudentRecord | null) {
    if (!student?.class_id) return null;
    const schoolClass = classLookup[student.class_id];
    const assignedTeacherIds = teacherAssignments
      .filter((assignment) => assignment.class_id === student.class_id)
      .map((assignment) => assignment.staff_id);
    const fallbackTeacherIds = schoolClass?.class_teacher_staff_id ? [schoolClass.class_teacher_staff_id] : [];
    const teacherIds = assignedTeacherIds.length ? assignedTeacherIds : fallbackTeacherIds;
    const teacherNames = teacherIds
      .map((teacherId) => teacherLookup[teacherId]?.full_name)
      .filter((name): name is string => Boolean(name));
    return teacherNames.length ? teacherNames.join(', ') : 'Not assigned';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Child Profile"
        title="Child details, classroom and teacher information"
        description="View student details, class, photo, admission data and the classroom teacher currently assigned."
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <SectionCard title="Choose child" description="Select a child to view their latest school profile.">
        <div className="flex flex-wrap gap-3">
          {students.map((student) => (
            <button
              className={`rounded-2xl border px-4 py-3 text-left transition ${selectedStudent?.id === student.id ? 'theme-border-primary-soft bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              key={student.id}
              onClick={() => setSelectedStudentId(student.id)}
              type="button"
            >
              <p className="font-bold text-slate-900">{student.first_name} {student.last_name}</p>
              <p className="mt-1 text-xs text-slate-500">{student.class_name ?? 'No class'}</p>
            </button>
          ))}
          {!students.length ? <p className="text-sm text-slate-500">No linked children found.</p> : null}
        </div>
      </SectionCard>

      <SectionCard title="Child profile" description="Information maintained by the school.">
          {!selectedStudent ? (
            <p className="text-sm text-slate-500">No child selected.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-5 rounded-[1.5rem] bg-slate-50 p-5 sm:flex-row sm:items-center">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[1.5rem] bg-white text-slate-400 shadow-sm">
                  {selectedStudent.photo_url ? <img alt={`${selectedStudent.first_name} ${selectedStudent.last_name}`} className="h-full w-full object-cover" src={selectedStudent.photo_url} /> : <UserRound className="h-10 w-10" />}
                </div>
                <div>
                  <p className="text-xl font-extrabold text-slate-900">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                  <p className="mt-1 text-sm text-slate-500">Admission no. {selectedStudent.admission_number}</p>
                  <p className="mt-3 inline-flex rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{selectedStudent.class_name ?? 'No class'}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ProfileItem label="Date of birth" value={formatDate(selectedStudent.dob)} />
                <ProfileItem label="Gender" value={selectedStudent.gender || 'Not recorded'} />
                <ProfileItem label="Class teachers" value={getTeachers(selectedStudent) ?? 'Not assigned'} />
                <ProfileItem label="Class" value={selectedStudent.class_name ?? 'Not assigned'} />
                <ProfileItem label="Admission status" value={admissions.find((admission) => admission.student_id === selectedStudent.id)?.status ?? 'No admission record'} />
                <ProfileItem label="Emergency contact" value={[selectedStudent.emergency_contact_name, selectedStudent.emergency_contact_phone].filter(Boolean).join(' · ') || 'Not recorded'} />
                <ProfileItem label="Allergies" value={selectedStudent.allergy_details || 'None recorded'} />
                <ProfileItem label="Medical notes" value={selectedStudent.medical_notes || 'None recorded'} />
              </div>
            </div>
          )}
      </SectionCard>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p><p className="mt-2 text-sm leading-6 text-slate-700">{value}</p></div>;
}
