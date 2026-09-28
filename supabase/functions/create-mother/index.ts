import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { accountEmail, APP_URL, DUPLICATE_EMAIL_MESSAGE, escapeHtml, isDuplicateEmailError, sendBrevoEmail } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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
  if (!token) {
    console.warn('[create-mother] staff verification failed: missing bearer token');
    return false;
  }

  const { data: authData, error: authError } = await getAdmin().auth.getUser(token);
  if (authError) {
    console.error('[create-mother] staff verification auth lookup failed:', authError);
    return false;
  }
  const userId = authData.user?.id;
  if (!userId) {
    console.warn('[create-mother] staff verification failed: token has no user');
    return false;
  }

  const { data: userRow, error: userError } = await getAdmin()
    .from('users')
    .select('usertype')
    .eq('id', userId)
    .maybeSingle();
  if (userError) {
    console.error('[create-mother] staff verification public.users lookup failed:', userError);
    throw userError;
  }
  if (!userRow?.usertype) {
    console.warn('[create-mother] staff verification failed: no public.users role for authenticated user');
    return false;
  }

  const { data: userTypeRow, error: userTypeError } = await getAdmin()
    .from('user_type')
    .select('user_type')
    .eq('id', userRow.usertype)
    .maybeSingle();
  if (userTypeError) {
    console.error('[create-mother] staff verification user_type lookup failed:', userTypeError);
    throw userTypeError;
  }

  const role = String(userTypeRow?.user_type || '').trim().toLowerCase();
  const allowed = ['admin', 'staff', 'cho personnel'].includes(role);
  if (!allowed) console.warn('[create-mother] staff verification denied: role is not operational');
  return allowed;
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
        password: String(body.password),
      });
      if (publicUserError) throw publicUserError;
      publicUserCreated = true;
      console.log('[create-mother] public.users record created');

      currentStep = 'Brevo email sending';
      console.log('[create-mother] Sending Brevo email...');
      await sendBrevoEmail(email, 'Welcome to DASMOM', accountEmail({
        name: String(body.motherName),
        email,
        role: 'mother',
        password: String(body.password),
        accountType: 'mother',
      }));
      console.log('[create-mother] Brevo email sent');
      return json({ success: true, userId: createdUserId, message: 'Mother account created and welcome email sent' });
    }

    currentStep = 'staff authorization';
    if (!await requireStaff(request)) return json({ error: 'Staff authorization required' }, 401);
    if (!['welcome', 'new_pregnancy'].includes(action) || !body.patientId) return json({ error: 'Invalid email request' }, 400);

    currentStep = 'mother data lookup';
    const mother = await getMother(String(body.patientId));
    if (!mother.email || !mother.patient) return json({ error: 'Mother email or profile not found' }, 404);

    const name = `${mother.patient.first_name || ''} ${mother.patient.last_name || ''}`.trim() || 'there';
    const isNewPregnancy = action === 'new_pregnancy';
    const subject = isNewPregnancy ? 'Congratulations on your new pregnancy | DASMOM' : 'Welcome to DASMOM';
    const passwordBlock = !isNewPregnancy && body.temporaryPassword
      ? `<p><strong>Your initial password:</strong> ${escapeHtml(body.temporaryPassword)}</p><p>Please change this password after your first login.</p>`
      : '';
    const pregnancy = mother.pregnancy || {};
    const html = `<h2>${isNewPregnancy ? `Congratulations, ${escapeHtml(name)}!` : `Welcome to DASMOM, ${escapeHtml(name)}!`}</h2><p>${isNewPregnancy ? 'Your new pregnancy has been registered in DASMOM.' : 'Your mother account has been created.'}</p>${passwordBlock}<h3>Pregnancy information</h3><p><strong>LMP:</strong> ${escapeHtml(dateLabel(pregnancy.lmd))}<br><strong>EDD:</strong> ${escapeHtml(dateLabel(pregnancy.edd))}<br><strong>Pregnancy type:</strong> ${escapeHtml(pregnancy.pregnancy_type || 'Not set')}<br><strong>Gravida / Para:</strong> ${escapeHtml(pregnancy.gravida || '-')} / ${escapeHtml(pregnancy.para || '-')}</p><h3>Your schedule</h3><table border="1" cellpadding="8" cellspacing="0"><thead><tr><th>Visit</th><th>Date</th><th>Type</th><th>Status</th></tr></thead><tbody>${scheduleRows(mother.visits)}</tbody></table><p><a href="${APP_URL}">Open DASMOM</a></p><p>Please contact your health worker if any information is incorrect.</p>`;

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
