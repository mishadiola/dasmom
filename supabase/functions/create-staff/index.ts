import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { accountEmail, DUPLICATE_EMAIL_MESSAGE, isDuplicateEmailError, sendBrevoEmail } from '../_shared/email.ts';

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

async function emailAlreadyRegistered(email: string) {
  const { data: userRow, error: userError } = await admin
    .from('users')
    .select('id')
    .eq('email_address', email)
    .limit(1)
    .maybeSingle();
  if (userError) {
    console.error('[create-staff] EMAIL CHECK DATABASE ERROR:', {
      message: userError.message,
      details: userError.details,
      hint: userError.hint,
      code: userError.code,
    });
    throw userError;
  }

  console.log('[create-staff] Email check result:', { exists: Boolean(userRow?.id) });
  return Boolean(userRow?.id);
}

async function getCallerRole(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError) {
    console.error('[create-staff] caller Auth verification failed:', authError);
    return null;
  }
  if (!authData.user?.id) return null;

  const { data: userRow, error: userError } = await admin
    .from('users')
    .select('usertype')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (userError) {
    console.error('[create-staff] caller public.users lookup failed:', userError);
    throw userError;
  }

  if (!userRow?.usertype) return { id: authData.user.id, role: '' };

  const { data: userTypeRow, error: userTypeError } = await admin
    .from('user_type')
    .select('user_type')
    .eq('id', userRow.usertype)
    .maybeSingle();
  if (userTypeError) {
    console.error('[create-staff] caller user_type lookup failed:', userTypeError);
    throw userTypeError;
  }

  const role = String(userTypeRow?.user_type || '').trim().toLowerCase().replace(/_/g, ' ');
  return {
    id: authData.user.id,
    role: role === 'station staff' ? 'staff' : role,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let createdUserId: string | null = null;
  let currentStep = 'caller authorization';

  try {
    console.log('[create-staff] Verifying caller authorization...');
    const caller = await getCallerRole(request);
    if (!caller || !['admin', 'cho personnel', 'staff'].includes(caller.role)) {
      return json({ error: 'Staff authorization required' }, 401);
    }

    currentStep = 'request validation';
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

    if (caller.role === 'staff' && role !== 'staff') {
      return json({ error: 'Staff can only create Staff accounts' }, 403);
    }
    if (caller.role === 'cho personnel' && !['staff', 'cho personnel'].includes(role)) {
      return json({ error: 'CHO Personnel can only create Staff or CHO Personnel accounts' }, 403);
    }

    let effectiveStationId = stationId;
    if (caller.role !== 'admin') {
      const { data: callerProfile, error: callerProfileError } = await admin
        .from('staff_profiles')
        .select('station_ass')
        .eq('id', caller.id)
        .maybeSingle();
      if (callerProfileError) throw callerProfileError;
      if (!callerProfile?.station_ass) {
        return json({ error: 'Your account must have an assigned station' }, 403);
      }
      if (stationId && stationId !== callerProfile.station_ass) {
        return json({ error: 'You can only add staff to your own station' }, 403);
      }
      effectiveStationId = callerProfile.station_ass;
    }

    currentStep = 'duplicate email check';
    if (await emailAlreadyRegistered(email)) {
      return json({ code: 'EMAIL_ALREADY_EXISTS', error: DUPLICATE_EMAIL_MESSAGE }, 409);
    }

    currentStep = 'Auth user creation';
    console.log('[create-staff] Creating Auth user...');
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });

    if (authError) throw authError;
    createdUserId = authData.user?.id || null;
    if (!createdUserId) throw new Error('Failed to create staff auth user');
    console.log('[create-staff] Auth user created');

    currentStep = 'public.users creation';
    console.log('[create-staff] Creating public.users record...');
    const { error: userError } = await admin.rpc('create_patient_user_record', {
      p_user_id: createdUserId,
      p_email: email,
      p_role: role,
      p_password: password,
    });

    if (userError) throw userError;
  console.log('[create-staff] public.users record created');

  currentStep = 'station lookup';
    let stationName = caller.role === 'admin' ? String(body.stationName || '').trim() : '';
    if (!stationName && effectiveStationId) {
      const { data: station, error: stationError } = await admin
        .from('stations')
        .select('station_name')
        .eq('id', effectiveStationId)
        .maybeSingle();
      if (stationError) throw stationError;
      stationName = station?.station_name || '';
    }

    currentStep = 'Brevo email sending';
    console.log('[create-staff] Sending Brevo email...');
    await sendBrevoEmail(email, 'Welcome to DASMOM', accountEmail({
      name: fullName,
      email,
      role,
      station: stationName,
      password,
      accountType: 'staff',
    }));
    console.log('[create-staff] Brevo email sent');

    return json({ success: true, userId: createdUserId, message: 'Staff account created and welcome email sent' });
  } catch (error) {
    console.error(`[create-staff] ${currentStep} failed:`, error);
    if (isDuplicateEmailError(error)) {
      return json({ code: 'EMAIL_ALREADY_EXISTS', error: DUPLICATE_EMAIL_MESSAGE }, 409);
    }
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
