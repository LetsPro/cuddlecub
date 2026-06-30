import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useAppContext } from '../lib/app-context';
import { cn, getInitials } from '../lib/utils';
import type { WorkspaceNavItem } from '../types/navigation';

interface WorkspaceSidebarProps {
  navItems: WorkspaceNavItem[];
}

export function WorkspaceSidebar({ navItems }: WorkspaceSidebarProps) {
  const { school } = useAppContext();
  const location = useLocation();
  const groupedItems = useMemo(
    () =>
      navItems.reduce<Array<{ group: string; items: WorkspaceNavItem[] }>>((accumulator, item) => {
        const existingGroup = accumulator.find((entry) => entry.group === item.group);

        if (existingGroup) {
          existingGroup.items.push(item);
          return accumulator;
        }

        accumulator.push({ group: item.group, items: [item] });
        return accumulator;
      }, []),
    [navItems],
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    groupedItems.reduce<Record<string, boolean>>((accumulator, group) => {
      accumulator[group.group] = true;
      return accumulator;
    }, {}),
  );

  function isItemActive(path: string) {
    if (path === '/' || path === '/staff' || path === '/parent') {
      return location.pathname === path;
    }

    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  const activeGroup = groupedItems.find((group) => group.items.some((item) => isItemActive(item.path)))?.group;

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };

      groupedItems.forEach((group, index) => {
        if (typeof next[group.group] === 'undefined') {
          next[group.group] = true;
        }
      });

      if (activeGroup) {
        next[activeGroup] = true;
      }

      return next;
    });
  }, [activeGroup, groupedItems]);

  function toggleGroup(groupName: string) {
    setOpenGroups((current) => ({
      ...current,
      [groupName]: !current[groupName],
    }));
  }

  return (
    <aside className="hidden h-full w-80 shrink-0 lg:block">
      <div
        className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/20 p-6 text-white shadow-soft"
        style={{
          background:
            'radial-gradient(circle at top left, rgb(var(--school-primary-rgb) / 0.24), transparent 34%), radial-gradient(circle at bottom right, rgb(var(--school-secondary-rgb) / 0.22), transparent 44%), linear-gradient(180deg, var(--school-shell-start), var(--school-shell-end))',
        }}
      >
        <div className="rounded-[1.5rem] border border-white/10 bg-white/8 p-5">
          <div className="flex items-center gap-3">
            {school.logo_url ? (
              <img alt={school.name} className="h-16 w-16 rounded-[1.25rem] object-cover ring-1 ring-white/15" src={school.logo_url} />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] text-lg font-extrabold text-white"
                style={{ background: 'linear-gradient(135deg, rgb(var(--school-primary-rgb) / 0.34), rgb(var(--school-secondary-rgb) / 0.28))' }}
              >
                {getInitials(school.name)}
              </div>
            )}
            <h2 className="min-w-0 text-2xl font-bold leading-tight text-white">{school.name}</h2>
          </div>
        </div>

        <nav className="mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto pr-2">
          {groupedItems.map((group) => (
            <div key={group.group}>
              <button
                className={cn(
                  'flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition',
                  openGroups[group.group] ? 'bg-white/8 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
                )}
                onClick={() => toggleGroup(group.group)}
                type="button"
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.24em]">{group.group}</span>
                <ChevronDown className={cn('h-4 w-4 transition', openGroups[group.group] ? 'rotate-180' : '')} />
              </button>

              {openGroups[group.group] ? (
                <div className="mt-2 space-y-2">
                  {group.items.map((item) => {
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
                            'flex items-start gap-3 rounded-2xl border px-4 py-3 transition',
                            isActive
                              ? 'border-transparent text-white shadow-sm'
                              : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/10 hover:text-white',
                          )
                        }
                      >
                        <div className="rounded-xl bg-slate-100/10 p-2">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-bold">{item.label}</div>
                          <div className="mt-1 text-xs leading-5 opacity-80">{item.description}</div>
                        </div>
                      </NavLink>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
