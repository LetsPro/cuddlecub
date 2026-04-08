import { LogOut, School2 } from 'lucide-react';
import { useAppContext } from '../lib/app-context';

interface WorkspaceTopbarProps {
  workspaceLabel: string;
}

export function WorkspaceTopbar({ workspaceLabel }: WorkspaceTopbarProps) {
  const { profile, school, signOut } = useAppContext();
  const settings = (school.settings ?? {}) as Record<string, string>;

  return (
    <div className="card-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div
          className="rounded-2xl p-3 text-white"
          style={{ background: 'linear-gradient(135deg, var(--school-primary), rgb(var(--school-secondary-rgb) / 0.92))' }}
        >
          <School2 className="h-6 w-6" />
        </div>
        <div>
          <p className="theme-text-primary text-xs font-bold uppercase tracking-[0.26em]">
            {settings.dashboard_brandline || workspaceLabel}
          </p>
          <h3 className="mt-1 text-xl font-extrabold text-slate-900">{school.name}</h3>
          <p className="text-sm text-slate-500">{profile.full_name ?? 'User'} · {profile.role}</p>
        </div>
      </div>
      <button className="button-secondary gap-2" onClick={() => void signOut()} type="button">
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
