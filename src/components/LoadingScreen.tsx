import { ThemedLoader } from './ThemedLoader';

interface LoadingScreenProps {
  label?: string;
  description?: string;
  showText?: boolean;
  tone?: 'panel' | 'plain';
}

export function LoadingScreen({
  label = 'Loading workspace...',
  description,
  showText = true,
  tone = 'panel',
}: LoadingScreenProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{
        background:
          'radial-gradient(circle at top left, rgb(var(--school-primary-rgb) / 0.22), transparent 24%), radial-gradient(circle at top right, rgb(var(--school-secondary-rgb) / 0.18), transparent 28%), radial-gradient(circle at bottom left, rgb(var(--school-primary-rgb) / 0.1), transparent 22%), linear-gradient(180deg, rgb(255 250 243 / 0.96), rgb(248 250 252 / 0.98) 55%, rgb(244 251 251 / 1))',
      }}
    >
      <ThemedLoader description={description} label={label} showText={showText} size="lg" tone={tone} />
    </div>
  );
}
