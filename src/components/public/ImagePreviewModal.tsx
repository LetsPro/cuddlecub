import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';

interface ImagePreviewModalProps {
  open: boolean;
  imageUrl: string;
  alt: string;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function ImagePreviewModal({ open, imageUrl, alt, onClose, onPrevious, onNext, hasPrevious = false, hasNext = false }: ImagePreviewModalProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }

      if (event.key === 'ArrowLeft' && hasPrevious) {
        onPrevious?.();
      }

      if (event.key === 'ArrowRight' && hasNext) {
        onNext?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasNext, hasPrevious, onClose, onNext, onPrevious, open]);

  if (!open || !imageUrl) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <button aria-label="Close image preview" className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={onClose} type="button" />
      <div className="relative w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/20 bg-slate-950 shadow-[0_30px_80px_-24px_rgba(15,23,42,0.7)]">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 text-white sm:px-6">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/90">
            <ZoomIn className="h-4 w-4" />
            Image preview
          </div>
          <button className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative flex max-h-[80vh] items-center justify-center bg-slate-950 p-4 sm:p-6">
          {hasPrevious ? (
            <button
              aria-label="Previous image"
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-3 text-white transition hover:bg-white/20 sm:left-6"
              onClick={onPrevious}
              type="button"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}

          <img alt={alt} className="max-h-[72vh] w-auto max-w-full rounded-[1.5rem] object-contain" decoding="async" src={imageUrl} />

          {hasNext ? (
            <button
              aria-label="Next image"
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-3 text-white transition hover:bg-white/20 sm:right-6"
              onClick={onNext}
              type="button"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
