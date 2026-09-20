import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

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
    if (body.action === 'cleanup') {
      const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
      if (!token) return json({ cleaned: false }, 401);

      const { data: authData, error: authError } = await admin.auth.getUser(token);
      const authUser = authData.user;
      if (authError || !authUser?.id) return json({ cleaned: false }, 401);

      const { data: linkedUser, error: linkedUserError } = await admin
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle();
      if (linkedUserError) throw linkedUserError;

      if (!linkedUser) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(authUser.id);
        if (deleteError) throw deleteError;
        return json({ cleaned: true });
      }
      return json({ cleaned: false });
    }

    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ allowed: false, error: 'Enter the email registered for your DasMom account.' }, 400);
    }

    const { data: userRow, error: userError } = await admin
      .from('users')
      .select('id')
      .eq('email_address', email)
      .maybeSingle();
    if (userError) throw userError;
    if (!userRow?.id) return json({ allowed: false, error: 'This email is not registered for a DasMom account.' }, 403);

    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userRow.id);
    if (authError || !authUser?.user || authUser.user.email?.toLowerCase() !== email) {
      return json({ allowed: false, error: 'This email is not registered for a DasMom account.' }, 403);
    }

    return json({ allowed: true });
  } catch (error) {
    console.error('google-account-check:', error);
    return json({ allowed: false, error: 'Unable to verify the DasMom account.' }, 500);
  }
});
