import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="card-panel flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="theme-text-primary text-xs font-bold uppercase tracking-[0.3em]">{eyebrow}</p> : null}
        <h1 className="mt-3 font-serif text-3xl text-slate-900 sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
