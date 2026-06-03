import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
};

async function findUserByEmail(supabase: ReturnType<typeof createClient>, email: string) {
  const perPage = 1000;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const user = data.users.find((item) => item.email?.toLowerCase() === email);

    if (user) {
      return user;
    }

    if (data.users.length < perPage) {
      return null;
    }
  }

  return null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');

    if (!supabaseUrl || !serviceRoleKey || !authorization) {
      throw new Error('Missing Supabase admin configuration.');
    }

    const { email, password, profile } = await request.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const requestedProfile = profile && typeof profile === 'object' ? profile : null;
    const profileRole = requestedProfile?.role === 'teacher' || requestedProfile?.role === 'staff' ? requestedProfile.role : 'parent';
    const profileFullName = typeof requestedProfile?.fullName === 'string' ? requestedProfile.fullName : null;
    const profilePhone = typeof requestedProfile?.phone === 'string' ? requestedProfile.phone : null;
    const profileIsActive = typeof requestedProfile?.isActive === 'boolean' ? requestedProfile.isActive : true;

    if (!normalizedEmail) {
      throw new Error('Email is required.');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const token = authorization.replace('Bearer ', '');
    const { data: callerData, error: callerError } = await supabase.auth.getUser(token);

    if (callerError || !callerData.user) {
      throw new Error('Unauthorized.');
    }

    const { data: callerProfile, error: callerProfileError } = await supabase
      .from('profiles')
      .select('school_id, role, is_active')
      .eq('user_id', callerData.user.id)
      .single();

    if (callerProfileError || !callerProfile?.is_active || callerProfile.role !== 'admin' || !callerProfile.school_id) {
      throw new Error('Only active school admins can create managed users.');
    }

    const existingUser = await findUserByEmail(supabase, normalizedEmail);
    let managedUser = existingUser;

    if (existingUser) {
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (existingProfileError) {
        throw existingProfileError;
      }

      if (existingProfile?.school_id && existingProfile.school_id !== callerProfile.school_id) {
        throw new Error('This email is already registered to another school account.');
      }

      const { data: updatedUser, error: updateUserError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          source: 'school_admin_created',
          full_name: profileFullName,
          role: profileRole,
        },
      });

      if (updateUserError) {
        throw updateUserError;
      }

      managedUser = updatedUser.user;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          source: 'school_admin_created',
          full_name: profileFullName,
          role: profileRole,
        },
      });

      if (error) {
        throw error;
      }

      managedUser = data.user;
    }

    if (!managedUser) {
      throw new Error('Supabase did not return the new user account.');
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        user_id: managedUser.id,
        school_id: callerProfile.school_id,
        full_name: profileFullName,
        phone: profilePhone,
        role: profileRole,
        is_active: profileIsActive,
      },
      { onConflict: 'user_id' },
    );

    if (profileError) {
      throw profileError;
    }

    return new Response(JSON.stringify({ user: managedUser }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Account creation failed.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
