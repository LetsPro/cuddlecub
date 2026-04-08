import type { LucideIcon } from 'lucide-react';

export interface WorkspaceNavItem {
  group: string;
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
}
