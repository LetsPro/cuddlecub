import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';
import type { WorkspaceNavItem } from '../types/navigation';

interface WorkspaceMobileNavProps {
  navItems: WorkspaceNavItem[];
}

export function WorkspaceMobileNav({ navItems }: WorkspaceMobileNavProps) {
  return (
    <div className="lg:hidden">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/staff' || item.path === '/parent' || item.path === '/'}
              style={({ isActive }) =>
                isActive
                  ? {
                      background: 'linear-gradient(135deg, var(--school-primary), rgb(var(--school-secondary-rgb) / 0.94))',
                    }
                  : undefined
              }
              className={({ isActive }) =>
                cn(
                  'flex min-w-[150px] shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition',
                  isActive
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-white/70 bg-white/60 text-slate-600',
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
