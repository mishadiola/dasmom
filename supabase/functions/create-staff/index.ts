import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { accountEmail, sendBrevoEmail } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

async function getCallerRole(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user?.id) return null;

  const { data: userRow, error: userError } = await admin
    .from('users')
    .select('user_type:user_type(user_type)')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (userError) throw userError;

  return {
    id: authData.user.id,
    role: String(userRow?.user_type?.user_type || '').trim().toLowerCase(),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let createdUserId: string | null = null;

  try {
    const caller = await getCallerRole(request);
    if (!caller || !['admin', 'cho personnel'].includes(caller.role)) {
      return json({ error: 'Staff authorization required' }, 401);
    }

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const fullName = String(body.fullName || '').trim();
    const role = String(body.role || '').trim().toLowerCase();
    const stationId = body.stationId ? String(body.stationId) : null;

    if (!email || !password || !fullName || !role) {
      return json({ error: 'Email, password, full name, and role are required' }, 400);
    }

    if (!['admin', 'staff', 'cho personnel'].includes(role)) {
      return json({ error: 'Invalid staff role' }, 400);
    }

    if (caller.role === 'cho personnel' && role !== 'staff') {
      return json({ error: 'CHO Personnel can only create staff accounts' }, 403);
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });

    if (authError) throw authError;
    createdUserId = authData.user?.id || null;
    if (!createdUserId) throw new Error('Failed to create staff auth user');

    const { error: userError } = await admin.rpc('create_patient_user_record', {
      p_user_id: createdUserId,
      p_email: email,
      p_role: role,
      p_password: password,
    });

    if (userError) throw userError;

    let stationName = String(body.stationName || '').trim();
    if (!stationName && stationId) {
      const { data: station, error: stationError } = await admin
        .from('stations')
        .select('station_name')
        .eq('id', stationId)
        .maybeSingle();
      if (stationError) throw stationError;
      stationName = station?.station_name || '';
    }

    await sendBrevoEmail(email, 'Welcome to DASMOM', accountEmail({
      name: fullName,
      email,
      role,
      station: stationName,
      password,
      accountType: 'staff',
    }));

    return json({ success: true, userId: createdUserId, message: 'Staff account created and welcome email sent' });
  } catch (error) {
    if (createdUserId) {
      const { error: userCleanupError } = await admin.from('users').delete().eq('id', createdUserId);
      if (userCleanupError) console.error('create-staff public user cleanup failed:', userCleanupError);
      const { error: cleanupError } = await admin.auth.admin.deleteUser(createdUserId);
      if (cleanupError) console.error('create-staff cleanup failed:', cleanupError);
    }

    console.error('create-staff:', error);
    return json({ error: error instanceof Error ? error.message : 'Staff account creation failed' }, 500);
  }
});
