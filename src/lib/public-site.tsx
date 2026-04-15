import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolveMediaUrl } from './media';
import { getErrorMessage, supabase } from './supabase';
import { applyThemeFromSchool, resetSchoolTheme } from './theme';
import type { PublicWebsiteData, School, WebsiteGalleryItem, WebsiteHeroSlide, WebsitePageContent, WebsiteProgram } from '../types/app';

const defaultPageContent: WebsitePageContent = {
  home_eyebrow: 'Early Years Excellence',
  home_title: 'A joyful foundation for confident little learners.',
  home_subtitle: 'A nurturing preschool experience with caring teachers, safe routines, and playful learning every day.',
  home_primary_cta_label: 'Explore programs',
  home_primary_cta_href: '/programs',
  home_secondary_cta_label: 'About the school',
  home_secondary_cta_href: '/about',
  about_eyebrow: 'About Us',
  about_title: 'A warm learning space built for early childhood.',
  about_summary: 'We create a secure, joyful environment where every child learns through play, routine, creativity, and caring guidance.',
  about_story:
    'Our approach blends foundational academics, social-emotional development, creative exploration, and strong parent communication so children feel safe, happy, and ready to grow.',
  about_mission:
    'To nurture every child with gentle care, joyful learning, and strong foundational skills in a safe early-years environment.',
  about_vision:
    'To help children grow into confident, compassionate, and globally ready learners who step into the future with curiosity and character.',
  about_points: [
    'Play-based learning with structured routines',
    'Safe, caring classrooms and child-first attention',
    'Regular parent communication and progress updates',
    'Creative, physical, and social development every day',
  ],
  programs_eyebrow: 'Programs',
  programs_title: 'Age-appropriate programs for every early stage.',
  programs_intro:
    'Each program is designed to match the child\'s developmental stage with the right balance of discovery, rhythm, and learning support.',
  gallery_eyebrow: 'Gallery',
  gallery_title: 'Moments that show learning, joy, and care.',
  gallery_intro: 'A look into daily activities, celebrations, classroom engagement, and school events.',
  footer_tagline: 'A caring preschool experience with strong academics, daily routines, and parent connection.',
  footer_address: null,
  footer_phone: null,
  footer_email: null,
};

const fallbackSlides: WebsiteHeroSlide[] = [
  {
    id: 'fallback-slide-1',
    eyebrow: 'Playful Learning',
    title: 'A joyful foundation for confident little learners.',
    subtitle: 'A nurturing preschool experience with caring teachers, safe routines, and playful learning every day.',
    cta_label: 'Explore programs',
    cta_href: '/programs',
    image_url: '',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'fallback-slide-2',
    eyebrow: 'Parent Partnership',
    title: 'Strong school communication from the very first day.',
    subtitle: 'Daily routines, classroom updates, celebrations, and child progress stay visible for families and school teams.',
    cta_label: 'About the school',
    cta_href: '/about',
    image_url: '',
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'fallback-slide-3',
    eyebrow: 'Safe & Caring',
    title: 'A warm preschool environment built around children.',
    subtitle: 'Care, structure, outdoor play, creativity, and confidence-building experiences come together across every school day.',
    cta_label: 'View gallery',
    cta_href: '/gallery',
    image_url: '',
    sort_order: 3,
    is_active: true,
  },
];

const fallbackPrograms: WebsiteProgram[] = [
  {
    id: 'fallback-program-1',
    title: 'Playgroup',
    age_range: '1.5 - 2.5 years',
    schedule: 'Morning engagement',
    summary: 'A gentle first school experience focused on comfort, routine, movement, music, and joyful exploration.',
    highlights: ['Safe transition to school', 'Sensory and motor play', 'Warm teacher attention'],
    image_url: null,
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'fallback-program-2',
    title: 'Nursery',
    age_range: '2.5 - 3.5 years',
    schedule: 'Half day',
    summary: 'Language building, early number readiness, storytelling, rhythm, art, and social confidence in structured routines.',
    highlights: ['Early literacy exposure', 'Creative classroom activities', 'Social-emotional growth'],
    image_url: null,
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'fallback-program-3',
    title: 'Kindergarten',
    age_range: '3.5 - 5.5 years',
    schedule: 'Half / full day',
    summary: 'Foundational academics, communication, independence, and classroom readiness for the next learning stage.',
    highlights: ['School readiness focus', 'Concept learning through play', 'Parent communication support'],
    image_url: null,
    sort_order: 3,
    is_active: true,
  },
];

