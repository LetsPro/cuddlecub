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
      background: 'rgb(var(--school-primary-rgb) / 0.08)',
      color: 'var(--school-primary)',
    },
    teal: {
      background: 'rgb(var(--school-secondary-rgb) / 0.08)',
      color: 'var(--school-secondary)',
    },
    slate: {
      background: 'rgb(248 250 252)',
      color: '#475569',
    },
  };

  return (
    <div className={cn('rounded-xl border border-slate-200 p-5 shadow-sm')} style={{ background: toneStyles[tone].background }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {meta ? <p className="mt-2 text-xs font-medium text-slate-500">{meta}</p> : null}
        </div>
        <div className="rounded-lg bg-white p-2.5" style={{ color: toneStyles[tone].color }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
