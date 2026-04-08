import { createClient } from '@supabase/supabase-js';
import { beginNetworkRequest, endNetworkRequest } from './network-loading';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn('Supabase credentials are missing. Add them to .env.local.');
}

async function trackedFetch(input: RequestInfo | URL, init?: RequestInit) {
  beginNetworkRequest();

  try {
    return await fetch(input, init);
  } finally {
    endNetworkRequest();
  }
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  global: {
    fetch: trackedFetch,
  },
});

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const maybeError = error as {
      message?: string;
      error_description?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return (
      maybeError.message ||
      maybeError.error_description ||
      maybeError.details ||
      maybeError.hint ||
      maybeError.code ||
      'Something went wrong. Please try again.'
    );
  }

  return 'Something went wrong. Please try again.';
}
