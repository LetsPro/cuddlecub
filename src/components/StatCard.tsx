import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'amber' | 'teal' | 'slate';
  meta?: string;
}

export function StatCard({ label, value, icon: Icon, tone = 'amber', meta }: StatCardProps) {
  const toneStyles = {
    amber: {
      background: 'linear-gradient(135deg, rgb(var(--school-primary-rgb) / 0.18) 0%, rgba(255,255,255,0.96) 46%, rgb(var(--school-primary-rgb) / 0.08) 100%)',
      color: 'var(--school-primary)',
    },
    teal: {
      background: 'linear-gradient(135deg, rgb(var(--school-secondary-rgb) / 0.18) 0%, rgba(255,255,255,0.96) 46%, rgb(var(--school-secondary-rgb) / 0.08) 100%)',
      color: 'var(--school-secondary)',
    },
    slate: {
      background: 'linear-gradient(135deg, rgba(226,232,240,0.9) 0%, rgba(255,255,255,0.96) 46%, rgba(241,245,249,0.98) 100%)',
      color: '#475569',
    },
  };

  return (
    <div className={cn('rounded-[1.75rem] border border-white/80 p-5 shadow-soft')} style={{ background: toneStyles[tone].background }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{value}</p>
          {meta ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{meta}</p> : null}
        </div>
        <div className="rounded-2xl bg-white/80 p-3" style={{ color: toneStyles[tone].color }}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
