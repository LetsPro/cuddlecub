import { supabase } from './supabase';
import type { ParentRecord, StaffRecord, StudentRecord } from '../types/app';

export function staffHasPermission(staff: StaffRecord | null | undefined, permission: string) {
  return Boolean(staff?.permissions?.includes(permission) || staff?.permissions?.includes('all_students'));
}

export async function fetchStudentsForStaff(staff: StaffRecord, schoolId: string) {
  const canSeeAll = staffHasPermission(staff, 'student_access') || staffHasPermission(staff, 'attendance_manage') || staffHasPermission(staff, 'daily_activity');

  if (!staff.class_teacher_for && !canSeeAll) {
    return [] as StudentRecord[];
  }

  let query = supabase
    .from('students')
    .select('*, classes(name), sections(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('first_name');

  if (!canSeeAll && staff.class_teacher_for) {
    query = query.eq('class_id', staff.class_teacher_for);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, any>>).map((row) => ({
    ...(row as StudentRecord),
    class_name: row.classes?.name ?? null,
    section_name: row.sections?.name ?? null,
  }));
}

export async function fetchLinkedStudentsForParent(parent: ParentRecord, schoolId: string) {
  const { data, error } = await supabase
    .from('student_parents')
    .select('students(*, classes(name), sections(name))')
    .eq('school_id', schoolId)
    .eq('parent_id', parent.id);

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, any>>)
    .map((row) => row.students)
    .filter(Boolean)
    .map((row) => ({
      ...(row as StudentRecord),
      class_name: row.classes?.name ?? null,
      section_name: row.sections?.name ?? null,
    })) as StudentRecord[];
}

export function buildStudentNameMap(students: StudentRecord[]) {
  return students.reduce<Record<string, string>>((accumulator, student) => {
    accumulator[student.id] = `${student.first_name} ${student.last_name}`;
    return accumulator;
  }, {});
}
