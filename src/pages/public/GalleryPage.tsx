import { Camera, Heart, Images, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePreviewModal } from '../../components/public/ImagePreviewModal';
import { usePublicSite } from '../../lib/public-site';

const featuredCardColors = ['#fde68a', '#bfdbfe'];
const galleryCardColors = ['#fde68a', '#bfdbfe', '#fecdd3'];

export function GalleryPage() {
  const { page, gallery } = usePublicSite();
  const featuredItems = gallery.filter((item) => item.is_featured);
  const regularItems = gallery.filter((item) => !item.is_featured);
  const previewItems = (regularItems.length ? regularItems : gallery).filter((item) => Boolean(item.image_url));
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  function openPreviewByUrl(imageUrl: string) {
    const nextIndex = previewItems.findIndex((item) => item.image_url === imageUrl);
    if (nextIndex >= 0) {
      setPreviewIndex(nextIndex);
    }
  }

  const activePreviewItem = previewIndex !== null ? previewItems[previewIndex] : null;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1300px] space-y-8">
        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="card-panel p-8 sm:p-10">
            <div className="kids-badge">
              <Images className="h-4 w-4" />
              {page.gallery_eyebrow}
            </div>
            <h1 className="mt-4 font-serif text-4xl text-slate-900 sm:text-5xl">{page.gallery_title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">{page.gallery_intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <div className="kids-pill bg-brand-50 text-brand-700">
                <Images className="h-4 w-4" />
                Daily school moments
              </div>
              <div className="kids-pill">
                <Camera className="h-4 w-4" />
                Events, learning, celebrations
              </div>
              <div className="kids-pill">
                <Heart className="h-4 w-4 text-brand-600" />
                Happy memories
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {(featuredItems.length ? featuredItems : gallery.slice(0, 2)).map((item, index) => (
              <article
                key={item.id}
                className={`kids-media-card overflow-hidden rounded-[2.25rem] bg-white ${index === 0 ? 'sm:col-span-2' : ''} ${
                  index === 0 ? 'kids-gallery-tilt-left' : 'kids-gallery-tilt-right'
                }`}
              >
                <div
                  className={`kids-media-frame ${index === 0 ? 'h-72 sm:h-80' : 'h-64'}`}
                  style={{
                    backgroundColor: item.image_url ? undefined : featuredCardColors[index % featuredCardColors.length],
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
            ))}
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {(regularItems.length ? regularItems : gallery).map((item, index) => (
            <article key={item.id} className="kids-media-card overflow-hidden rounded-[2.25rem] bg-white">
              <div
                className="kids-media-frame h-64"
                style={{
                  backgroundColor: item.image_url ? undefined : galleryCardColors[index % galleryCardColors.length],
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
          ))}
        </section>

        <section className="pb-6">
          <div className="theme-dark-surface overflow-hidden rounded-[2.5rem] px-8 py-10 shadow-[0_28px_80px_-28px_rgba(15,23,42,0.55)] sm:px-12">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="kids-badge !border-white/90 !bg-white !text-slate-900">
                  <Heart className="h-4 w-4" />
                  School life
                </div>
                <h2 className="mt-4 font-serif text-3xl sm:text-4xl">View more school updates after login.</h2>
                <p className="mt-4 text-base leading-7 text-white/92">
                  Parents and staff can access notices, attendance, daily updates, and shared school moments inside the portal.
                </p>
              </div>
              <Link className="button-primary gap-2 !rounded-full !px-6" to="/login">
                <Sparkles className="h-4 w-4" />
                Login to portal
              </Link>
            </div>
          </div>
        </section>
      </div>

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
