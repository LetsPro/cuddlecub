import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { userId, password } = await request.json();

    if (!userId || typeof userId !== 'string') {
      throw new Error('User id is required.');
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
      throw new Error('Only active school admins can update managed passwords.');
    }

    const { data: parentRecord, error: parentError } = await supabase
      .from('parents')
      .select('id')
      .eq('user_id', userId)
      .eq('school_id', callerProfile.school_id)
      .single();

    const { data: staffRecord, error: staffError } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', userId)
      .eq('school_id', callerProfile.school_id)
      .single();

    if ((!parentRecord && !staffRecord) || (parentError && staffError)) {
      throw new Error('Managed account not found for this school.');
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
    });

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Password update failed.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
