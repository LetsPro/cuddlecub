import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (options: { message: string; variant?: ToastVariant }) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function inferVariant(message: string): ToastVariant {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('wrong') ||
    normalized.includes('failed') ||
    normalized.includes('error') ||
    normalized.includes('could not') ||
    normalized.includes('missing') ||
    normalized.includes('invalid')
  ) {
    return 'error';
  }

  if (
    normalized.startsWith('add ') ||
    normalized.startsWith('select ') ||
    normalized.startsWith('create ') ||
    normalized.includes('must ') ||
    normalized.includes('already ')
  ) {
    return 'warning';
  }

  if (
    normalized.includes('updated') ||
    normalized.includes('added') ||
    normalized.includes('saved') ||
    normalized.includes('created') ||
    normalized.includes('deleted') ||
    normalized.includes('sent') ||
    normalized.includes('queued') ||
    normalized.includes('activated') ||
    normalized.includes('deactivated') ||
    normalized.includes('recorded') ||
    normalized.includes('logged') ||
    normalized.includes('signed in') ||
    normalized.includes('uploaded')
  ) {
    return 'success';
  }

  return 'info';
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, variant = inferVariant(message) }: { message: string; variant?: ToastVariant }) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, message, variant }]);

      window.setTimeout(() => {
        removeToast(id);
      }, 4200);
    },
    [removeToast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (message) => showToast({ message, variant: 'success' }),
      error: (message) => showToast({ message, variant: 'error' }),
      warning: (message) => showToast({ message, variant: 'warning' }),
      info: (message) => showToast({ message, variant: 'info' }),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(92vw,420px)] flex-col gap-3 sm:right-6 sm:top-6">
        {toasts.map((toast) => {
          const tone =
            toast.variant === 'success'
              ? 'border-emerald-200/80 bg-white text-slate-800'
              : toast.variant === 'error'
                ? 'border-rose-200/80 bg-white text-slate-800'
                : toast.variant === 'warning'
                  ? 'border-amber-200/80 bg-white text-slate-800'
                  : 'border-slate-200/80 bg-white text-slate-800';
          const accent =
            toast.variant === 'success'
              ? 'bg-emerald-500'
              : toast.variant === 'error'
                ? 'bg-rose-500'
                : toast.variant === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-[var(--school-primary)]';

          return (
            <div key={toast.id} className={`pointer-events-auto toast-enter relative overflow-hidden rounded-[1.4rem] border shadow-soft backdrop-blur ${tone}`}>
              <div className={`absolute left-0 top-0 h-full w-1 ${accent}`} />
              <div className="px-5 py-4">
                <p className="text-sm font-semibold leading-6">{toast.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.');
  }

  return context;
}

export function ToastMessage({ message }: { message: string | null | undefined }) {
  const { showToast } = useToast();
  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!message) {
      lastMessageRef.current = null;
      return;
    }

    if (lastMessageRef.current === message) {
      return;
    }

    lastMessageRef.current = message;
    showToast({ message });
  }, [message, showToast]);

  return null;
}
