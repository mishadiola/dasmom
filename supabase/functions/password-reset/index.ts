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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return json({ error: 'Email is required' }, 400);

    const { data: userRow, error: userError } = await admin
      .from('users')
      .select('id')
      .eq('email_address', email)
      .maybeSingle();
    if (userError) throw userError;

    // Keep the response generic so this endpoint does not disclose account existence.
    if (!userRow?.id) return json({ sent: true });

    const redirectTo = `${APP_URL.replace(/\/+$/, '')}/reset-password`;
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
