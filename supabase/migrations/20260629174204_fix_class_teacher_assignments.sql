-- Fix class_teacher_staff_id on classes to match staff.class_teacher_for
-- When a teacher's class_teacher_for points to a class, that class should
-- have class_teacher_staff_id pointing back to that teacher.
UPDATE public.classes c
SET class_teacher_staff_id = s.id
FROM public.staff s
WHERE s.class_teacher_for = c.id
  AND (c.class_teacher_staff_id IS DISTINCT FROM s.id);
