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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function sendWelcomeEmail({
  email,
  password,
  fullName,
  schoolName,
  loginUrl,
  role,
}: {
  email: string;
  password: string;
  fullName: string | null;
  schoolName: string | null;
  loginUrl: string | null;
  role: string;
}) {
  const emailjsServiceId = Deno.env.get('EMAILJS_SERVICE_ID');
  const emailjsTemplateId = Deno.env.get('EMAILJS_TEMPLATE_ID');
  const emailjsPublicKey = Deno.env.get('EMAILJS_PUBLIC_KEY');
  const emailjsPrivateKey = Deno.env.get('EMAILJS_PRIVATE_KEY');
  const senderEmail = Deno.env.get('EMAIL_FROM') ?? 'cuddlecubpreschool@gmail.com';
  const senderName = Deno.env.get('EMAIL_FROM_NAME') ?? 'Cuddle Cub Preschool';
  const appLoginUrl = Deno.env.get('APP_LOGIN_URL') ?? loginUrl ?? '';

  if (!emailjsServiceId || !emailjsTemplateId || !emailjsPublicKey) {
    return {
      sent: false,
      reason: 'EmailJS delivery is not configured. Set EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID and EMAILJS_PUBLIC_KEY.',
    };
  }

  if (!appLoginUrl) {
    return {
      sent: false,
      reason: 'Login URL is not configured for welcome email delivery.',
    };
  }

  try {
    const greetingName = fullName?.trim() || 'Parent';
    const displaySchoolName = schoolName?.trim() || 'Cuddle Cub Preschool';
    const portalLabel = role === 'teacher' || role === 'staff' ? 'teacher portal' : 'parent portal';
    const accountLabel = role === 'teacher' || role === 'staff' ? 'teacher' : 'parent';
    const subject = `Welcome to ${displaySchoolName} ${portalLabel}`;
    const text = [
      `Dear ${greetingName},`,
      '',
      `Welcome to ${displaySchoolName}. Your ${accountLabel} portal account has been created.`,
      '',
      `Login link: ${appLoginUrl}`,
      `Email: ${email}`,
      `Temporary password: ${password}`,
      '',
      'Please sign in and keep these credentials secure.',
      '',
      'Regards,',
      displaySchoolName,
    ].join('\n');
    const html = `
      <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
        <p>Dear ${escapeHtml(greetingName)},</p>
        <p>Welcome to ${escapeHtml(displaySchoolName)}. Your ${escapeHtml(accountLabel)} portal account has been created.</p>
        <p>
          <strong>Login link:</strong> <a href="${escapeHtml(appLoginUrl)}">${escapeHtml(appLoginUrl)}</a><br>
          <strong>Email:</strong> ${escapeHtml(email)}<br>
          <strong>Temporary password:</strong> ${escapeHtml(password)}
        </p>
        <p>Please sign in and keep these credentials secure.</p>
        <p>Regards,<br>${escapeHtml(displaySchoolName)}</p>
      </div>
    `;

    const sendResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: emailjsServiceId,
        template_id: emailjsTemplateId,
        user_id: emailjsPublicKey,
        accessToken: emailjsPrivateKey || undefined,
        template_params: {
          to_email: email,
          to_name: greetingName,
          parent_name: greetingName,
          school_name: displaySchoolName,
          login_url: appLoginUrl,
          login_email: email,
          temporary_password: password,
          portal_label: portalLabel,
          account_label: accountLabel,
          from_name: senderName,
          from_email: senderEmail,
          subject,
          message: text,
          html_message: html,
        },
      }),
    });

    if (!sendResponse.ok) {
      const responseText = await sendResponse.text();
      throw new Error(`EmailJS send request failed with status ${sendResponse.status}${responseText ? `: ${responseText}` : '.'}`);
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : 'Welcome email delivery failed.',
    };
  }
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

    const { email, password, profile, welcomeEmail } = await request.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const requestedProfile = profile && typeof profile === 'object' ? profile : null;
    const requestedWelcomeEmail = welcomeEmail && typeof welcomeEmail === 'object' ? welcomeEmail : null;
    const profileRole = requestedProfile?.role === 'teacher' || requestedProfile?.role === 'staff' ? requestedProfile.role : 'parent';
    const profileFullName = typeof requestedProfile?.fullName === 'string' ? requestedProfile.fullName : null;
    const profilePhone = typeof requestedProfile?.phone === 'string' ? requestedProfile.phone : null;
    const profileIsActive = typeof requestedProfile?.isActive === 'boolean' ? requestedProfile.isActive : true;
    const shouldSendWelcomeEmail = requestedWelcomeEmail?.sendWelcomeEmail === true;
    const welcomeLoginUrl = typeof requestedWelcomeEmail?.loginUrl === 'string' ? requestedWelcomeEmail.loginUrl : null;
    const welcomeSchoolName = typeof requestedWelcomeEmail?.schoolName === 'string' ? requestedWelcomeEmail.schoolName : null;

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

    const emailDelivery = shouldSendWelcomeEmail
      ? await sendWelcomeEmail({
          email: normalizedEmail,
          password,
          fullName: profileFullName,
          schoolName: welcomeSchoolName,
          loginUrl: welcomeLoginUrl,
          role: profileRole,
        })
      : undefined;

    return new Response(JSON.stringify({ user: managedUser, welcomeEmail: emailDelivery }), {
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
