import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { WorkspaceMobileNav } from '../components/WorkspaceMobileNav';
import { WorkspaceSidebar } from '../components/WorkspaceSidebar';
import { WorkspaceTopbar } from '../components/WorkspaceTopbar';
import { useAppContext } from '../lib/app-context';
import { applyThemeFromSchool, resetSchoolTheme } from '../lib/theme';
import type { WorkspaceNavItem } from '../types/navigation';

interface WorkspaceLayoutProps {
  navItems: WorkspaceNavItem[];
  workspaceLabel: string;
}

export function WorkspaceLayout({ navItems, workspaceLabel }: WorkspaceLayoutProps) {
  const { school } = useAppContext();
  const settings = (school.settings ?? {}) as Record<string, unknown>;
  const themePrimary = typeof settings.theme_primary_color === 'string' ? settings.theme_primary_color : school.primary_color;
  const themeSecondary = typeof settings.theme_secondary_color === 'string' ? settings.theme_secondary_color : school.secondary_color;

  useEffect(() => {
    applyThemeFromSchool({
      primary_color: themePrimary,
      secondary_color: themeSecondary,
      settings: school.settings,
    });

    return () => {
      resetSchoolTheme();
    };
  }, [school.settings, themePrimary, themeSecondary]);

  return (
    <div className="h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex h-full max-w-[1600px] gap-6">
        <WorkspaceSidebar navItems={navItems} />
        <main className="min-w-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-6 pb-8">
            <WorkspaceTopbar workspaceLabel={workspaceLabel} />
            <WorkspaceMobileNav navItems={navItems} />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
