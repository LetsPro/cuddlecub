import { staffNavItems } from '../data/staff-nav';
import { WorkspaceLayout } from './WorkspaceLayout';

export function StaffLayout() {
  return <WorkspaceLayout navItems={staffNavItems} workspaceLabel="Staff Workspace" />;
}
