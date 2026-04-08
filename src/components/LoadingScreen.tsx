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
    <div className="flex min-h-screen items-center justify-center px-6">
      <ThemedLoader description={description} label={label} showText={showText} size="lg" tone={tone} />
    </div>
  );
}
