import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { accountEmail, APK_DOWNLOAD_URL, DUPLICATE_EMAIL_MESSAGE, escapeHtml, isDuplicateEmailError, MOTHER_LANDING_URL, PASSWORD_RESET_URL, sendBrevoEmail } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
let adminClient: ReturnType<typeof createClient> | null = null;

function getAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing required Edge Function environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!adminClient) adminClient = createClient(supabaseUrl, serviceRoleKey);
  return adminClient;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const dateLabel = (value: string | null | undefined) => value
  ? new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  : 'Not set';

async function emailAlreadyRegistered(email: string) {
  const { data: userRow, error: userError } = await getAdmin()
    .from('users')
    .select('id')
    .eq('email_address', email)
    .maybeSingle();
  if (userError) throw userError;
  return Boolean(userRow?.id);
}

async function requireStaff(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !anonKey || !supabaseUrl) {
    console.warn('[create-mother] staff verification failed: missing authorization configuration');
    return false;
  }

  const { data: authData, error: authError } = await getAdmin().auth.getUser(token);
  if (authError || !authData.user?.id) {
    console.warn('[create-mother] staff verification failed: token could not be verified');
    return false;
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerRole, error: roleError } = await callerClient.rpc('get_my_role');
  if (roleError) {
    console.error('[create-mother] staff role verification RPC failed:', roleError);
    throw roleError;
  }

  const role = String(callerRole || '').trim().toLowerCase().replace(/_/g, ' ');
  const allowed = ['admin', 'staff', 'station staff', 'cho personnel'].includes(role);
  if (!allowed) console.warn('[create-mother] staff verification denied:', { role: role || 'missing' });
  return allowed;
}

async function callerCanRegisterPatient(request: Request, targetStationId: string) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !anonKey || !supabaseUrl || !targetStationId) {
    throw new Error('Permission verification is not configured');
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [stationResult, ownResult, otherResult, assignOtherResult] = await Promise.all([
    callerClient.rpc('get_my_station'),
    callerClient.rpc('has_permission', { p_permission_key: 'patient.register.own_station' }),
    callerClient.rpc('has_permission', { p_permission_key: 'patient.register.other_station' }),
    callerClient.rpc('has_permission', { p_permission_key: 'patient.register.assign_other_station' }),
  ]);
  if (stationResult.error) throw stationResult.error;
  if (ownResult.error) throw ownResult.error;
  if (otherResult.error) throw otherResult.error;
  if (assignOtherResult.error) throw assignOtherResult.error;
  if (stationResult.data === targetStationId) return ownResult.data === true;
  return otherResult.data === true && assignOtherResult.data === true;
}

async function callerCanViewPatient(request: Request, patientId: string) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !anonKey || !supabaseUrl) {
    throw new Error('Permission verification is not configured');
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await callerClient.rpc('guard_patient_data_read', {
    p_patient_id: patientId,
    p_own_permission: 'patient.view.own_station',
    p_other_permission: 'patient.view.other_station',
  });
  if (error) throw error;
  return data === true;
}

