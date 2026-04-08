import type { AppRole } from '../types/app';

interface AccessPendingPageProps {
  role?: AppRole | null;
  mode?: 'pending' | 'inactive';
}

export function AccessPendingPage({ role, mode = 'pending' }: AccessPendingPageProps) {
  const roleLabel =
    role === 'teacher' || role === 'staff'
      ? 'staff'
      : role === 'parent'
        ? 'parent'
        : 'user';

  const title = mode === 'inactive' ? 'This account is currently deactivated.' : 'This account is not linked to a school workspace yet.';
  const description =
    mode === 'inactive'
      ? `Ask the school admin to reactivate your ${roleLabel} access. After that, sign out and sign in again to refresh the workspace permissions.`
      : `Ask the school admin to create or update your ${roleLabel} record with the same email address you used to sign in. After that, sign out and sign in again to sync the account.`;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="card-panel max-w-2xl p-10 text-center">
        <p className="theme-text-primary text-xs font-bold uppercase tracking-[0.28em]">{mode === 'inactive' ? 'Access Disabled' : 'Access Pending'}</p>
        <h1 className="mt-4 font-serif text-4xl text-slate-900">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
