import {
  Bell,
  CalendarDays,
  CreditCard,
  HeartPulse,
  Home,
  MessageSquareText,
  UserRound,
  Waves,
} from 'lucide-react';
import type { WorkspaceNavItem } from '../types/navigation';

export const parentNavItems: WorkspaceNavItem[] = [
  { group: 'Overview', label: 'Dashboard', description: 'Child summary, notices and reminders', path: '/parent', icon: Home },
  { group: 'Overview', label: 'Child Profile', description: 'Details, class info and teacher access', path: '/parent/child', icon: UserRound },
  { group: 'Daily', label: 'Attendance', description: 'Daily and monthly attendance history', path: '/parent/attendance', icon: Bell },
  { group: 'Daily', label: 'Daily Activity', description: 'Meals, naps, mood and teacher observations', path: '/parent/daily-activity', icon: HeartPulse },
  { group: 'School', label: 'Fees', description: 'Dues, payments and receipt history', path: '/parent/fees', icon: CreditCard },
  { group: 'School', label: 'Communication', description: 'Notices, alerts and reminders', path: '/parent/communication', icon: MessageSquareText },
  { group: 'School', label: 'Requests', description: 'Leave, pickup and callback requests', path: '/parent/requests', icon: Waves },
  { group: 'School', label: 'Events & Media', description: 'Calendar, photos and birthday creatives', path: '/parent/events', icon: CalendarDays },
];
