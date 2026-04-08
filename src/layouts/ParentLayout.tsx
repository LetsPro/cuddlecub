import { parentNavItems } from '../data/parent-nav';
import { WorkspaceLayout } from './WorkspaceLayout';

export function ParentLayout() {
  return <WorkspaceLayout navItems={parentNavItems} workspaceLabel="Parent Workspace" />;
}
