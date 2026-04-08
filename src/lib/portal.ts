import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { ParentRecord, StaffRecord } from '../types/app';

export async function resolveUserRole() {
  const { error } = await supabase.rpc('resolve_user_role');

  // Older databases may not have this migration yet.
  if (error && error.code !== 'PGRST202' && error.code !== '42883') {
    throw error;
  }
}

export async function canBootstrapSchoolAdmin() {
  const { data, error } = await supabase.rpc('can_bootstrap_school_admin');

  if (error && error.code !== 'PGRST202' && error.code !== '42883') {
    throw error;
  }

  return Boolean(data);
}

export async function getCurrentStaffRecord(user: User, schoolId: string) {
  let { data, error } = await supabase.from('staff').select('*').eq('school_id', schoolId).eq('user_id', user.id).maybeSingle();
  if (error) throw error;

  if (!data && user.email) {
    const email = user.email.toLowerCase();
    const emailLookup = await supabase.from('staff').select('*').eq('school_id', schoolId).ilike('email', email).maybeSingle();
    if (emailLookup.error) throw emailLookup.error;
    data = emailLookup.data as StaffRecord | null;

    if (data && !data.user_id) {
      const relink = await supabase.from('staff').update({ user_id: user.id }).eq('id', data.id).select('*').single();
      if (relink.error) throw relink.error;
      data = relink.data as StaffRecord;
    }
  }

  return data as StaffRecord | null;
}

export async function getCurrentParentRecord(user: User, schoolId: string) {
  let { data, error } = await supabase.from('parents').select('*').eq('school_id', schoolId).eq('user_id', user.id).maybeSingle();
  if (error) throw error;

  if (!data && user.email) {
    const email = user.email.toLowerCase();
    const emailLookup = await supabase.from('parents').select('*').eq('school_id', schoolId).ilike('email', email).maybeSingle();
    if (emailLookup.error) throw emailLookup.error;
    data = emailLookup.data as ParentRecord | null;

    if (data && !data.user_id) {
      const relink = await supabase.from('parents').update({ user_id: user.id }).eq('id', data.id).select('*').single();
      if (relink.error) throw relink.error;
      data = relink.data as ParentRecord;
    }
  }

  return data as ParentRecord | null;
}
