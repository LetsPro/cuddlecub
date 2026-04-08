import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { ThemedLoader } from '../../components/ThemedLoader';
import { useStaffPortal } from '../../lib/portal-hooks';
import { staffHasPermission } from '../../lib/portal-data';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';

export function StaffStudentsPage() {
  const { staffRecord, students, loading, message } = useStaffPortal();
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

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return students;

    return students.filter((student) =>
      `${student.first_name} ${student.last_name} ${student.admission_number} ${student.class_name ?? ''} ${student.section_name ?? ''}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, students]);

  const selectedStudent = filteredStudents.find((student) => student.id === selectedStudentId) ?? filteredStudents[0] ?? null;
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

      <SectionCard title="Quick search" description="Find a student by name, admission number or class.">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="form-input pl-11" onChange={(event) => setQuery(event.target.value)} placeholder="Search students" value={query} />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Assigned student list" description="Students currently available inside your permissions scope.">
          <DataTable
            columns={[
              {
                key: 'student',
                label: 'Student',
                render: (row) => (
                  <button className="text-left" onClick={() => setSelectedStudentId(row.id)} type="button">
                    <p className="font-bold text-slate-900">{row.first_name} {row.last_name}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{row.admission_number}</p>
                  </button>
                ),
              },
              { key: 'class', label: 'Class', render: (row) => `${row.class_name ?? 'Unassigned'} · ${row.section_name ?? 'No section'}` },
              { key: 'dob', label: 'DOB', render: (row) => formatDate(row.dob) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.is_active ? 'active' : 'inactive'} /> },
            ]}
            emptyMessage="No students found for your assignment."
            rows={filteredStudents}
          />
        </SectionCard>

        <SectionCard title="Student profile" description="Basic profile view for the selected student.">
          {!selectedStudent ? (
            <p className="text-sm text-slate-500">Select a student to view details.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-900">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedStudent.class_name ?? 'Unassigned'} · {selectedStudent.section_name ?? 'No section'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Date of birth</p>
                <p className="mt-1 text-sm text-slate-700">{formatDate(selectedStudent.dob)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Medical alerts</p>
                <p className="mt-1 text-sm text-slate-700">
                  {canViewMedical ? selectedStudent.medical_notes || selectedStudent.allergy_details || 'No medical alerts recorded.' : 'Not permitted'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Parent contact</p>
                <p className="mt-1 text-sm text-slate-700">
                  {canViewParents ? (parentContacts[selectedStudent.id]?.join(', ') || 'No linked parent contact found.') : 'Not permitted'}
                </p>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
