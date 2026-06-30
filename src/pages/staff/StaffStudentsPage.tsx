import { useEffect, useMemo, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import { ClassSelector } from '../../components/ClassSelector';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { ThemedLoader } from '../../components/ThemedLoader';
import { useClassFilter, useStaffPortal } from '../../lib/portal-hooks';
import { staffHasPermission } from '../../lib/portal-data';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';

export function StaffStudentsPage() {
  const { staffRecord, students, loading, message } = useStaffPortal();
  const { availableClasses, selectedClassId, setSelectedClassId, filteredStudents, studentCounts } =
    useClassFilter(students, staffRecord?.assigned_class_ids?.[0] ?? staffRecord?.class_teacher_for);

  const [query, setQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [parentContacts, setParentContacts] = useState<Record<string, string[]>>({});
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!students.length) return;
    void loadParentContacts();
  }, [students.map((student) => student.id).join('|')]);

  async function loadParentContacts() {
    setLoadMessage(null);

    try {
      const { data, error } = await supabase
        .from('student_parents')
        .select('student_id, parents(full_name, phone_number, whatsapp_number)')
        .in('student_id', students.map((student) => student.id));

      if (error) throw error;

      const map = ((data ?? []) as Array<Record<string, any>>).reduce<Record<string, string[]>>((accumulator, row) => {
        const value = row.parents
          ? `${row.parents.full_name} · ${row.parents.whatsapp_number || row.parents.phone_number || 'No phone'}`
          : null;

        if (value) {
          accumulator[row.student_id] = [...(accumulator[row.student_id] ?? []), value];
        }

        return accumulator;
      }, {});

      setParentContacts(map);
    } catch (error) {
      setLoadMessage(getErrorMessage(error));
    }
  }

  const displayedStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return filteredStudents;
    return filteredStudents.filter((s) =>
      `${s.first_name} ${s.last_name} ${s.admission_number} ${s.class_name ?? ''}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, filteredStudents]);

  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null;
  const canViewParents = staffHasPermission(staffRecord, 'parent_contact_view') || staffHasPermission(staffRecord, 'student_access');
  const canViewMedical = staffHasPermission(staffRecord, 'medical_view') || staffRecord?.role === 'teacher';

  if (loading) {
    return (
      <SectionCard title="Assigned students" description="Loading your roster.">
        <ThemedLoader description="Fetching assigned students and their classroom details." label="Loading students..." size="sm" />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student Access"
        title="Search and review assigned students"
        description="Open basic profiles, class placement, parent contacts where permitted, and allergy or medical notes for the children assigned to you."
      />

      {message || loadMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message || loadMessage}</div>
      ) : null}

      <ClassSelector
        classes={availableClasses}
        counts={studentCounts}
        onChange={setSelectedClassId}
        selectedClassId={selectedClassId}
      />

      <SectionCard title="Quick search" description="Find a student by name, admission number or class.">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="form-input pl-11" onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, admission number or class" value={query} />
        </div>
      </SectionCard>

      <SectionCard title="Assigned student list" description="Select a student to open the complete profile, photo, class placement, and permitted contact details.">
          <DataTable
            columns={[
              {
                key: 'student',
                label: 'Student',
                render: (row) => (
                  <button className="flex items-center gap-3 text-left" onClick={() => setSelectedStudentId(row.id)} type="button">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-500">
                      {row.photo_url ? <img alt={`${row.first_name} ${row.last_name}`} className="h-full w-full object-cover" src={row.photo_url} /> : <UserRound className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{row.first_name} {row.last_name}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{row.admission_number}</p>
                    </div>
                  </button>
                ),
              },
              { key: 'class', label: 'Class', render: (row) => row.class_name ?? 'Unassigned' },
              { key: 'dob', label: 'DOB', render: (row) => formatDate(row.dob) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.is_active ? 'active' : 'inactive'} /> },
            ]}
            emptyMessage="No students found for your assignment."
            rows={displayedStudents}
          />
      </SectionCard>

      <Modal
        description="Complete student information available within your teacher permissions."
        onClose={() => setSelectedStudentId(null)}
        open={Boolean(selectedStudent)}
        size="lg"
        title={selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : 'Student details'}
      >
        {selectedStudent ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-5 rounded-[1.5rem] bg-slate-50 p-5 sm:flex-row sm:items-center">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[1.5rem] bg-white text-slate-400 shadow-sm">
                {selectedStudent.photo_url ? (
                  <img alt={`${selectedStudent.first_name} ${selectedStudent.last_name}`} className="h-full w-full object-cover" src={selectedStudent.photo_url} />
                ) : <UserRound className="h-10 w-10" />}
              </div>
              <div>
                <p className="text-xl font-extrabold text-slate-900">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                <p className="mt-1 text-sm text-slate-500">Admission no. {selectedStudent.admission_number}</p>
                <p className="mt-3 inline-flex rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">
                  {selectedStudent.class_name ?? 'Unassigned'}
                </p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Detail label="Date of birth" value={formatDate(selectedStudent.dob)} />
              <Detail label="Gender" value={selectedStudent.gender || 'Not recorded'} />
              <Detail label="Class assigned" value={selectedStudent.class_name ?? 'Unassigned'} />
              <Detail label="Emergency contact" value={canViewParents ? [selectedStudent.emergency_contact_name, selectedStudent.emergency_contact_phone].filter(Boolean).join(' · ') || 'Not recorded' : 'Not permitted'} />
              <Detail label="Parent contact" value={canViewParents ? parentContacts[selectedStudent.id]?.join(', ') || 'No linked parent contact found.' : 'Not permitted'} />
              <Detail label="Allergy details" value={canViewMedical ? selectedStudent.allergy_details || 'None recorded' : 'Not permitted'} />
              <Detail label="Medical notes" value={canViewMedical ? selectedStudent.medical_notes || 'None recorded' : 'Not permitted'} />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}
