import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

async function isMother(userId: string) {
  if (!admin) throw new Error('Missing Supabase Edge Function environment variables');

  const { data: userRow, error: userError } = await admin
    .from('users')
    .select('usertype')
    .eq('id', userId)
    .maybeSingle();
  if (userError) throw userError;
  if (!userRow?.usertype) return false;

  const { data: typeRow, error: typeError } = await admin
    .from('user_type')
    .select('user_type')
    .eq('id', userRow.usertype)
    .maybeSingle();
  if (typeError) throw typeError;

  return ['mother', 'patient'].includes(String(typeRow?.user_type || '').trim().toLowerCase());
}

async function prepareWelcome(emailValue: unknown) {
  if (!admin) throw new Error('Missing Supabase Edge Function environment variables');
  const email = String(emailValue || '').trim().toLowerCase();
  if (!email) return { prepared: false };

  const { data: userRow, error: userError } = await admin
    .from('users')
    .select('id')
    .eq('email_address', email)
    .maybeSingle();
  if (userError) throw userError;
  if (!userRow?.id || !await isMother(userRow.id)) return { prepared: false };

  const { data: authResult, error: authError } = await admin.auth.admin.getUserById(userRow.id);
  if (authError || !authResult?.user) return { prepared: false };

  const authUser = authResult.user;
  const appMetadata = authUser.app_metadata || {};
  if (appMetadata.mother_welcome_completed === true) return { prepared: false };
  if (appMetadata.mother_welcome_pending === true) return { prepared: true };
  if (authUser.last_sign_in_at) return { prepared: false };

  const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, {
    app_metadata: { ...appMetadata, mother_welcome_pending: true },
  });
  if (updateError) throw updateError;
  return { prepared: true };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!admin) throw new Error('Missing Supabase Edge Function environment variables');
    const body = await request.json();

    if (body.action === 'prepare') {
      return json(await prepareWelcome(body.email));
    }

    if (body.action !== 'claim') return json({ error: 'Invalid action' }, 400);

    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Authentication required' }, 401);

    const { data: authResult, error: authError } = await admin.auth.getUser(token);
    const authUser = authResult?.user;
    if (authError || !authUser?.id) return json({ error: 'Authentication required' }, 401);
    if (!await isMother(authUser.id)) return json({ error: 'Mother account required' }, 403);

    const appMetadata = authUser.app_metadata || {};
    if (appMetadata.mother_welcome_pending !== true) return json({ showWelcome: false });

    const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, {
      app_metadata: {
        ...appMetadata,
        mother_welcome_pending: false,
        mother_welcome_completed: true,
      },
    });
    if (updateError) throw updateError;

    return json({ showWelcome: true });
  } catch (error) {
    console.error('[mother-welcome] request failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Request failed' }, 500);
  }
});