async function getMother(patientId: string) {
  const [{ data: patient }, { data: user }, { data: pregnancy }, { data: visits }] = await Promise.all([
    getAdmin().from('patient_basic_info').select('id, first_name, last_name, municipality, station_ass').eq('id', patientId).maybeSingle(),
    getAdmin().from('users').select('email_address').eq('id', patientId).maybeSingle(),
    getAdmin().from('pregnancy_info').select('pregn_postp, lmd, edd, pregnancy_type, gravida, para, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    getAdmin().from('prenatal_visits').select('visit_number, visit_date, next_appt_type, status').eq('patient_id', patientId).order('visit_date', { ascending: true }),
  ]);

  return { patient, email: user?.email_address, pregnancy, visits: visits || [] };
}

function scheduleRows(visits: Array<Record<string, unknown>>) {
  return visits
    .filter((visit) => visit.visit_date && ['Scheduled', 'Attended'].includes(String(visit.status)))
    .map((visit) => `<tr><td>${escapeHtml(visit.visit_number || '-')}</td><td>${escapeHtml(dateLabel(String(visit.visit_date)))}</td><td>${escapeHtml(visit.next_appt_type || 'Prenatal checkup')}</td><td>${escapeHtml(visit.status)}</td></tr>`)
    .join('');
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let createdUserId: string | null = null;
  let publicUserCreated = false;
  let currentStep = 'request parsing';

  try {
    currentStep = 'environment configuration';
    getAdmin();
    console.log('[create-mother] required Supabase environment variables verified');

    const body = await request.json();
    const action = String(body.action || '');

    // Preserve the deployed function's original account-creation contract.
    if (!action && body.email && body.password && body.motherName) {
      currentStep = 'staff authorization';
      if (!await requireStaff(request)) return json({ error: 'Staff authorization required' }, 401);
      const targetStationId = String(body.stationId || '');
      currentStep = 'patient station validation';
      if (!targetStationId) return json({ error: 'A patient station is required' }, 400);
      const { data: station, error: stationError } = await getAdmin()
        .from('stations')
        .select('id')
        .eq('id', targetStationId)
        .maybeSingle();
      if (stationError) throw stationError;
      if (!station) return json({ error: 'The selected station does not exist' }, 400);
      currentStep = 'patient registration permission';
      if (!await callerCanRegisterPatient(request, targetStationId)) {
        return json({ error: 'You do not have permission to register patients' }, 403);
      }
      const email = String(body.email).trim().toLowerCase();

      currentStep = 'duplicate email check';
      if (await emailAlreadyRegistered(email)) {
        return json({ error: 'An account with this email already exists.' }, 409);
      }

      currentStep = 'Auth user creation';
      console.log('[create-mother] Creating Auth user...');
      const { data: userData, error: userError } = await getAdmin().auth.admin.createUser({
        email,
        password: String(body.password),
        email_confirm: true,
        user_metadata: { full_name: String(body.motherName) },
        app_metadata: { mother_welcome_pending: true },
      });
      if (userError) throw userError;
      createdUserId = userData.user?.id || null;
      if (!createdUserId) throw new Error('Supabase Auth did not return the created user ID');
      console.log('[create-mother] Auth user created');

      currentStep = 'mother role lookup';
      const { data: roles, error: roleError } = await getAdmin()
        .from('user_type')
        .select('id, user_type');
      if (roleError) {
        console.error('[create-mother] patient role lookup failed:', roleError);
        throw roleError;
      }
      const normalizedRoles = ((roles || []) as Array<{ id: string; user_type: string | null }>).map((role) => ({
        id: role.id,
        name: String(role.user_type || '').trim().toLowerCase(),
      }));
      const patientRole = normalizedRoles.find((role) => role.name === 'patient')
        || normalizedRoles.find((role) => role.name === 'mother');
      if (!patientRole?.id) throw new Error('Neither patient nor mother role exists in public.user_type');

      currentStep = 'public.users insertion';
      console.log('[create-mother] Creating public.users record...');
      const { error: publicUserError } = await getAdmin().from('users').insert({
        id: createdUserId,
        email_address: email,
        usertype: patientRole.id,
      });
      if (publicUserError) throw publicUserError;
      publicUserCreated = true;
      console.log('[create-mother] public.users record created');

      currentStep = 'password setup link generation';
      const { data: setupLinkData, error: setupLinkError } = await getAdmin().auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: PASSWORD_RESET_URL },
      });
      if (setupLinkError) throw setupLinkError;
      const setupLink = setupLinkData.properties?.action_link;
      if (!setupLink) throw new Error('Supabase Auth did not return a password setup link');

      currentStep = 'Brevo email sending';
      console.log('[create-mother] Sending Brevo email...');
      await sendBrevoEmail(email, 'Welcome to DASMOM', accountEmail({
        name: String(body.motherName),
        email,
        role: 'mother',
        setupLink,
        accountType: 'mother',
      }));
      console.log('[create-mother] Brevo email sent');
      return json({ success: true, userId: createdUserId, message: 'Mother account created and welcome email sent' });
    }

    currentStep = 'staff authorization';
    if (!await requireStaff(request)) return json({ error: 'Staff authorization required' }, 401);
    if (!['welcome', 'new_pregnancy'].includes(action) || !body.patientId) return json({ error: 'Invalid email request' }, 400);
    currentStep = 'patient visibility permission';
    if (!await callerCanViewPatient(request, String(body.patientId))) {
      return json({ error: 'You do not have permission to access this patient' }, 403);
    }

    currentStep = 'mother data lookup';
    const mother = await getMother(String(body.patientId));
    if (!mother.email || !mother.patient) return json({ error: 'Mother email or profile not found' }, 404);

    const name = `${mother.patient.first_name || ''} ${mother.patient.last_name || ''}`.trim() || 'there';
    const isNewPregnancy = action === 'new_pregnancy';
    const subject = isNewPregnancy ? 'Congratulations on your new pregnancy | DASMOM' : 'Welcome to DASMOM';
    let passwordSetupBlock = '';
    if (!isNewPregnancy) {
      currentStep = 'password setup link generation';
      const { data: setupLinkData, error: setupLinkError } = await getAdmin().auth.admin.generateLink({
        type: 'recovery',
        email: mother.email,
        options: { redirectTo: PASSWORD_RESET_URL },
      });
      if (setupLinkError) throw setupLinkError;
      const setupLink = setupLinkData.properties?.action_link;
      if (!setupLink) throw new Error('Supabase Auth did not return a password setup link');
      passwordSetupBlock = `<p><a href="${escapeHtml(setupLink)}">Set or reset your DASMOM password</a></p>`;
    }
    const pregnancy = mother.pregnancy || {};
    const html = `<h2>${isNewPregnancy ? `Congratulations, ${escapeHtml(name)}!` : `Welcome to DASMOM, ${escapeHtml(name)}!`}</h2><p>${isNewPregnancy ? 'Your new pregnancy has been registered in DASMOM.' : 'Your mother account has been created.'}</p>${passwordSetupBlock}<p><a href="${escapeHtml(APK_DOWNLOAD_URL)}">Download the DasMom Android app (APK)</a></p><h3>Pregnancy information</h3><p><strong>LMP:</strong> ${escapeHtml(dateLabel(pregnancy.lmd))}<br><strong>EDD:</strong> ${escapeHtml(dateLabel(pregnancy.edd))}<br><strong>Pregnancy type:</strong> ${escapeHtml(pregnancy.pregnancy_type || 'Not set')}<br><strong>Gravida / Para:</strong> ${escapeHtml(pregnancy.gravida || '-')} / ${escapeHtml(pregnancy.para || '-')}</p><h3>Your schedule</h3><table border="1" cellpadding="8" cellspacing="0"><thead><tr><th>Visit</th><th>Date</th><th>Type</th><th>Status</th></tr></thead><tbody>${scheduleRows(mother.visits)}</tbody></table><p><a href="${escapeHtml(MOTHER_LANDING_URL)}">Open DASMOM</a></p><p>Please contact your health worker if any information is incorrect.</p>`;

    currentStep = 'Brevo email sending';
    console.log('[create-mother] Sending Brevo email...');
    await sendBrevoEmail(mother.email, subject, html);
    console.log('[create-mother] Brevo email sent');
    return json({ sent: true });
  } catch (error) {
    console.error(`[create-mother] ${currentStep} failed:`, error);
    if (publicUserCreated && createdUserId) {
      try {
        const { error: publicCleanupError } = await getAdmin().from('users').delete().eq('id', createdUserId);
        if (publicCleanupError) console.error('[create-mother] public.users cleanup failed:', publicCleanupError);
      } catch (cleanupError) {
        console.error('[create-mother] public.users cleanup threw:', cleanupError);
      }
    }
    if (createdUserId) {
      try {
        const { error: cleanupError } = await getAdmin().auth.admin.deleteUser(createdUserId);
        if (cleanupError) console.error('[create-mother] Auth user cleanup failed:', cleanupError);
      } catch (cleanupError) {
        console.error('[create-mother] Auth user cleanup threw:', cleanupError);
      }
    }
    if (isDuplicateEmailError(error)) {
      return json({ code: 'EMAIL_ALREADY_EXISTS', error: DUPLICATE_EMAIL_MESSAGE }, 409);
    }
    return json({ error: error instanceof Error ? error.message : String(error) || 'Edge Function request failed' }, 500);
  }
});
