import { ThemedLoader } from './ThemedLoader';

interface LoadingScreenProps {
  label?: string;
  description?: string;
}

export function LoadingScreen({ label = 'Loading workspace...', description }: LoadingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <ThemedLoader description={description} label={label} size="lg" tone="panel" />
    </div>
  );
}
