import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="card-panel p-10 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-600">404</p>
      <h1 className="mt-4 font-serif text-4xl text-slate-900">Page not found</h1>
      <p className="mt-3 text-sm text-slate-500">The page you requested does not exist in this admin workspace.</p>
      <Link className="button-primary mt-6" to="/">
        Go to dashboard
      </Link>
    </div>
  );
}
