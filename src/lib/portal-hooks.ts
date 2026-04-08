import { useCallback, useEffect, useState } from 'react';
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
