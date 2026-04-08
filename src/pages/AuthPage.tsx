import { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, Sparkles } from 'lucide-react';
import { canBootstrapSchoolAdmin } from '../lib/portal';
import { getErrorMessage, supabase } from '../lib/supabase';
import { ToastMessage } from '../lib/toast';

interface AuthPageProps {
  embedded?: boolean;
}

export function AuthPage({ embedded = false }: AuthPageProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [canCreateFirstAdmin, setCanCreateFirstAdmin] = useState(false);
  const [checkingBootstrap, setCheckingBootstrap] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBootstrapState() {
      setCheckingBootstrap(true);

      try {
        const canCreate = await canBootstrapSchoolAdmin();

        if (!active) return;

        setCanCreateFirstAdmin(canCreate);
        setMode(canCreate ? 'signup' : 'signin');
      } catch (error) {
        if (!active) return;
        setCanCreateFirstAdmin(false);
        setMode('signin');
        setMessage(getErrorMessage(error));
      } finally {
        if (active) {
          setCheckingBootstrap(false);
        }
      }
    }

    void loadBootstrapState();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage('Signed in successfully.');
      } else {
        if (!canCreateFirstAdmin) {
          throw new Error('School account creation is no longer available from the public login page.');
        }

        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('First school account created. Continue with the school setup after the session is ready.');
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`flex items-center justify-center px-4 sm:px-6 ${embedded ? 'py-10' : 'min-h-screen py-10'}`}>
      <ToastMessage message={message} />
      <div className="w-full max-w-md">
        <div className="card-panel overflow-hidden p-0">
          <div className="border-b border-slate-100 bg-white px-8 py-8">
            <div className="theme-icon-gradient inline-flex rounded-2xl p-3 shadow-soft">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-brand-600">
              {checkingBootstrap ? 'Checking Access' : mode === 'signin' ? 'Welcome Back' : 'First-Time Setup'}
            </p>
            <h1 className="mt-4 font-serif text-3xl text-slate-900 sm:text-4xl">
              {mode === 'signin' ? 'Sign in to your school portal' : 'Create the first school account'}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {checkingBootstrap
                ? 'Checking whether the first school admin setup is still available.'
                : mode === 'signin'
                ? 'Parents, staff, and admin can all use the same email and password login to continue.'
                : 'No admin workspace exists yet. Create the first school account, then continue into school setup.'}
            </p>
          </div>

          <div className="p-8 sm:p-10">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="form-label" htmlFor="email">
                  Email address
                </label>
                <input className="form-input" id="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
              </div>
              <div>
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <input
                  className="form-input"
                  id="password"
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </div>
              <button className="button-primary w-full gap-2" disabled={loading || checkingBootstrap} type="submit">
                <KeyRound className="h-4 w-4" />
                {loading ? 'Please wait...' : checkingBootstrap ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create first account'}
              </button>
            </form>

            {canCreateFirstAdmin && !checkingBootstrap ? (
              <button
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-slate-900"
                onClick={() => setMode((current) => (current === 'signin' ? 'signup' : 'signin'))}
                type="button"
              >
                {mode === 'signin' ? 'No admin setup yet? Create the first school account' : 'Already created the first account? Sign in'}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
