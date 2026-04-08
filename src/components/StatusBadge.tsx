import { cn } from '../lib/utils';

interface StatusBadgeProps {
  value: string | null | undefined;
}

export function StatusBadge({ value }: StatusBadgeProps) {
  const normalized = (value ?? 'unknown').toLowerCase();
  const tone =
    normalized.includes('paid') || normalized.includes('sent') || normalized.includes('present') || normalized.includes('active')
      ? 'bg-teal-100 text-teal-700'
      : normalized.includes('pending') || normalized.includes('scheduled') || normalized.includes('waitlist')
        ? 'bg-amber-100 text-amber-700'
        : normalized.includes('cancel') || normalized.includes('inactive') || normalized.includes('absent') || normalized.includes('failed')
          ? 'bg-rose-100 text-rose-700'
          : 'bg-slate-100 text-slate-700';

  return (
    <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]', tone)}>
      {value ?? 'Unknown'}
    </span>
  );
}
