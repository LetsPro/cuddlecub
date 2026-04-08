import {
  Bell,
  BookOpenText,
  CalendarDays,
  HeartPulse,
  Home,
  MessageSquareWarning,
  Sparkles,
  Users,
} from 'lucide-react';
import type { WorkspaceNavItem } from '../types/navigation';

export const staffNavItems: WorkspaceNavItem[] = [
  { group: 'Overview', label: 'Dashboard', description: 'Assigned class overview and pending work', path: '/staff', icon: Home },
  { group: 'Overview', label: 'Students', description: 'Assigned students, contacts and alerts', path: '/staff/students', icon: Users },
  { group: 'Classroom', label: 'Attendance', description: 'Daily attendance, late notes and submission', path: '/staff/attendance', icon: Bell },
  { group: 'Classroom', label: 'Daily Activity', description: 'Meal, nap, mood and care updates', path: '/staff/daily-activity', icon: HeartPulse },
  { group: 'Classroom', label: 'Academics', description: 'Worksheets, homework and progress notes', path: '/staff/academics', icon: BookOpenText },
  { group: 'Coordination', label: 'Communication', description: 'Requests, incidents and urgent concerns', path: '/staff/communication', icon: MessageSquareWarning },
  { group: 'Coordination', label: 'Celebrations', description: 'Birthdays, creatives and class photos', path: '/staff/celebrations', icon: Sparkles },
  { group: 'Coordination', label: 'Schedule', description: 'Timetable, meetings and event calendar', path: '/staff/schedule', icon: CalendarDays },
];
