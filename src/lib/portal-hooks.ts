import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from './app-context';
import { fetchLinkedStudentsForParent, fetchStudentsForStaff } from './portal-data';
import { getCurrentParentRecord, getCurrentStaffRecord } from './portal';
import { getErrorMessage } from './supabase';
import type { ParentRecord, StaffRecord, StudentRecord } from '../types/app';

export function useStaffPortal() {
  const { session, school } = useAppContext();
  const [staffRecord, setStaffRecord] = useState<StaffRecord | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const currentStaff = await getCurrentStaffRecord(session.user, school.id);
      setStaffRecord(currentStaff);

      if (currentStaff) {
        const assignedStudents = await fetchStudentsForStaff(currentStaff, school.id);
        setStudents(assignedStudents);
      } else {
        setStudents([]);
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [school.id, session.user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { staffRecord, students, loading, message, reload: load };
}

export function useParentPortal() {
  const { session, school } = useAppContext();
  const [parentRecord, setParentRecord] = useState<ParentRecord | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const currentParent = await getCurrentParentRecord(session.user, school.id);
      setParentRecord(currentParent);

      if (currentParent) {
        const linkedStudents = await fetchLinkedStudentsForParent(currentParent, school.id);
        setStudents(linkedStudents);
      } else {
        setStudents([]);
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [school.id, session.user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { parentRecord, students, loading, message, reload: load };
}

export function useClassFilter(students: StudentRecord[], defaultClassId?: string | null) {
  const availableClasses = useMemo(() => {
    const classMap = new Map<string, string>();
    students.forEach((s) => {
      if (s.class_id) classMap.set(s.class_id, s.class_name ?? 'Class');
    });
    return Array.from(classMap, ([id, name]) => ({ id, name }));
  }, [students]);

  const [selectedClassId, setSelectedClassId] = useState('');

  useEffect(() => {
    if (!availableClasses.length) return;
    if (selectedClassId && availableClasses.some((c) => c.id === selectedClassId)) return;
    const preferred = defaultClassId && availableClasses.find((c) => c.id === defaultClassId);
    setSelectedClassId(preferred ? defaultClassId! : availableClasses[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableClasses.map((c) => c.id).join(','), defaultClassId]);

  const filteredStudents = useMemo(
    () => (selectedClassId ? students.filter((s) => s.class_id === selectedClassId) : students),
    [students, selectedClassId],
  );

  const studentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach((s) => {
      if (s.class_id) counts[s.class_id] = (counts[s.class_id] ?? 0) + 1;
    });
    return counts;
  }, [students]);

  return { availableClasses, selectedClassId, setSelectedClassId, filteredStudents, studentCounts };
}
