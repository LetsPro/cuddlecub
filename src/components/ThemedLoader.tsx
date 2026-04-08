interface ThemedLoaderProps {
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'panel' | 'plain';
  showText?: boolean;
}

const sizeMap = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-16 w-16',
};

export function ThemedLoader({
  label = 'Loading...',
  description,
  size = 'md',
  tone = 'plain',
  showText = true,
}: ThemedLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${showText ? 'gap-4' : ''} ${tone === 'panel' ? 'card-panel p-10 text-center' : 'py-8 text-center'}`}>
      <div className={`relative ${sizeMap[size]}`}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, rgb(var(--school-primary-rgb) / 0.22), transparent 38%), radial-gradient(circle at 70% 70%, rgb(var(--school-secondary-rgb) / 0.2), transparent 42%)',
          }}
        />
        <div
          className="absolute inset-0 animate-spin rounded-full border-4"
          style={{
            borderColor: 'rgb(var(--school-primary-rgb) / 0.12)',
            borderTopColor: 'var(--school-primary)',
            borderRightColor: 'var(--school-secondary)',
          }}
        />
        <div
          className="absolute inset-[0.45rem] rounded-full"
          style={{
            background: 'linear-gradient(135deg, rgb(var(--school-primary-rgb) / 0.14), rgb(var(--school-secondary-rgb) / 0.14))',
          }}
        />
      </div>
      {showText ? (
        <div className="space-y-1">
          <p className="text-sm font-semibold theme-text-primary">{label}</p>
          {description ? <p className="text-xs leading-5 text-slate-500">{description}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
