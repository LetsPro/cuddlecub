import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Globe, ImagePlus, Mail, MapPin, MonitorPlay, PencilLine, Phone, Plus, Shapes, Sparkles, Trash2, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MediaField } from '../../components/MediaField';
import { MediaPickerModal } from '../../components/MediaPickerModal';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { MAX_WEBSITE_LOGO_SCALE, MIN_WEBSITE_LOGO_SCALE, getWebsiteLogoScale } from '../../lib/public-branding';
import { PublicSiteProvider } from '../../lib/public-site';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { ToastMessage } from '../../lib/toast';
import { getInitials } from '../../lib/utils';
import { PublicSiteScaffold } from '../../layouts/PublicLayout';
import { AboutPage } from '../public/AboutPage';
import { GalleryPage } from '../public/GalleryPage';
import { HomePage } from '../public/HomePage';
import { ProgramsPage } from '../public/ProgramsPage';
import type { MediaAsset, WebsiteGalleryItem, WebsiteHeroSlide, WebsitePageContent, WebsiteProgram } from '../../types/app';

type WebsiteContentSection = 'home' | 'about' | 'programs' | 'gallery';

const defaultPageForm: WebsitePageContent = {
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

const defaultSlideForm = {
  eyebrow: '',
  title: '',
  subtitle: '',
  cta_label: '',
  cta_href: '',
  image_url: '',
  sort_order: 1,
  is_active: true,
};

const defaultProgramForm = {
  title: '',
  age_range: '',
  schedule: '',
  summary: '',
  highlights_text: '',
  image_url: '',
  sort_order: 1,
  is_active: true,
};

const defaultGalleryForm = {
  title: '',
  category: '',
  description: '',
  image_url: '',
  sort_order: 1,
  is_featured: false,
};

function linesToArray(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(value: string[] | null | undefined) {
  return (value ?? []).join('\n');
}

function formatGalleryTitle(asset: MediaAsset) {
  const source = (asset.label || asset.file_name).replace(/\.[^/.]+$/, '');

  return source
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface WebsiteMetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}

function WebsitePreviewContent({ section }: { section: WebsiteContentSection }) {
  if (section === 'about') {
    return <AboutPage />;
  }

  if (section === 'programs') {
    return <ProgramsPage />;
  }

  if (section === 'gallery') {
    return <GalleryPage />;
  }

  return <HomePage />;
}

function WebsiteMetricCard({ icon: Icon, label, value, detail }: WebsiteMetricCardProps) {
  return (
    <div className="card-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className="mt-3 text-2xl font-extrabold text-slate-900">{value}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
        </div>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{ background: 'linear-gradient(135deg, var(--school-primary), rgb(var(--school-secondary-rgb) / 0.94))' }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

interface WebsiteListItemProps {
  title: string;
  subtitle: string;
  imageUrl?: string | null;
  badges?: ReactNode;
  onEdit: () => void;
}

function WebsiteListItem({ title, subtitle, imageUrl, badges, onEdit }: WebsiteListItemProps) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className="h-20 w-20 shrink-0 overflow-hidden rounded-[1.25rem] bg-slate-100"
          style={
            imageUrl
              ? undefined
              : {
                  background:
                    'radial-gradient(circle at top left, rgb(var(--school-primary-rgb) / 0.24), transparent 34%), radial-gradient(circle at bottom right, rgb(var(--school-secondary-rgb) / 0.2), transparent 38%), linear-gradient(160deg, #fff7ed, #ffffff 52%, #f8fafc 100%)',
                }
          }
        >
          {imageUrl ? <img alt={title} className="h-full w-full object-cover" decoding="async" loading="lazy" src={imageUrl} /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1 basis-40">
              <h3 className="truncate text-base font-bold text-slate-900">{title}</h3>
              <p className="mt-1 break-words text-sm leading-6 text-slate-500">{subtitle}</p>
            </div>
            <button className="button-secondary w-full justify-center px-3 py-2 text-xs sm:w-auto" onClick={onEdit} type="button">
              <PencilLine className="mr-1 h-3.5 w-3.5" />
              Edit
            </button>
          </div>
          {badges ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null}
        </div>
      </div>
    </article>
  );
}

export function WebsitePage() {
  const { school, refreshSchool } = useAppContext();
  const initialLogoScale = getWebsiteLogoScale((school.settings ?? {}) as Record<string, unknown>);
  const [pageForm, setPageForm] = useState({
    ...defaultPageForm,
    about_points_text: arrayToLines(defaultPageForm.about_points),
  });
  const [slides, setSlides] = useState<WebsiteHeroSlide[]>([]);
  const [programs, setPrograms] = useState<WebsiteProgram[]>([]);
  const [gallery, setGallery] = useState<WebsiteGalleryItem[]>([]);
  const [slideForm, setSlideForm] = useState(defaultSlideForm);
  const [programForm, setProgramForm] = useState(defaultProgramForm);
  const [galleryForm, setGalleryForm] = useState(defaultGalleryForm);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editingGalleryId, setEditingGalleryId] = useState<string | null>(null);
  const [contentModalSection, setContentModalSection] = useState<WebsiteContentSection | null>(null);
  const [slideModalOpen, setSlideModalOpen] = useState(false);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewSection, setPreviewSection] = useState<WebsiteContentSection>('home');
  const [logoScale, setLogoScale] = useState(initialLogoScale);
  const [savingLogoScale, setSavingLogoScale] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savingPage, setSavingPage] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void loadWebsiteContent();
  }, [school.id]);

  useEffect(() => {
    setLogoScale(getWebsiteLogoScale((school.settings ?? {}) as Record<string, unknown>));
  }, [school.settings]);

  async function ensureWebsitePage() {
    const { error } = await supabase.from('website_pages').upsert(
      {
        school_id: school.id,
        footer_address: school.address,
        footer_phone: school.contact_phone,
        footer_email: school.contact_email,
      },
      { onConflict: 'school_id' },
    );

    if (error) throw error;
  }

  async function loadWebsiteContent() {
    setMessage(null);

    try {
      await ensureWebsitePage();

      const [pageResponse, slideResponse, programResponse, galleryResponse] = await Promise.all([
        supabase.from('website_pages').select('*').eq('school_id', school.id).single(),
        supabase.from('website_hero_slides').select('*').eq('school_id', school.id).order('sort_order').order('created_at'),
        supabase.from('website_programs').select('*').eq('school_id', school.id).order('sort_order').order('created_at'),
        supabase.from('website_gallery_items').select('*').eq('school_id', school.id).order('is_featured', { ascending: false }).order('sort_order').order('created_at'),
      ]);

      if (pageResponse.error) throw pageResponse.error;
      if (slideResponse.error) throw slideResponse.error;
      if (programResponse.error) throw programResponse.error;
      if (galleryResponse.error) throw galleryResponse.error;

      const page = (pageResponse.data ?? defaultPageForm) as WebsitePageContent;
      setPageForm({
        ...defaultPageForm,
        ...page,
        footer_address: page.footer_address ?? school.address,
        footer_phone: page.footer_phone ?? school.contact_phone,
        footer_email: page.footer_email ?? school.contact_email,
        about_points_text: arrayToLines(page.about_points),
      });
      setSlides((slideResponse.data ?? []) as WebsiteHeroSlide[]);
      setPrograms((programResponse.data ?? []) as WebsiteProgram[]);
      setGallery((galleryResponse.data ?? []) as WebsiteGalleryItem[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handlePageSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPage(true);
    setMessage(null);

    try {
      const payload = {
        school_id: school.id,
        home_eyebrow: pageForm.home_eyebrow,
        home_title: pageForm.home_title,
        home_subtitle: pageForm.home_subtitle,
        home_primary_cta_label: pageForm.home_primary_cta_label,
        home_primary_cta_href: pageForm.home_primary_cta_href,
        home_secondary_cta_label: pageForm.home_secondary_cta_label,
        home_secondary_cta_href: pageForm.home_secondary_cta_href,
        about_eyebrow: pageForm.about_eyebrow,
        about_title: pageForm.about_title,
        about_summary: pageForm.about_summary,
        about_story: pageForm.about_story,
        about_points: linesToArray(pageForm.about_points_text),
        programs_eyebrow: pageForm.programs_eyebrow,
        programs_title: pageForm.programs_title,
        programs_intro: pageForm.programs_intro,
        gallery_eyebrow: pageForm.gallery_eyebrow,
        gallery_title: pageForm.gallery_title,
        gallery_intro: pageForm.gallery_intro,
        footer_tagline: pageForm.footer_tagline,
        footer_address: pageForm.footer_address || null,
        footer_phone: pageForm.footer_phone || null,
        footer_email: pageForm.footer_email || null,
      };

      const { error } = await supabase.from('website_pages').upsert(payload, { onConflict: 'school_id' });
      if (error) throw error;

      await loadWebsiteContent();
      closeContentModal();
      setMessage('Website content updated.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingPage(false);
    }
  }

  function openContentModal(section: WebsiteContentSection) {
    setContentModalSection(section);
  }

  function closeContentModal() {
    setContentModalSection(null);
  }

  function openSlideModal(slide?: WebsiteHeroSlide) {
    if (slide) {
      setEditingSlideId(slide.id);
      setSlideForm({
        eyebrow: slide.eyebrow ?? '',
        title: slide.title,
        subtitle: slide.subtitle,
        cta_label: slide.cta_label ?? '',
        cta_href: slide.cta_href ?? '',
        image_url: slide.image_url,
        sort_order: slide.sort_order,
        is_active: slide.is_active,
      });
    } else {
      setEditingSlideId(null);
      setSlideForm({ ...defaultSlideForm, sort_order: slides.length + 1 });
    }
    setSlideModalOpen(true);
  }

  function closeSlideModal() {
    setEditingSlideId(null);
    setSlideForm(defaultSlideForm);
    setSlideModalOpen(false);
  }

  async function handleSlideSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!slideForm.image_url) {
      setMessage('Select a hero image before saving the slide.');
      return;
    }

    try {
      const payload = {
        school_id: school.id,
        eyebrow: slideForm.eyebrow || null,
        title: slideForm.title,
        subtitle: slideForm.subtitle,
        cta_label: slideForm.cta_label || null,
        cta_href: slideForm.cta_href || null,
        image_url: slideForm.image_url,
        sort_order: slideForm.sort_order,
        is_active: slideForm.is_active,
      };

      if (editingSlideId) {
        const { error } = await supabase.from('website_hero_slides').update(payload).eq('id', editingSlideId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('website_hero_slides').insert(payload);
        if (error) throw error;
      }

      await loadWebsiteContent();
      closeSlideModal();
      setMessage(editingSlideId ? 'Hero slide updated.' : 'Hero slide added.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteSlide() {
    if (!editingSlideId) return;
    const confirmed = window.confirm('Delete this hero slide?');
    if (!confirmed) return;

    setBusyDeleteId(editingSlideId);
    setMessage(null);

    try {
      const { error } = await supabase.from('website_hero_slides').delete().eq('id', editingSlideId);
      if (error) throw error;
      await loadWebsiteContent();
      closeSlideModal();
      setMessage('Hero slide deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  function openProgramModal(program?: WebsiteProgram) {
    if (program) {
      setEditingProgramId(program.id);
      setProgramForm({
        title: program.title,
        age_range: program.age_range ?? '',
        schedule: program.schedule ?? '',
        summary: program.summary,
        highlights_text: arrayToLines(program.highlights),
        image_url: program.image_url ?? '',
        sort_order: program.sort_order,
        is_active: program.is_active,
      });
    } else {
      setEditingProgramId(null);
      setProgramForm({ ...defaultProgramForm, sort_order: programs.length + 1 });
    }
    setProgramModalOpen(true);
  }

  function closeProgramModal() {
    setEditingProgramId(null);
    setProgramForm(defaultProgramForm);
    setProgramModalOpen(false);
  }

  async function handleProgramSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const payload = {
        school_id: school.id,
        title: programForm.title,
        age_range: programForm.age_range || null,
        schedule: programForm.schedule || null,
        summary: programForm.summary,
        highlights: linesToArray(programForm.highlights_text),
        image_url: programForm.image_url || null,
        sort_order: programForm.sort_order,
        is_active: programForm.is_active,
      };

      if (editingProgramId) {
        const { error } = await supabase.from('website_programs').update(payload).eq('id', editingProgramId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('website_programs').insert(payload);
        if (error) throw error;
      }

      await loadWebsiteContent();
      closeProgramModal();
      setMessage(editingProgramId ? 'Program updated.' : 'Program added.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteProgram() {
    if (!editingProgramId) return;
    const confirmed = window.confirm('Delete this program?');
    if (!confirmed) return;

    setBusyDeleteId(editingProgramId);
    setMessage(null);

    try {
      const { error } = await supabase.from('website_programs').delete().eq('id', editingProgramId);
      if (error) throw error;
      await loadWebsiteContent();
      closeProgramModal();
      setMessage('Program deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  function openGalleryModal(item?: WebsiteGalleryItem) {
    if (item) {
      setEditingGalleryId(item.id);
      setGalleryForm({
        title: item.title,
        category: item.category ?? '',
        description: item.description ?? '',
        image_url: item.image_url,
        sort_order: item.sort_order,
        is_featured: item.is_featured,
      });
    } else {
      setEditingGalleryId(null);
      setGalleryForm({ ...defaultGalleryForm, sort_order: gallery.length + 1 });
    }
    setGalleryModalOpen(true);
  }

  function closeGalleryModal() {
    setEditingGalleryId(null);
    setGalleryForm(defaultGalleryForm);
    setGalleryModalOpen(false);
  }

  async function handleGallerySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!galleryForm.image_url) {
      setMessage('Select a gallery image before saving the item.');
      return;
    }

    try {
      const payload = {
        school_id: school.id,
        title: galleryForm.title,
        category: galleryForm.category || null,
        description: galleryForm.description || null,
        image_url: galleryForm.image_url,
        sort_order: galleryForm.sort_order,
        is_featured: galleryForm.is_featured,
      };

      if (editingGalleryId) {
        const { error } = await supabase.from('website_gallery_items').update(payload).eq('id', editingGalleryId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('website_gallery_items').insert(payload);
        if (error) throw error;
      }

      await loadWebsiteContent();
      closeGalleryModal();
      setMessage(editingGalleryId ? 'Gallery item updated.' : 'Gallery item added.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteGallery() {
    if (!editingGalleryId) return;
    const confirmed = window.confirm('Delete this gallery item?');
    if (!confirmed) return;

    setBusyDeleteId(editingGalleryId);
    setMessage(null);

    try {
      const { error } = await supabase.from('website_gallery_items').delete().eq('id', editingGalleryId);
      if (error) throw error;
      await loadWebsiteContent();
      closeGalleryModal();
      setMessage('Gallery item deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  async function handleGalleryBulkSelect(selectedAssets: MediaAsset[]) {
    if (!selectedAssets.length) return;

    setMessage(null);

    const existingGalleryUrls = new Set(gallery.map((item) => item.image_url));
    const uniqueAssets = selectedAssets.filter(
      (asset, index, collection) => collection.findIndex((item) => item.public_url === asset.public_url) === index && !existingGalleryUrls.has(asset.public_url),
    );

    if (!uniqueAssets.length) {
      setMessage('Selected images are already in the gallery.');
      return;
    }

    const highestSortOrder = gallery.reduce((maxValue, item) => Math.max(maxValue, item.sort_order), 0);
    const payload = uniqueAssets.map((asset, index) => ({
      school_id: school.id,
      title: formatGalleryTitle(asset) || `Gallery Image ${highestSortOrder + index + 1}`,
      category: null,
      description: null,
      image_url: asset.public_url,
      sort_order: highestSortOrder + index + 1,
      is_featured: false,
    }));

    const { error } = await supabase.from('website_gallery_items').insert(payload);
    if (error) throw error;

    await loadWebsiteContent();
    setGalleryPickerOpen(false);
    setMessage(`${uniqueAssets.length} ${uniqueAssets.length === 1 ? 'gallery image' : 'gallery images'} added.`);
  }

  async function handleLogoScaleSave() {
    setSavingLogoScale(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('schools')
        .update({
          settings: {
            ...(school.settings ?? {}),
            website_logo_scale: logoScale,
          },
        })
        .eq('id', school.id);

      if (error) throw error;

      await refreshSchool();
      setMessage('Website logo size updated.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingLogoScale(false);
    }
  }

  const summary = useMemo(
    () => ({
      slides: slides.filter((item) => item.is_active).length,
      programs: programs.filter((item) => item.is_active).length,
      gallery: gallery.length,
      featured: gallery.filter((item) => item.is_featured).length,
    }),
    [gallery, programs, slides],
  );
  const settings = (school.settings ?? {}) as Record<string, unknown>;
  const brandline = typeof settings.dashboard_brandline === 'string' ? settings.dashboard_brandline : 'Early years learning campus';
  const previewLogoHeight = Math.round(56 * logoScale / 100);
  const previewLogoMaxWidth = Math.round(220 * logoScale / 100);
  const aboutPointsPreview = useMemo(() => linesToArray(pageForm.about_points_text).slice(0, 4), [pageForm.about_points_text]);
  const metrics = useMemo(
    () => [
      {
        label: 'Hero Slides',
        value: String(slides.length),
        detail: `${summary.slides} live on the home page`,
        icon: MonitorPlay,
      },
      {
        label: 'Programs',
        value: String(programs.length),
        detail: `${summary.programs} active program cards`,
        icon: Shapes,
      },
      {
        label: 'Gallery',
        value: String(gallery.length),
        detail: `${summary.featured} featured visual highlights`,
        icon: ImagePlus,
      },
      {
        label: 'Public Site',
        value: 'Ready',
        detail: 'Branding, logo, and landing content are connected',
        icon: Globe,
      },
    ],
    [gallery.length, programs.length, slides.length, summary.featured, summary.programs, summary.slides],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Website"
        title="Landing page content and public site setup"
        description="Manage public website copy, hero slides, programs, and gallery visuals from the same cleaner directory-style editor."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link className="button-secondary" to="/media">
              Open media
            </Link>
            <a className="button-secondary" href="/" rel="noreferrer" target="_blank">
              Open public site
            </a>
          </div>
        }
      />
      <ToastMessage message={message} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <WebsiteMetricCard key={metric.label} detail={metric.detail} icon={metric.icon} label={metric.label} value={metric.value} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Live website preview"
          description="Quickly review how the homepage identity, CTA labels, and footer details are shaping up."
          action={
            <button className="button-secondary gap-2" onClick={() => setPreviewModalOpen(true)} type="button">
              <MonitorPlay className="h-4 w-4" />
              Open preview
            </button>
          }
        >
          <div className="space-y-5">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Website logo size</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Adjust the uploaded logo size for the public navbar and footer.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{logoScale}%</span>
              </div>
              <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
                <input
                  className="h-2 w-full cursor-pointer accent-[var(--school-primary)]"
                  max={MAX_WEBSITE_LOGO_SCALE}
                  min={MIN_WEBSITE_LOGO_SCALE}
                  onChange={(event) => setLogoScale(Number(event.target.value))}
                  type="range"
                  value={logoScale}
                />
                <div className="flex flex-wrap gap-3">
                  <button className="button-primary whitespace-nowrap" disabled={savingLogoScale} onClick={() => void handleLogoScaleSave()} type="button">
                    {savingLogoScale ? 'Saving...' : 'Save logo size'}
                  </button>
                  <button className="button-secondary whitespace-nowrap" onClick={() => setPreviewModalOpen(true)} type="button">
                    Preview website
                  </button>
                </div>
              </div>
            </div>

            <div className="theme-dark-surface overflow-hidden rounded-[2rem] p-6 shadow-soft">
              <div className="flex items-center gap-4">
                {school.logo_url ? (
                  <img
                    alt={school.name}
                    className="w-auto object-contain"
                    decoding="async"
                    loading="lazy"
                    src={school.logo_url}
                    style={{ height: `${previewLogoHeight}px`, maxWidth: `${previewLogoMaxWidth}px` }}
                  />
                ) : (
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] text-xl font-extrabold text-white"
                    style={{ background: 'linear-gradient(135deg, rgb(var(--school-primary-rgb) / 0.34), rgb(var(--school-secondary-rgb) / 0.28))' }}
                  >
                    {getInitials(school.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/70">{brandline}</p>
                  <h2 className="mt-2 truncate font-serif text-3xl">{school.name}</h2>
                  <p className="mt-2 text-sm text-white/72">{pageForm.home_eyebrow}</p>
                </div>
              </div>
              <h3 className="mt-8 max-w-3xl font-serif text-4xl leading-tight">{pageForm.home_title}</h3>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/80">{pageForm.home_subtitle}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900">
                  {pageForm.home_primary_cta_label || 'Primary CTA'}
                </span>
                <span className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                  {pageForm.home_secondary_cta_label || 'Secondary CTA'}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="theme-bg-primary-soft rounded-xl p-2">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Footer address</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{pageForm.footer_address || school.address || 'Not set'}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="theme-bg-secondary-soft rounded-xl p-2">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Footer phone</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{pageForm.footer_phone || school.contact_phone || 'Not set'}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="theme-bg-primary-soft rounded-xl p-2">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Footer email</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{pageForm.footer_email || school.contact_email || 'Not set'}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="theme-bg-secondary-soft rounded-xl p-2">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Footer tagline</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{pageForm.footer_tagline}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Copy guide"
          description="Keep the landing copy clean and short. Hero should lead, About should reassure, Programs should explain, and Gallery should invite exploration."
          action={<span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{summary.slides} slides live</span>}
        >
          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Home CTA links</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">Primary</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{pageForm.home_primary_cta_label} → {pageForm.home_primary_cta_href}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">Secondary</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{pageForm.home_secondary_cta_label} → {pageForm.home_secondary_cta_href}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">About highlights</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {aboutPointsPreview.length ? (
                  aboutPointsPreview.map((point) => (
                    <div key={point} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                      {point}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 sm:col-span-2">No about highlights set yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Section status</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge value={`${summary.programs} active programs`} />
                <StatusBadge value={`${summary.gallery} gallery items`} />
                <StatusBadge value={`${summary.featured} featured visuals`} />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Website pages"
        description="Edit each public page separately so home, about, programs, and gallery content stay easier to manage."
      >
        <div className="grid gap-3 xl:grid-cols-2">
          <WebsiteListItem
            onEdit={() => openContentModal('home')}
            subtitle={`${pageForm.home_eyebrow} · ${pageForm.home_primary_cta_label} / ${pageForm.home_secondary_cta_label}`}
            title="Home page"
            badges={
              <>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{pageForm.home_eyebrow}</span>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{pageForm.home_primary_cta_label}</span>
              </>
            }
          />
          <WebsiteListItem
            onEdit={() => openContentModal('about')}
            subtitle={pageForm.about_summary}
            title="About page"
            badges={
              <>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{pageForm.about_eyebrow}</span>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{aboutPointsPreview.length} highlights</span>
              </>
            }
          />
          <WebsiteListItem
            onEdit={() => openContentModal('programs')}
            subtitle={pageForm.programs_intro}
            title="Programs page"
            badges={
              <>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{pageForm.programs_eyebrow}</span>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{summary.programs} active cards</span>
              </>
            }
          />
          <WebsiteListItem
            onEdit={() => openContentModal('gallery')}
            subtitle={pageForm.footer_tagline}
            title="Gallery page"
            badges={
              <>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{pageForm.gallery_eyebrow}</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{summary.gallery} visuals</span>
              </>
            }
          />
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <SectionCard
          title="Hero slides"
          description="Slides rotate on the homepage hero section. Keep titles short and visual hierarchy strong."
          action={
            <button className="button-primary w-full justify-center gap-2 sm:w-auto" onClick={() => openSlideModal()} type="button">
              <Plus className="h-4 w-4" />
              Add slide
            </button>
          }
        >
          <div className="space-y-3">
            {slides.length ? (
              slides.map((row) => (
                <WebsiteListItem
                  key={row.id}
                  imageUrl={row.image_url}
                  onEdit={() => openSlideModal(row)}
                  subtitle={row.eyebrow ? `${row.eyebrow} · ${row.subtitle}` : row.subtitle}
                  title={row.title}
                  badges={
                    <>
                      <StatusBadge value={row.is_active ? 'active' : 'inactive'} />
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Order {row.sort_order}</span>
                    </>
                  }
                />
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                No hero slides yet.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Programs"
          description="Program cards shown on the Programs page and in homepage previews."
          action={
            <button className="button-primary w-full justify-center gap-2 sm:w-auto" onClick={() => openProgramModal()} type="button">
              <Plus className="h-4 w-4" />
              Add program
            </button>
          }
        >
          <div className="space-y-3">
            {programs.length ? (
              programs.map((row) => (
                <WebsiteListItem
                  key={row.id}
                  imageUrl={row.image_url}
                  onEdit={() => openProgramModal(row)}
                  subtitle={row.summary}
                  title={row.title}
                  badges={
                    <>
                      {row.age_range ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{row.age_range}</span> : null}
                      {row.schedule ? <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{row.schedule}</span> : null}
                      <StatusBadge value={row.is_active ? 'active' : 'inactive'} />
                    </>
                  }
                />
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                No website programs yet.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Gallery"
          description="Gallery visuals and captions shown on the public gallery page."
          action={
            <button className="button-primary w-full justify-center gap-2 sm:w-auto" onClick={() => setGalleryPickerOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              Add image
            </button>
          }
        >
          <div className="space-y-3">
            {gallery.length ? (
              gallery.map((row) => (
                <WebsiteListItem
                  key={row.id}
                  imageUrl={row.image_url}
                  onEdit={() => openGalleryModal(row)}
                  subtitle={row.description || 'No description added yet'}
                  title={row.title}
                  badges={
                    <>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{row.category || 'General'}</span>
                      <StatusBadge value={row.is_featured ? 'featured' : 'standard'} />
                    </>
                  }
                />
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                No gallery images yet.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <Modal description="Manage the home-page slider content and its visual order." onClose={closeSlideModal} open={slideModalOpen} title={editingSlideId ? 'Edit hero slide' : 'Add hero slide'}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSlideSubmit}>
          <div>
            <label className="form-label">Eyebrow</label>
            <input className="form-input" onChange={(event) => setSlideForm((current) => ({ ...current, eyebrow: event.target.value }))} value={slideForm.eyebrow} />
          </div>
          <div>
            <label className="form-label">Sort order</label>
            <input className="form-input" min={1} onChange={(event) => setSlideForm((current) => ({ ...current, sort_order: Number(event.target.value) || 1 }))} type="number" value={slideForm.sort_order} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Title</label>
            <input className="form-input" onChange={(event) => setSlideForm((current) => ({ ...current, title: event.target.value }))} required value={slideForm.title} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Subtitle</label>
            <textarea className="form-input min-h-24" onChange={(event) => setSlideForm((current) => ({ ...current, subtitle: event.target.value }))} required value={slideForm.subtitle} />
          </div>
          <div>
            <label className="form-label">CTA label</label>
            <input className="form-input" onChange={(event) => setSlideForm((current) => ({ ...current, cta_label: event.target.value }))} value={slideForm.cta_label} />
          </div>
          <div>
            <label className="form-label">CTA link</label>
            <input className="form-input" onChange={(event) => setSlideForm((current) => ({ ...current, cta_href: event.target.value }))} value={slideForm.cta_href} />
          </div>
          <div className="md:col-span-2">
            <MediaField
              helperText="Upload or select the hero image from the media library."
              label="Hero image"
              onChange={(value) => setSlideForm((current) => ({ ...current, image_url: value }))}
              value={slideForm.image_url}
            />
          </div>
          <label className="md:col-span-2 flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <input checked={slideForm.is_active} onChange={(event) => setSlideForm((current) => ({ ...current, is_active: event.target.checked }))} type="checkbox" />
            Slide active
          </label>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            {editingSlideId ? (
              <button className="button-danger mr-auto gap-2" disabled={busyDeleteId === editingSlideId} onClick={() => void handleDeleteSlide()} type="button">
                <Trash2 className="h-4 w-4" />
                {busyDeleteId === editingSlideId ? 'Deleting...' : 'Delete slide'}
              </button>
            ) : null}
            <button className="button-secondary" onClick={closeSlideModal} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingSlideId ? 'Save changes' : 'Add slide'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        description="Edit the full public-site copy for home, about, programs, gallery, and footer content from one place."
        onClose={closeContentModal}
        open={Boolean(contentModalSection)}
        size="lg"
        title={
          contentModalSection === 'home'
            ? 'Edit home page'
            : contentModalSection === 'about'
              ? 'Edit about page'
              : contentModalSection === 'programs'
                ? 'Edit programs page'
                : contentModalSection === 'gallery'
                  ? 'Edit gallery page'
                  : 'Edit website copy'
        }
      >
        <form className="space-y-6" onSubmit={handlePageSave}>
          {contentModalSection === 'home' ? (
            <SectionCard title="Home hero copy" description="Edit the main headline, subtext, and button labels shown on the first fold of the homepage.">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Home eyebrow</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, home_eyebrow: event.target.value }))} value={pageForm.home_eyebrow} />
                </div>
                <div>
                  <label className="form-label">Primary CTA label</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, home_primary_cta_label: event.target.value }))} value={pageForm.home_primary_cta_label} />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Home title</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, home_title: event.target.value }))} value={pageForm.home_title} />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Home subtitle</label>
                  <textarea className="form-input min-h-28" onChange={(event) => setPageForm((current) => ({ ...current, home_subtitle: event.target.value }))} value={pageForm.home_subtitle} />
                </div>
                <div>
                  <label className="form-label">Primary CTA link</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, home_primary_cta_href: event.target.value }))} value={pageForm.home_primary_cta_href} />
                </div>
                <div>
                  <label className="form-label">Secondary CTA label</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, home_secondary_cta_label: event.target.value }))} value={pageForm.home_secondary_cta_label} />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Secondary CTA link</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, home_secondary_cta_href: event.target.value }))} value={pageForm.home_secondary_cta_href} />
                </div>
              </div>
            </SectionCard>
          ) : null}

          {contentModalSection === 'about' ? (
            <SectionCard title="About page copy" description="Set the about heading, summary, story, and the short highlight points shown across the public site.">
              <div className="grid gap-4">
                <div>
                  <label className="form-label">About eyebrow</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, about_eyebrow: event.target.value }))} value={pageForm.about_eyebrow} />
                </div>
                <div>
                  <label className="form-label">About title</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, about_title: event.target.value }))} value={pageForm.about_title} />
                </div>
                <div>
                  <label className="form-label">About summary</label>
                  <textarea className="form-input min-h-28" onChange={(event) => setPageForm((current) => ({ ...current, about_summary: event.target.value }))} value={pageForm.about_summary} />
                </div>
                <div>
                  <label className="form-label">About story</label>
                  <textarea className="form-input min-h-32" onChange={(event) => setPageForm((current) => ({ ...current, about_story: event.target.value }))} value={pageForm.about_story} />
                </div>
                <div>
                  <label className="form-label">About points</label>
                  <textarea
                    className="form-input min-h-28"
                    onChange={(event) => setPageForm((current) => ({ ...current, about_points_text: event.target.value }))}
                    placeholder="One point per line"
                    value={pageForm.about_points_text}
                  />
                </div>
              </div>
            </SectionCard>
          ) : null}

          {contentModalSection === 'programs' ? (
            <SectionCard title="Programs section copy" description="These fields introduce the public programs section and the main programs page.">
              <div className="grid gap-4">
                <div>
                  <label className="form-label">Programs eyebrow</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, programs_eyebrow: event.target.value }))} value={pageForm.programs_eyebrow} />
                </div>
                <div>
                  <label className="form-label">Programs title</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, programs_title: event.target.value }))} value={pageForm.programs_title} />
                </div>
                <div>
                  <label className="form-label">Programs intro</label>
                  <textarea className="form-input min-h-32" onChange={(event) => setPageForm((current) => ({ ...current, programs_intro: event.target.value }))} value={pageForm.programs_intro} />
                </div>
              </div>
            </SectionCard>
          ) : null}

          {contentModalSection === 'gallery' ? (
            <SectionCard title="Gallery and footer copy" description="Set the gallery section intro plus the footer tagline and contact details shown across the public site.">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Gallery eyebrow</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, gallery_eyebrow: event.target.value }))} value={pageForm.gallery_eyebrow} />
                </div>
                <div>
                  <label className="form-label">Gallery title</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, gallery_title: event.target.value }))} value={pageForm.gallery_title} />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Gallery intro</label>
                  <textarea className="form-input min-h-24" onChange={(event) => setPageForm((current) => ({ ...current, gallery_intro: event.target.value }))} value={pageForm.gallery_intro} />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Footer tagline</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, footer_tagline: event.target.value }))} value={pageForm.footer_tagline} />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Footer address</label>
                  <textarea className="form-input min-h-24" onChange={(event) => setPageForm((current) => ({ ...current, footer_address: event.target.value }))} value={pageForm.footer_address ?? ''} />
                </div>
                <div>
                  <label className="form-label">Footer phone</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, footer_phone: event.target.value }))} value={pageForm.footer_phone ?? ''} />
                </div>
                <div>
                  <label className="form-label">Footer email</label>
                  <input className="form-input" onChange={(event) => setPageForm((current) => ({ ...current, footer_email: event.target.value }))} value={pageForm.footer_email ?? ''} />
                </div>
              </div>
            </SectionCard>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button className="button-secondary" onClick={closeContentModal} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={savingPage} type="submit">
              {savingPage ? 'Saving website content...' : 'Save website copy'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal description="Preview the saved public website without signing out of the admin dashboard." onClose={() => setPreviewModalOpen(false)} open={previewModalOpen} size="xl" title="Website preview">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'home', label: 'Home' },
                { id: 'about', label: 'About' },
                { id: 'programs', label: 'Programs' },
                { id: 'gallery', label: 'Gallery' },
              ].map((item) => (
                <button
                  key={item.id}
                  className={previewSection === item.id ? 'button-primary' : 'button-secondary'}
                  onClick={() => setPreviewSection(item.id as WebsiteContentSection)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={previewViewport === 'desktop' ? 'button-primary gap-2' : 'button-secondary gap-2'} onClick={() => setPreviewViewport('desktop')} type="button">
                <MonitorPlay className="h-4 w-4" />
                Desktop
              </button>
              <button className={previewViewport === 'mobile' ? 'button-primary gap-2' : 'button-secondary gap-2'} onClick={() => setPreviewViewport('mobile')} type="button">
                <Phone className="h-4 w-4" />
                Mobile
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] bg-slate-100 p-3 sm:p-4">
            <div className={previewViewport === 'mobile' ? 'mx-auto max-w-[390px]' : 'w-full'}>
              <div className="max-h-[72vh] overflow-y-auto rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                <div className="pointer-events-none min-h-full">
                  <PublicSiteProvider disableThemeSync>
                    <PublicSiteScaffold logoScaleOverride={logoScale}>
                      <WebsitePreviewContent section={previewSection} />
                    </PublicSiteScaffold>
                  </PublicSiteProvider>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal description="Manage public program cards shown across the website." onClose={closeProgramModal} open={programModalOpen} title={editingProgramId ? 'Edit program' : 'Add program'}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleProgramSubmit}>
          <div>
            <label className="form-label">Program title</label>
            <input className="form-input" onChange={(event) => setProgramForm((current) => ({ ...current, title: event.target.value }))} required value={programForm.title} />
          </div>
          <div>
            <label className="form-label">Sort order</label>
            <input className="form-input" min={1} onChange={(event) => setProgramForm((current) => ({ ...current, sort_order: Number(event.target.value) || 1 }))} type="number" value={programForm.sort_order} />
          </div>
          <div>
            <label className="form-label">Age range</label>
            <input className="form-input" onChange={(event) => setProgramForm((current) => ({ ...current, age_range: event.target.value }))} value={programForm.age_range} />
          </div>
          <div>
            <label className="form-label">Schedule</label>
            <input className="form-input" onChange={(event) => setProgramForm((current) => ({ ...current, schedule: event.target.value }))} value={programForm.schedule} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Summary</label>
            <textarea className="form-input min-h-24" onChange={(event) => setProgramForm((current) => ({ ...current, summary: event.target.value }))} required value={programForm.summary} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Highlights</label>
            <textarea className="form-input min-h-24" onChange={(event) => setProgramForm((current) => ({ ...current, highlights_text: event.target.value }))} placeholder="One highlight per line" value={programForm.highlights_text} />
          </div>
          <div className="md:col-span-2">
            <MediaField
              helperText="Optional program image from the media library."
              label="Program image"
              onChange={(value) => setProgramForm((current) => ({ ...current, image_url: value }))}
              value={programForm.image_url}
            />
          </div>
          <label className="md:col-span-2 flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <input checked={programForm.is_active} onChange={(event) => setProgramForm((current) => ({ ...current, is_active: event.target.checked }))} type="checkbox" />
            Program active
          </label>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            {editingProgramId ? (
              <button className="button-danger mr-auto gap-2" disabled={busyDeleteId === editingProgramId} onClick={() => void handleDeleteProgram()} type="button">
                <Trash2 className="h-4 w-4" />
                {busyDeleteId === editingProgramId ? 'Deleting...' : 'Delete program'}
              </button>
            ) : null}
            <button className="button-secondary" onClick={closeProgramModal} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingProgramId ? 'Save changes' : 'Add program'}
            </button>
          </div>
        </form>
      </Modal>

      <MediaPickerModal
        allowMultiple
        description="Select existing media or upload multiple images once. Gallery titles are created automatically from the file names."
        onClose={() => setGalleryPickerOpen(false)}
        onSelectMultiple={handleGalleryBulkSelect}
        open={galleryPickerOpen}
        title="Add gallery images"
      />

      <Modal description="Manage the public gallery image that is already on the website." onClose={closeGalleryModal} open={galleryModalOpen} title="Edit gallery item">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleGallerySubmit}>
          <div>
            <label className="form-label">Title</label>
            <input className="form-input" onChange={(event) => setGalleryForm((current) => ({ ...current, title: event.target.value }))} required value={galleryForm.title} />
          </div>
          <div>
            <label className="form-label">Sort order</label>
            <input className="form-input" min={1} onChange={(event) => setGalleryForm((current) => ({ ...current, sort_order: Number(event.target.value) || 1 }))} type="number" value={galleryForm.sort_order} />
          </div>
          <div>
            <label className="form-label">Category</label>
            <input className="form-input" onChange={(event) => setGalleryForm((current) => ({ ...current, category: event.target.value }))} value={galleryForm.category} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Description</label>
            <textarea className="form-input min-h-24" onChange={(event) => setGalleryForm((current) => ({ ...current, description: event.target.value }))} value={galleryForm.description} />
          </div>
          <div className="md:col-span-2">
            <MediaField
              helperText="Upload or select a gallery image from the media library."
              label="Gallery image"
              onChange={(value) => setGalleryForm((current) => ({ ...current, image_url: value }))}
              value={galleryForm.image_url}
            />
          </div>
          <label className="md:col-span-2 flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <input checked={galleryForm.is_featured} onChange={(event) => setGalleryForm((current) => ({ ...current, is_featured: event.target.checked }))} type="checkbox" />
            Mark as featured image
          </label>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            {editingGalleryId ? (
              <button className="button-danger mr-auto gap-2" disabled={busyDeleteId === editingGalleryId} onClick={() => void handleDeleteGallery()} type="button">
                <Trash2 className="h-4 w-4" />
                {busyDeleteId === editingGalleryId ? 'Deleting...' : 'Delete image'}
              </button>
            ) : null}
            <button className="button-secondary" onClick={closeGalleryModal} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingGalleryId ? 'Save changes' : 'Add image'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
