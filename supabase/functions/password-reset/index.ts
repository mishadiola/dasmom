import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { APP_URL, escapeHtml, sendBrevoEmail } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json();
    let email = String(body.email || '').trim().toLowerCase();
    const targetUserId = String(body.targetUserId || '').trim();
    if (targetUserId) {
      const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
      if (!token || !anonKey) return json({ error: 'Authentication required' }, 401);

      const { data: authData, error: authError } = await admin.auth.getUser(token);
      if (authError || !authData.user?.id) return json({ error: 'Authentication required' }, 401);

      const [
        { data: callerProfile, error: callerProfileError },
        { data: targetProfile, error: targetProfileError },
        { data: targetUser, error: targetUserError },
      ] = await Promise.all([
        admin.from('staff_profiles').select('station_ass').eq('id', authData.user.id).maybeSingle(),
        admin.from('staff_profiles').select('station_ass').eq('id', targetUserId).maybeSingle(),
        admin.from('users').select('email_address').eq('id', targetUserId).maybeSingle(),
      ]);
      if (callerProfileError) throw callerProfileError;
      if (targetProfileError) throw targetProfileError;
      if (targetUserError) throw targetUserError;
      if (!callerProfile || !targetProfile || !targetUser?.email_address) {
        return json({ error: 'Staff account not found' }, 404);
      }

      const sameStation = Boolean(
        callerProfile.station_ass &&
        callerProfile.station_ass === targetProfile.station_ass
      );
      const callerClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        anonKey,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const { data: allowed, error: permissionError } = await callerClient.rpc('has_permission', {
        p_permission_key: `staff.password.reset.${sameStation ? 'own' : 'other'}_station`,
      });
      if (permissionError) throw permissionError;
      if (allowed !== true) return json({ error: 'You do not have permission to reset this password' }, 403);

      email = String(targetUser.email_address).trim().toLowerCase();
    }

    if (!email) return json({ error: 'Email is required' }, 400);

    const { data: userRow, error: userError } = await admin
      .from('users')
      .select('id, user_type:user_type(user_type)')
      .eq('email_address', email)
      .maybeSingle();
    if (userError) throw userError;

    // Keep the response generic so this endpoint does not disclose account existence.
    if (!userRow?.id) return json({ sent: true });

    const role = String(userRow.user_type?.user_type || '').trim().toLowerCase();
    const accountType = ['mother', 'patient'].includes(role) ? 'mother' : 'staff';
    const redirectTo = `${APP_URL.replace(/\/+$/, '')}/reset-password?accountType=${accountType}`;
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    if (linkError || !linkData?.properties?.action_link) return json({ sent: true });

    await sendBrevoEmail(
      email,
      'Reset your DASMOM password',
      `<p>Hello,</p><p>Use the secure link below to reset your DASMOM password:</p><p><a href="${escapeHtml(linkData.properties.action_link)}">Reset my password</a></p><p>This link expires soon. If you did not request this, you can ignore this email.</p>`,
    );

    return json({ sent: true });
  } catch (error) {
    console.error('password-reset:', error);
    return json({ error: error instanceof Error ? error.message : 'Password reset failed' }, 500);
  }
});