const fallbackGallery: WebsiteGalleryItem[] = [
  { id: 'fallback-gallery-1', title: 'Classroom learning', category: 'Learning', description: 'Interactive classroom moments and guided activities.', image_url: '', sort_order: 1, is_featured: true },
  { id: 'fallback-gallery-2', title: 'Creative exploration', category: 'Creativity', description: 'Art, music, storytelling, and hands-on discovery.', image_url: '', sort_order: 2, is_featured: false },
  { id: 'fallback-gallery-3', title: 'Celebrations & events', category: 'Events', description: 'Festivals, school functions, and memorable child experiences.', image_url: '', sort_order: 3, is_featured: false },
];

interface PublicSiteContextValue {
  site: PublicWebsiteData | null;
  loading: boolean;
  error: string | null;
  page: WebsitePageContent;
  school: School | null;
  slides: WebsiteHeroSlide[];
  programs: WebsiteProgram[];
  gallery: WebsiteGalleryItem[];
}

const PublicSiteContext = createContext<PublicSiteContextValue | null>(null);

function normalizeSchoolMedia(school: School | null | undefined) {
  if (!school) {
    return null;
  }

  return {
    ...school,
    logo_url: resolveMediaUrl(school.logo_url),
  };
}

function normalizeSlides(slides: WebsiteHeroSlide[]) {
  return slides.map((slide) => ({
    ...slide,
    image_url: resolveMediaUrl(slide.image_url),
  }));
}

function normalizePrograms(programs: WebsiteProgram[]) {
  return programs.map((program) => ({
    ...program,
    image_url: resolveMediaUrl(program.image_url),
  }));
}

function normalizeGallery(gallery: WebsiteGalleryItem[]) {
  return gallery.map((item) => ({
    ...item,
    image_url: resolveMediaUrl(item.image_url),
  }));
}

export async function fetchPublicWebsite() {
  const { data, error } = await supabase.rpc('get_public_school_website');
  if (error) throw error;

  return (data ?? null) as PublicWebsiteData | null;
}

export function PublicSiteProvider({ children, disableThemeSync = false }: { children: ReactNode; disableThemeSync?: boolean }) {
  const [site, setSite] = useState<PublicWebsiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const schoolSettings = (site?.school?.settings ?? {}) as Record<string, unknown>;
  const themePrimary = typeof schoolSettings.theme_primary_color === 'string' ? schoolSettings.theme_primary_color : site?.school?.primary_color;
  const themeSecondary = typeof schoolSettings.theme_secondary_color === 'string' ? schoolSettings.theme_secondary_color : site?.school?.secondary_color;

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const nextSite = await fetchPublicWebsite();
        if (active) {
          setSite(nextSite);
        }
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (disableThemeSync) {
      return undefined;
    }

    applyThemeFromSchool({
      primary_color: themePrimary,
      secondary_color: themeSecondary,
      settings: site?.school?.settings,
    });

    return () => {
      resetSchoolTheme();
    };
  }, [disableThemeSync, site?.school?.settings, themePrimary, themeSecondary]);

  const value = useMemo<PublicSiteContextValue>(
    () => ({
      site,
      loading,
      error,
      page: {
        ...defaultPageContent,
        ...site?.page,
        about_points: Array.isArray(site?.page?.about_points) ? site.page.about_points : defaultPageContent.about_points,
      },
      school: normalizeSchoolMedia(site?.school ?? null),
      slides: normalizeSlides(site?.slides?.length ? site.slides : fallbackSlides),
      programs: normalizePrograms(site?.programs?.length ? site.programs : fallbackPrograms),
      gallery: normalizeGallery(site?.gallery?.length ? site.gallery : fallbackGallery),
    }),
    [error, loading, site],
  );

  return <PublicSiteContext.Provider value={value}>{children}</PublicSiteContext.Provider>;
}

export function usePublicSite() {
  const context = useContext(PublicSiteContext);

  if (!context) {
    throw new Error('usePublicSite must be used inside PublicSiteProvider.');
  }

  return context;
}
