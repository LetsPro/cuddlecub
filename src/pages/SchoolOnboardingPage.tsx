import { useState } from 'react';
import { Building2, Wand2 } from 'lucide-react';
import { getErrorMessage, supabase } from '../lib/supabase';
import { ToastMessage } from '../lib/toast';

interface SchoolOnboardingPageProps {
  onDone: () => Promise<void>;
}

export function SchoolOnboardingPage({ onDone }: SchoolOnboardingPageProps) {
  const [schoolName, setSchoolName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.rpc('bootstrap_school_admin', {
        p_school_name: schoolName,
        p_full_name: adminName,
        p_phone: phone || null,
      });

      if (error) throw error;
      await onDone();
      setMessage('School workspace created.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <ToastMessage message={message} />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/70 bg-gradient-to-br from-brand-500 via-brand-400 to-teal-500 p-8 text-white shadow-soft sm:p-10">
          <div className="inline-flex rounded-2xl bg-white/20 p-3">
            <Wand2 className="h-7 w-7" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.32em] text-white/80">School Bootstrap</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Create the first school admin workspace.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/85">
            This creates the school profile, links the current user as `admin`, and unlocks the rest of the dashboard.
          </p>
        </div>

        <div className="card-panel p-8 sm:p-10">
          <div className="inline-flex rounded-2xl bg-brand-100 p-3 text-brand-700">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="mt-5 font-serif text-3xl text-slate-900">Tell the app about the school</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            You can edit school details, branding, calendar and fee structures later inside the admin dashboard.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="form-label" htmlFor="school_name">
                School name
              </label>
              <input className="form-input" id="school_name" onChange={(event) => setSchoolName(event.target.value)} value={schoolName} />
            </div>
            <div>
              <label className="form-label" htmlFor="admin_name">
                Admin full name
              </label>
              <input className="form-input" id="admin_name" onChange={(event) => setAdminName(event.target.value)} value={adminName} />
            </div>
            <div>
              <label className="form-label" htmlFor="phone">
                Phone number
              </label>
              <input className="form-input" id="phone" onChange={(event) => setPhone(event.target.value)} value={phone} />
            </div>
            <button className="button-primary w-full" disabled={loading} type="submit">
              {loading ? 'Setting up...' : 'Create school workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
