import { BookOpen, Heart, Palette, Sparkles, Star } from 'lucide-react';
import { usePublicSite } from '../../lib/public-site';

const icons = [Heart, BookOpen, Palette, Star];

export function AboutPage() {
  const { page, school } = usePublicSite();

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1300px] space-y-8">
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="card-panel p-8 sm:p-10">
            <div className="kids-badge">
              <Sparkles className="h-4 w-4" />
              {page.about_eyebrow}
            </div>
            <h1 className="mt-4 font-serif text-4xl text-slate-900 sm:text-5xl">{page.about_title}</h1>
            <p className="mt-5 text-base leading-7 text-slate-600">{page.about_summary}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="kids-pill">
                <Heart className="h-4 w-4 text-brand-600" />
                Kind classrooms
              </div>
              <div className="kids-pill">
                <BookOpen className="h-4 w-4 text-brand-600" />
                Curious learning
              </div>
              <div className="kids-pill">
                <Palette className="h-4 w-4 text-brand-600" />
                Imaginative play
              </div>
            </div>
          </div>
          <div className="kids-bubble-card rounded-[2.5rem] p-8 sm:p-10">
            <p className="text-sm leading-7 text-slate-600">{page.about_story}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">School</p>
                <p className="mt-3 text-2xl font-extrabold text-slate-900">{school?.name ?? 'Preschool Campus'}</p>
              </div>
              <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Brand promise</p>
                <p className="mt-3 text-base font-semibold text-slate-900">Safe, caring, structured, and joyful early learning.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {page.about_points.map((point, index) => {
            const Icon = icons[index % icons.length];

            return (
              <article key={point} className="kids-bubble-card p-6">
                <div className="kids-icon-shell">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-lg font-bold text-slate-900">{point}</p>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
