import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile, School } from '../types/app';

export interface AppContextValue {
  session: Session;
  profile: Profile;
  school: School;
  refreshProfile: () => Promise<void>;
  refreshSchool: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext must be used inside the AppContext provider.');
  }

  return context;
}
