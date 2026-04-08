import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { getErrorMessage, supabase } from '../lib/supabase';
import { ToastMessage } from '../lib/toast';

interface UpdatePasswordPageProps {
  onDone: () => void;
}

export function UpdatePasswordPage({ onDone }: UpdatePasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <ToastMessage message={message} />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="theme-dark-surface rounded-[2rem] border border-white/20 p-8 shadow-soft sm:p-10">
          <div className="inline-flex rounded-2xl bg-white/12 p-3 text-white">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.32em] text-white/72">Password Recovery</p>
          <h1 className="mt-4 max-w-xl font-serif text-4xl leading-tight sm:text-5xl">Set a new password for this school account.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300">
            This screen appears after a reset email link is opened. Choose a new password, then continue into the assigned school workspace.
          </p>
        </div>

        <div className="card-panel p-8 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600">Update Password</p>
          <h2 className="mt-4 font-serif text-3xl text-slate-900">Create a new login password</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Use a password that the teacher or parent can remember securely and change later if needed.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="form-label" htmlFor="new_password">
                New password
              </label>
              <input className="form-input" id="new_password" minLength={6} onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
            </div>
            <div>
              <label className="form-label" htmlFor="confirm_password">
                Confirm password
              </label>
              <input
                className="form-input"
                id="confirm_password"
                minLength={6}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                value={confirmPassword}
              />
            </div>
            <button className="button-primary w-full gap-2" disabled={loading} type="submit">
              <KeyRound className="h-4 w-4" />
              {loading ? 'Updating password...' : 'Save new password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
