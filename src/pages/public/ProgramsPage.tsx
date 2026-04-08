import { BookOpen, Clock3, Palette, Sparkles, Star, Sun } from 'lucide-react';
import { usePublicSite } from '../../lib/public-site';

const programIcons = [BookOpen, Sparkles, Palette];
const programCardColors = ['#fde68a', '#bfdbfe', '#fecdd3'];

export function ProgramsPage() {
  const { page, programs } = usePublicSite();

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1300px] space-y-8">
        <section className="card-panel p-8 sm:p-10">
          <div className="kids-badge">
            <BookOpen className="h-4 w-4" />
            {page.programs_eyebrow}
          </div>
          <h1 className="mt-4 font-serif text-4xl text-slate-900 sm:text-5xl">{page.programs_title}</h1>
          <p className="mt-5 max-w-4xl text-base leading-7 text-slate-600">{page.programs_intro}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="kids-pill">
              <Star className="h-4 w-4 text-brand-600" />
              Play-based routines
            </div>
            <div className="kids-pill">
              <Palette className="h-4 w-4 text-brand-600" />
              Colourful experiences
            </div>
            <div className="kids-pill">
              <Sun className="h-4 w-4 text-brand-600" />
              Happy school days
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {programs.map((program, index) => {
            const Icon = programIcons[index % programIcons.length];

            return (
              <article key={program.id} className="kids-media-card overflow-hidden rounded-[2.25rem] bg-white">
                <div
                  className="kids-media-frame relative h-56"
                  style={{
                    backgroundColor: program.image_url ? undefined : programCardColors[index % programCardColors.length],
                  }}
                >
                  {program.image_url ? <img alt={program.title} className="h-full w-full object-cover" decoding="async" loading="lazy" src={program.image_url} /> : null}
                  <div className="absolute left-5 top-5">
                    <div className="kids-sticker">
                      <Icon className="h-4 w-4 text-brand-600" />
                      Little achievers
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-2">
                    {program.age_range ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{program.age_range}</span> : null}
                    {program.schedule ? <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{program.schedule}</span> : null}
                  </div>
                  <h2 className="mt-4 text-2xl font-extrabold text-slate-900">{program.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{program.summary}</p>
                  <div className="mt-5 space-y-3">
                    {program.highlights.map((highlight) => (
                      <div key={highlight} className="flex items-start gap-3 text-sm text-slate-600">
                        <Star className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>
                  {program.schedule ? (
                    <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <Clock3 className="h-4 w-4 text-brand-600" />
                      {program.schedule}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
