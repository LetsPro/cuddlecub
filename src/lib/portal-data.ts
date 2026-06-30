import { supabase } from './supabase';
import type { ClassTeacherAssignment, ParentRecord, StaffRecord, StudentRecord } from '../types/app';

export function staffHasPermission(staff: StaffRecord | null | undefined, permission: string) {
  return Boolean(staff?.permissions?.includes(permission) || staff?.permissions?.includes('all_students'));
}

export function formatStudentOption(student: StudentRecord) {
  const placement = student.class_name || 'Unassigned';
  return `${student.first_name} ${student.last_name} - ${placement}`;
}

export async function fetchAssignedClassIdsForStaff(staff: StaffRecord, schoolId: string) {
  const { data: assignmentData, error: assignmentError } = await supabase
    .from('class_teacher_assignments')
    .select('class_id')
    .eq('school_id', schoolId)
    .eq('staff_id', staff.id);

  if (!assignmentError) {
    const assignmentClassIds = ((assignmentData ?? []) as Pick<ClassTeacherAssignment, 'class_id'>[]).map((row) => row.class_id);
    if (assignmentClassIds.length) {
      return assignmentClassIds;
    }
  }

  const { data, error } = await supabase
    .from('classes')
    .select('id')
    .eq('school_id', schoolId)
    .eq('class_teacher_staff_id', staff.id);

  if (error) throw error;

  const classAssignedIds = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);

  if (classAssignedIds.length) {
    return classAssignedIds;
  }

  if (staff.assigned_class_ids?.length) {
    return staff.assigned_class_ids;
  }

  return staff.class_teacher_for ? [staff.class_teacher_for] : [];
}

export async function fetchStudentsForStaff(staff: StaffRecord, schoolId: string) {
  const canSeeAll = staffHasPermission(staff, 'student_access') || staffHasPermission(staff, 'attendance_manage') || staffHasPermission(staff, 'daily_activity');
  const assignedClassIds = await fetchAssignedClassIdsForStaff(staff, schoolId);

  if (!assignedClassIds.length && !canSeeAll) {
    return [] as StudentRecord[];
  }

  let query = supabase
    .from('students')
    .select('*, classes(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('first_name');

  if (!canSeeAll && assignedClassIds.length) {
    query = query.in('class_id', assignedClassIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, any>>).map((row) => ({
    ...(row as StudentRecord),
    class_name: row.classes?.name ?? null,
  }));
}

export async function fetchLinkedStudentsForParent(parent: ParentRecord, schoolId: string) {
  const { data, error } = await supabase
    .from('student_parents')
    .select('students(*, classes(name))')
    .eq('school_id', schoolId)
    .eq('parent_id', parent.id);

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, any>>)
    .map((row) => row.students)
    .filter(Boolean)
    .map((row) => ({
      ...(row as StudentRecord),
      class_name: row.classes?.name ?? null,
    })) as StudentRecord[];
}

export function buildStudentNameMap(students: StudentRecord[]) {
  return students.reduce<Record<string, string>>((accumulator, student) => {
    accumulator[student.id] = `${student.first_name} ${student.last_name}`;
    return accumulator;
  }, {});
}
