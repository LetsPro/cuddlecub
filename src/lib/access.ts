import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AppRole } from '../types/app';

export type PortalAccessStatus = 'not_created' | 'invited' | 'active' | 'disabled';

interface PortalAccessRecord {
  is_active: boolean;
  user_id?: string | null;
  access_status?: string | null;
  access_invited_at?: string | null;
  password_reset_sent_at?: string | null;
  last_login_at?: string | null;
}

interface ManagedProfileParams {
  userId: string;
  schoolId: string;
  fullName: string | null;
  phone: string | null;
  role: Exclude<AppRole, 'admin'>;
  isActive: boolean;
}

type ManagedProfileInput = Omit<ManagedProfileParams, 'userId'>;

interface ManagedWelcomeEmailInput {
  sendWelcomeEmail?: boolean;
  loginUrl?: string;
  schoolName?: string | null;
}

interface ManagedAccountResult {
  user: User;
  welcomeEmail?: {
    sent: boolean;
    reason?: string;
  };
}

export function deriveEnabledPortalAccessStatus(record: Omit<PortalAccessRecord, 'is_active'>): Exclude<PortalAccessStatus, 'disabled'> {
  if (record.access_status === 'active' || record.last_login_at) {
    return 'active';
  }

  if (record.access_status === 'invited' || record.access_invited_at || record.password_reset_sent_at || record.user_id) {
    return 'invited';
  }

  return 'not_created';
}

export function derivePortalAccessStatus(record: PortalAccessRecord): PortalAccessStatus {
  if (!record.is_active) {
    return 'disabled';
  }

  return deriveEnabledPortalAccessStatus(record);
}

export function generateTemporaryPassword(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

export async function createManagedUserAccount(
  email: string,
  password: string,
  profile?: ManagedProfileInput,
  welcomeEmail?: ManagedWelcomeEmailInput,
): Promise<ManagedAccountResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error('Email is required to create login credentials.');
  }

  const { data: managedData, error: managedError } = await supabase.functions.invoke<ManagedAccountResult>('create-managed-user-account', {
    body: {
      email: normalizedEmail,
      password,
      profile,
      welcomeEmail,
    },
  });

  if (!managedError && managedData?.user) {
    return managedData;
  }

  throw new Error(managedError?.message ?? 'Managed account function is not available. Deploy the Supabase function before creating portal credentials.');
}

export async function sendManagedPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error('Email is required to send a reset link.');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${window.location.origin}/update-password`,
  });

  if (error) {
    throw error;
  }
}

export async function updateManagedUserPassword(userId: string, password: string) {
  if (!userId) {
    throw new Error('User account is required to update a password.');
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const { error } = await supabase.functions.invoke('update-managed-user-password', {
    body: {
      userId,
      password,
    },
  });

  if (error) {
    throw error;
  }
}

export async function syncManagedProfile({ userId, schoolId, fullName, phone, role, isActive }: ManagedProfileParams) {
  const { error } = await supabase
    .from('profiles')
    .update({
      school_id: schoolId,
      full_name: fullName,
      phone,
      role,
      is_active: isActive,
    })
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

export async function deactivateManagedProfile(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({
      is_active: false,
    })
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}
