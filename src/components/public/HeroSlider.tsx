import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Heart, Palette, Sparkles, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WebsiteHeroSlide } from '../../types/app';

interface HeroSliderProps {
  slides: WebsiteHeroSlide[];
}

const highlightChips = [
  { label: 'Playful learning', icon: Sparkles },
  { label: 'Caring teachers', icon: Heart },
  { label: 'Creative spaces', icon: Palette },
];

const fallbackSlideColors = ['#e56ea6', '#3f97d1', '#d98a18'];

function warmImage(url: string, warmedUrls: Set<string>) {
  if (!url || warmedUrls.has(url) || typeof window === 'undefined') {
    return;
  }

  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  warmedUrls.add(url);
}

export function HeroSlider({ slides }: HeroSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const warmedUrlsRef = useRef<Set<string>>(new Set());
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (slides.length <= 1) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 5200);

    return () => {
      window.clearInterval(interval);
    };
  }, [slides.length]);

  useEffect(() => {
    if (!slides.length) return;

    const preloadIndexes = new Set([(activeIndex + 1) % slides.length, (activeIndex + 2) % slides.length]);

    preloadIndexes.forEach((index) => {
      const imageUrl = slides[index]?.image_url;
      if (imageUrl && !failedUrls.has(imageUrl)) {
        warmImage(imageUrl, warmedUrlsRef.current);
      }
    });
  }, [activeIndex, failedUrls, slides]);

  return (
    <div className="theme-dark-surface relative min-h-[460px] overflow-hidden rounded-[2.5rem] border border-white/20 shadow-[0_30px_80px_-24px_rgba(15,23,42,0.5)] sm:min-h-[540px] lg:min-h-[620px]">
      <div aria-hidden className="absolute left-5 top-5 h-16 w-16 rounded-full bg-white/14 sm:left-8 sm:top-8 sm:h-20 sm:w-20" />
      <div aria-hidden className="absolute bottom-16 right-8 h-20 w-20 rounded-[1.5rem] bg-white/12 sm:right-10 sm:h-28 sm:w-28 sm:rounded-[2rem]" />
      <div className="pointer-events-none absolute right-6 top-6 hidden gap-3 lg:flex lg:flex-col">
        {highlightChips.map((chip) => (
          <div key={chip.label} className="kids-hero-chip text-sm font-bold text-slate-900">
            <chip.icon className="h-4 w-4" />
            {chip.label}
          </div>
        ))}
      </div>
      {slides.map((slide, index) => {
        const isActive = index === activeIndex;
        const canRenderImage = Boolean(slide.image_url) && !failedUrls.has(slide.image_url);

        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-700 ${isActive ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            {canRenderImage ? (
              <div className="absolute inset-0">
                <img
                  alt={slide.title}
                  className="h-full w-full object-cover"
                  decoding="async"
                  loading={isActive || index === (activeIndex + 1) % slides.length ? 'eager' : 'lazy'}
                  onError={() =>
                    setFailedUrls((current) => {
                      const nextUrls = new Set(current);
                      nextUrls.add(slide.image_url);
                      return nextUrls;
                    })
                  }
                  src={slide.image_url}
                />
                <div className="absolute inset-0 bg-slate-950/42" />
              </div>
            ) : (
              <div
                className="absolute inset-0"
                style={{ backgroundColor: fallbackSlideColors[index % fallbackSlideColors.length] }}
              >
                <div className="absolute left-6 top-6 h-20 w-20 rounded-full bg-white/14 sm:left-10 sm:top-10 sm:h-24 sm:w-24" />
                <div className="absolute bottom-14 left-1/3 h-12 w-12 rounded-[1rem] bg-white/12 sm:bottom-16 sm:h-16 sm:w-16 sm:rounded-[1.25rem]" />
                <div className="absolute right-8 top-12 h-20 w-20 rounded-full bg-white/10 sm:right-12 sm:top-16 sm:h-28 sm:w-28" />
              </div>
            )}
            <div className="relative flex min-h-[460px] items-end p-6 sm:min-h-[540px] sm:p-12 lg:min-h-[620px] lg:p-16">
              <div className="max-w-3xl text-white">
                <div className="kids-badge !border-white/90 !bg-white !text-slate-900">
                  <Star className="h-4 w-4" />
                  {slide.eyebrow || 'Welcome'}
                </div>
                <h1 className="mt-5 font-serif text-3xl leading-tight sm:text-5xl lg:text-6xl">{slide.title}</h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/90 sm:text-lg">{slide.subtitle}</p>
                <div className="mt-5 hidden flex-wrap gap-3 sm:flex">
                  {highlightChips.map((chip) => (
                    <div key={chip.label} className="kids-pill !border-white/90 !bg-white !text-slate-900">
                      <chip.icon className="h-4 w-4" />
                      {chip.label}
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link className="button-primary w-full justify-center gap-2 !rounded-full !px-6 sm:w-auto" to={slide.cta_href || '/programs'}>
                    {slide.cta_label || 'Explore'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link className="button-secondary w-full justify-center !rounded-full !border-white/90 !bg-white !px-6 !text-slate-900 hover:!bg-white/90 sm:w-auto" to="/login">
                    Login
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="absolute inset-x-0 bottom-0 hidden items-end justify-between px-12 pb-6 sm:flex lg:px-16">
        <div className="flex gap-2 rounded-full bg-white/16 px-3 py-2 backdrop-blur">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              aria-label={`Go to slide ${index + 1}`}
              className={`h-2.5 rounded-full transition-all ${index === activeIndex ? 'w-10 bg-white' : 'w-2.5 bg-white/40'}`}
              onClick={() => setActiveIndex(index)}
              type="button"
            />
          ))}
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
          {String(activeIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </p>
      </div>
    </div>
  );
}
