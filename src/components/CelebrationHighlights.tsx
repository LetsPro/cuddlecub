import { useEffect, useMemo, useState } from 'react';
import { Cake, Clock3, Image as ImageIcon, Sparkles } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { useAppContext } from '../lib/app-context';
import { getErrorMessage, supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/utils';
import type { StaffRequest } from '../types/app';

const celebrationCategories = ['birthday_photo', 'celebration_photo', 'content_suggestion'];
const activeWindowHours = 24;

export function CelebrationHighlights() {
  const { school } = useAppContext();
  const [items, setItems] = useState<StaffRequest[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadCelebrations();
  }, [school.id]);

  async function loadCelebrations() {
    setMessage(null);

    try {
      const cutoff = new Date(Date.now() - activeWindowHours * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('staff_requests')
        .select('*, students(first_name, last_name, class_id, classes(name)), staff(full_name)')
        .eq('school_id', school.id)
        .in('category', celebrationCategories)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      setItems((data ?? []) as StaffRequest[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  const activeItems = useMemo(
    () =>
      items.filter((item) => {
        const createdAt = new Date(item.created_at).getTime();
        return Number.isFinite(createdAt) && Date.now() - createdAt < activeWindowHours * 60 * 60 * 1000;
      }),
    [items],
  );

  if (!activeItems.length && !message) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-rose-50 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-amber-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Celebration wall</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-950">Today&apos;s classroom celebrations</h2>
            <p className="mt-1 text-sm text-slate-600">Visible to admin, teachers and parents for 24 hours from posting.</p>
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
          <Clock3 className="h-4 w-4 text-amber-600" />
          24 hrs active
        </div>
      </div>

      {message ? <div className="px-5 py-4 text-sm text-rose-700">{message}</div> : null}

      {activeItems.length ? (
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          {activeItems.map((item) => {
            const studentName = item.students ? `${item.students.first_name} ${item.students.last_name}` : 'School celebration';
            const className = item.students?.classes?.name ?? 'All classes';
            const hoursLeft = Math.max(0, Math.ceil(activeWindowHours - (Date.now() - new Date(item.created_at).getTime()) / (60 * 60 * 1000)));

            return (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-white bg-white shadow-sm">
                <div className="aspect-[4/3] bg-amber-50">
                  {item.file_url ? (
                    <img alt={item.title} className="h-full w-full object-cover" src={item.file_url} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-amber-500">
                      <Cake className="h-12 w-12" />
                    </div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-extrabold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{studentName}</p>
                    </div>
                    <StatusBadge value={item.status} />
                  </div>
                  <p className="line-clamp-2 text-sm leading-6 text-slate-600">{item.message}</p>
                  <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1">{className}</span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{hoursLeft}h left</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-400">
                    <span>{item.staff?.full_name ?? 'Teacher'}</span>
                    <span>{formatDateTime(item.created_at)}</span>
                  </div>
                  {item.file_url ? (
                    <a className="inline-flex items-center gap-2 text-sm font-bold theme-text-primary" href={item.file_url} rel="noreferrer" target="_blank">
                      <ImageIcon className="h-4 w-4" />
                      View image
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
