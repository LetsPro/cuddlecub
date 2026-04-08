import { adminNavItems } from '../data/admin-nav';
import { WorkspaceLayout } from './WorkspaceLayout';

export function AdminLayout() {
  return <WorkspaceLayout navItems={adminNavItems} workspaceLabel="School Workspace" />;
}
