import { NavLink } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { adminNavItems } from '../data/admin-nav';
import { useAppContext } from '../lib/app-context';
import { cn } from '../lib/utils';

export function Sidebar() {
  const { school } = useAppContext();
  const settings = (school.settings ?? {}) as Record<string, string>;

  return (
    <aside className="hidden h-full w-80 shrink-0 lg:block">
      <div
        className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/20 p-6 text-white shadow-soft"
        style={{
          background:
            'radial-gradient(circle at top left, rgb(var(--school-primary-rgb) / 0.22), transparent 34%), radial-gradient(circle at bottom right, rgb(var(--school-secondary-rgb) / 0.2), transparent 44%), linear-gradient(180deg, rgba(15,23,42,0.98), rgba(30,41,59,0.96))',
        }}
      >
        <div className="rounded-[1.5rem] border border-white/10 bg-white/8 p-5">
          <div className="flex items-center gap-3">
            <div
              className="rounded-2xl p-3 text-white"
              style={{ background: 'linear-gradient(135deg, rgb(var(--school-primary-rgb) / 0.28), rgb(var(--school-secondary-rgb) / 0.22))' }}
            >
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-white/70">Admin Hub</p>
              <h2 className="mt-1 font-serif text-2xl">KinderCRM</h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            {settings.dashboard_brandline || 'Built for kindergarten operations, parent communication and school delivery.'}
          </p>
        </div>

        <nav className="mt-6 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
          {adminNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-start gap-3 rounded-2xl border px-4 py-3 transition',
                    isActive
                      ? 'border-white/60 bg-white text-slate-950 shadow-sm'
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
        </nav>
      </div>
    </aside>
  );
}
