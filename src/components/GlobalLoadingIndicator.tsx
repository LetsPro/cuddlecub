import { useNetworkLoading } from '../lib/network-loading';

export function GlobalLoadingIndicator() {
  const isLoading = useNetworkLoading();

  if (!isLoading) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[110]">
      <div className="h-1 w-full overflow-hidden bg-transparent">
        <div
          className="loading-bar h-full rounded-r-full"
          style={{
            background: 'linear-gradient(90deg, var(--school-primary), var(--school-secondary))',
          }}
        />
      </div>
    </div>
  );
}
