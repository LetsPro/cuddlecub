import { ArrowRight, BookOpen, Heart, Images, Palette, Sparkles, Star, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeroSlider } from '../../components/public/HeroSlider';
import { ImagePreviewModal } from '../../components/public/ImagePreviewModal';
import { ManagementPanelSection } from '../../components/public/ManagementPanelSection';
import { MissionVisionSection } from '../../components/public/MissionVisionSection';
import { usePublicSite } from '../../lib/public-site';
import { getWebsiteHeroSliderSettings } from '../../lib/website-settings';

const programIcons = [BookOpen, Sparkles, Palette];
const programLabels = ['Tiny explorers', 'Creative learners', 'Bright starters'];
const programColors = ['#fde68a', '#bfdbfe', '#fecdd3'];
const galleryColors = ['#fde68a', '#bfdbfe', '#fecdd3', '#bbf7d0'];
const aboutPointIcons = [Heart, Star, Palette, Sun];
const aboutPointDescription = 'Designed to make every school day feel bright, safe, and exciting for kids.';

export function HomePage() {
  const { page, school, slides, programs, gallery } = usePublicSite();
  const sliderSettings = getWebsiteHeroSliderSettings((school?.settings ?? {}) as Record<string, unknown>);
  const aboutHighlights = page.about_points.slice(0, 4);
  const featuredPrograms = programs.slice(0, 3);
  const featuredGallery = gallery.slice(0, 4);
  const previewItems = featuredGallery.filter((item) => Boolean(item.image_url));
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  function openPreviewByUrl(imageUrl: string) {
    const nextIndex = previewItems.findIndex((item) => item.image_url === imageUrl);
    if (nextIndex >= 0) {
      setPreviewIndex(nextIndex);
    }
  }

  const activePreviewItem = previewIndex !== null ? previewItems[previewIndex] : null;

  return (
    <div className="space-y-10 px-4 pt-4 sm:space-y-12 sm:px-6 sm:pt-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <HeroSlider autoScroll={sliderSettings.autoScroll} intervalMs={sliderSettings.intervalSeconds * 1000} slides={slides} />
      </div>

      <section className="mx-auto grid max-w-[1400px] items-stretch gap-5 lg:grid-cols-[0.95fr_1.15fr]">
        <div className="card-panel h-full p-8 sm:p-10 lg:min-h-[23rem]">
          <div className="kids-badge">
            <Sparkles className="h-4 w-4" />
            {page.about_eyebrow}
          </div>
          <h2 className="mt-5 max-w-[22rem] font-serif text-3xl leading-tight text-slate-900 sm:text-4xl">{page.about_title}</h2>
          <p className="mt-4 max-w-[28rem] text-base leading-7 text-slate-600">{page.about_summary}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="kids-pill">
              <Heart className="h-4 w-4 text-brand-600" />
              Loving care
            </div>
            <div className="kids-pill">
              <Palette className="h-4 w-4 text-brand-600" />
              Creative play
            </div>
            <div className="kids-pill">
              <Sun className="h-4 w-4 text-brand-600" />
              Happy routines
            </div>
          </div>
          <Link className="button-primary mt-8 gap-2 !rounded-full !px-6" to="/about">
            Learn more
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {aboutHighlights.map((point, index) => {
            const Icon = aboutPointIcons[index % aboutPointIcons.length];

            return (
              <article key={point} className="kids-bubble-card relative h-full overflow-hidden rounded-[2.2rem] p-5 sm:p-6 lg:min-h-[11rem]">
                <div aria-hidden className="absolute -right-7 -top-5 h-20 w-20 rounded-full bg-slate-100/92" />
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-slate-100 text-slate-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 max-w-[16rem] text-[1.15rem] font-extrabold leading-8 text-slate-900 sm:text-[1.35rem] sm:leading-9">{point}</h3>
                  <p className="mt-2 max-w-[17rem] text-sm leading-7 text-slate-500">{aboutPointDescription}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="mx-auto max-w-[1400px]">
        <MissionVisionSection mission={page.about_mission} vision={page.about_vision} />
      </div>

      <ManagementPanelSection />

      <section className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="kids-badge">
              <BookOpen className="h-4 w-4" />
              {page.programs_eyebrow}
            </div>
            <h2 className="mt-3 font-serif text-3xl text-slate-900 sm:text-4xl">{page.programs_title}</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{page.programs_intro}</p>
          </div>
          <Link className="button-secondary !rounded-full !px-5" to="/programs">
            View all
          </Link>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {featuredPrograms.map((program, index) => {
            const Icon = programIcons[index % programIcons.length];

            return (
              <article key={program.id} className="kids-media-card overflow-hidden rounded-[2.25rem] bg-white">
                <div
                  className="kids-media-frame relative h-52"
                  style={{
                    backgroundColor: program.image_url ? undefined : programColors[index % programColors.length],
                  }}
                >
                  {program.image_url ? <img alt={program.title} className="h-full w-full object-cover" decoding="async" loading="lazy" src={program.image_url} /> : null}
                  <div className="absolute left-5 top-5">
                    <div className="kids-sticker">
                      <Icon className="h-4 w-4 text-brand-600" />
                      {programLabels[index % programLabels.length]}
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-2">
                    {program.age_range ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{program.age_range}</span> : null}
                    {program.schedule ? <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{program.schedule}</span> : null}
                  </div>
                  <h3 className="mt-4 text-2xl font-extrabold text-slate-900">{program.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{program.summary}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="kids-badge">
              <Images className="h-4 w-4" />
              {page.gallery_eyebrow}
            </div>
            <h2 className="mt-3 font-serif text-3xl text-slate-900 sm:text-4xl">{page.gallery_title}</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{page.gallery_intro}</p>
          </div>
          <Link className="button-secondary !rounded-full !px-5" to="/gallery">
            View gallery
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {featuredGallery.map((item, index) => {
            return (
              <article key={item.id} className="kids-media-card overflow-hidden rounded-[2.25rem] bg-white">
                <div
                  className="kids-media-frame h-64"
                  style={{
                    backgroundColor: item.image_url ? undefined : galleryColors[index % galleryColors.length],
                  }}
                >
                  {item.image_url ? (
                    <>
                      <button aria-label={`Preview ${item.title || 'gallery image'}`} className="absolute inset-0 z-10 cursor-zoom-in" onClick={() => openPreviewByUrl(item.image_url)} type="button" />
                      <img alt={item.title} className="h-full w-full object-cover" decoding="async" loading="lazy" src={item.image_url} />
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] pb-6">
        <div className="theme-dark-surface overflow-hidden rounded-[2.5rem] px-8 py-10 shadow-[0_28px_80px_-28px_rgba(15,23,42,0.55)] sm:px-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="kids-badge !border-white/90 !bg-white !text-slate-900">
                <Star className="h-4 w-4" />
                {school?.name ?? 'School'} admissions
              </div>
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl">Ready to see the school experience more closely?</h2>
              <p className="mt-4 text-base leading-7 text-white/92">
                Explore programs, view daily moments, and sign in to the school portal for operational access.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="kids-pill !border-white/90 !bg-white !text-slate-900">
                  <Heart className="h-4 w-4" />
                  Joyful care
                </div>
                <div className="kids-pill !border-white/90 !bg-white !text-slate-900">
                  <Palette className="h-4 w-4" />
                  Colourful classrooms
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <Link className="button-primary w-full justify-center gap-2 !rounded-full !px-6 sm:w-auto" to="/programs">
                <Sparkles className="h-4 w-4" />
                Explore programs
              </Link>
              <Link className="button-secondary w-full justify-center gap-2 !rounded-full !border-white/90 !bg-white !px-6 !text-slate-900 hover:!bg-white/90 sm:w-auto" to="/gallery">
                <Images className="h-4 w-4" />
                View gallery
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ImagePreviewModal
        alt={activePreviewItem?.title || 'Gallery image'}
        hasNext={previewIndex !== null && previewIndex < previewItems.length - 1}
        hasPrevious={previewIndex !== null && previewIndex > 0}
        imageUrl={activePreviewItem?.image_url ?? ''}
        onClose={() => setPreviewIndex(null)}
        onNext={() => setPreviewIndex((current) => (current === null ? current : Math.min(current + 1, previewItems.length - 1)))}
        onPrevious={() => setPreviewIndex((current) => (current === null ? current : Math.max(current - 1, 0)))}
        open={previewIndex !== null}
      />
    </div>
  );
}
