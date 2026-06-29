import { GraduationCap } from 'lucide-react';

interface ClassSelectorProps {
  classes: Array<{ id: string; name: string }>;
  selectedClassId: string;
  counts?: Record<string, number>;
  onChange: (classId: string) => void;
}

export function ClassSelector({ classes, selectedClassId, counts, onChange }: ClassSelectorProps) {
  if (!classes.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
        <GraduationCap className="h-3.5 w-3.5" />
        Class
      </div>
      <div className="flex flex-wrap gap-2">
        {classes.map((c) => {
          const count = counts?.[c.id];
          const active = selectedClassId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                active
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {c.name}
              {count !== undefined ? (
                <span
                  className={`min-w-[1.25rem] rounded-full px-1.5 text-center text-xs font-bold ${
                    active ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
