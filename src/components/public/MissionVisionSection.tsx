import { Compass, Star } from 'lucide-react';
import { useState } from 'react';

interface MissionVisionSectionProps {
  mission: string;
  vision: string;
}

export function MissionVisionSection({ mission, vision }: MissionVisionSectionProps) {
  const [activeTab, setActiveTab] = useState<'mission' | 'vision'>('mission');
  const isMissionActive = activeTab === 'mission';

  return (
    <section className="kids-bubble-card relative overflow-hidden rounded-[2.8rem] p-7 sm:p-10">
      <div aria-hidden className="absolute -right-12 top-10 h-28 w-28 rounded-full bg-[rgb(125_211_252_/_0.24)] blur-2xl" />
      <div aria-hidden className="absolute bottom-8 left-8 h-24 w-24 rounded-full bg-[rgb(251_207_232_/_0.28)] blur-2xl" />

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="inline-flex rounded-full border border-white/80 bg-white/92 p-1.5 shadow-[0_20px_34px_-24px_rgba(15,23,42,0.28)]">
          <button
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition sm:text-base ${
              isMissionActive ? 'bg-[var(--school-primary)] text-white shadow-[0_14px_26px_-18px_rgba(var(--school-primary-rgb),0.75)]' : 'text-slate-600'
            }`}
            onClick={() => setActiveTab('mission')}
            type="button"
          >
            <span className="theme-icon-gradient flex h-8 w-8 items-center justify-center rounded-full text-white">
              <Compass className="h-4 w-4" />
            </span>
            Mission
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition sm:text-base ${
              !isMissionActive ? 'bg-[var(--school-primary)] text-white shadow-[0_14px_26px_-18px_rgba(var(--school-primary-rgb),0.75)]' : 'text-slate-600'
            }`}
            onClick={() => setActiveTab('vision')}
            type="button"
          >
            <span className="theme-icon-gradient flex h-8 w-8 items-center justify-center rounded-full text-white">
              <Star className="h-4 w-4" />
            </span>
            Vision
          </button>
        </div>

        <article className="mt-8 rounded-[2.2rem] border border-white/80 bg-white/88 p-7 shadow-[0_26px_52px_-36px_rgba(15,23,42,0.3)] sm:p-8">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{isMissionActive ? 'Mission' : 'Vision'}</p>
            <h3 className="mt-2 text-2xl font-extrabold">{isMissionActive ? 'Our mission' : 'Our vision'}</h3>
          </div>

          <p className="mt-6 text-base leading-8 text-slate-600 sm:text-lg">{isMissionActive ? mission : vision}</p>
        </article>
      </div>
    </section>
  );
}
