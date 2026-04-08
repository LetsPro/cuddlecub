import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'md' | 'lg' | 'xl';
  children: ReactNode;
}

export function Modal({ open, onClose, title, description, size = 'md', children }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeydown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        aria-label="Close modal"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div
        aria-modal="true"
        className={`relative w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_80px_-24px_rgba(15,23,42,0.45)] ${
          size === 'xl' ? 'max-w-7xl' : size === 'lg' ? 'max-w-4xl' : 'max-w-2xl'
        }`}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
          <div>
            <h2 className="font-serif text-3xl text-slate-900">{title}</h2>
            {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
          </div>
          <button className="button-secondary !rounded-full !p-2" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-7rem)] overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">{children}</div>
      </div>
    </div>
  );
}
