import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { accountEmail, APP_URL, DUPLICATE_EMAIL_MESSAGE, escapeHtml, isDuplicateEmailError, sendBrevoEmail } from '../_shared/email.ts';

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

const dateLabel = (value: string | null | undefined) => value
  ? new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  : 'Not set';

async function emailAlreadyRegistered(email: string) {
  const { data: userRow, error: userError } = await admin
    .from('users')
    .select('id')
    .eq('email_address', email)
    .maybeSingle();
  if (userError) throw userError;
  if (userRow?.id) return true;

  const { data: authData, error: authError } = await admin.auth.admin.getUserByEmail(email);
  if (authData?.user?.id) return true;
  if (authError && authError.status !== 404) throw authError;
  return false;
}

async function requireStaff(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;

  const { data: authData } = await admin.auth.getUser(token);
  const userId = authData.user?.id;
  if (!userId) return false;

  const { data: userRow } = await admin
    .from('users')
    .select('user_type:user_type(user_type)')
    .eq('id', userId)
    .maybeSingle();
  const role = String(userRow?.user_type?.user_type || '').toLowerCase();
  return ['admin', 'staff', 'cho personnel'].includes(role);
}

async function getMother(patientId: string) {
  const [{ data: patient }, { data: user }, { data: pregnancy }, { data: visits }] = await Promise.all([
    admin.from('patient_basic_info').select('id, first_name, last_name, municipality, station_ass').eq('id', patientId).maybeSingle(),
    admin.from('users').select('email_address').eq('id', patientId).maybeSingle(),
    admin.from('pregnancy_info').select('pregn_postp, lmd, edd, pregnancy_type, gravida, para, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('prenatal_visits').select('visit_number, visit_date, next_appt_type, status').eq('patient_id', patientId).order('visit_date', { ascending: true }),
  ]);

  return { patient, email: user?.email_address, pregnancy, visits: visits || [] };
}

function scheduleRows(visits: Array<Record<string, unknown>>) {
  return visits
    .filter((visit) => visit.visit_date && ['Scheduled', 'Attended'].includes(String(visit.status)))
    .map((visit) => `<tr><td>${escapeHtml(visit.visit_number || '-')}</td><td>${escapeHtml(dateLabel(String(visit.visit_date)))}</td><td>${escapeHtml(visit.next_appt_type || 'Prenatal checkup')}</td><td>${escapeHtml(visit.status)}</td></tr>`)
    .join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let createdUserId: string | null = null;

  try {
    const body = await request.json();
    const action = String(body.action || '');

    // Preserve the deployed function's original account-creation contract.
    if (!action && body.email && body.password && body.motherName) {
      if (!await requireStaff(request)) return json({ error: 'Staff authorization required' }, 401);
      const email = String(body.email).trim().toLowerCase();
      if (await emailAlreadyRegistered(email)) {
        return json({ error: 'An account with this email already exists.' }, 409);
      }

      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email,
        password: String(body.password),
        email_confirm: true,
        user_metadata: { full_name: String(body.motherName) },
      });
      if (userError) throw userError;
      createdUserId = userData.user?.id || null;

      await sendBrevoEmail(email, 'Welcome to DASMOM', accountEmail({
        name: String(body.motherName),
        email,
        role: 'mother',
        password: String(body.password),
        accountType: 'mother',
      }));
      return json({ success: true, userId: userData.user?.id, message: 'Mother account created and welcome email sent' });
    }

    if (!await requireStaff(request)) return json({ error: 'Staff authorization required' }, 401);
    if (!['welcome', 'new_pregnancy'].includes(action) || !body.patientId) return json({ error: 'Invalid email request' }, 400);

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

    await sendBrevoEmail(mother.email, subject, html);
    return json({ sent: true });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return json({ code: 'EMAIL_ALREADY_EXISTS', error: DUPLICATE_EMAIL_MESSAGE }, 409);
    }
    if (createdUserId) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(createdUserId);
      if (cleanupError) console.error('create-mother cleanup failed:', cleanupError);
    }
    console.error('create-mother:', error);
    return json({ error: error instanceof Error ? error.message : 'Email request failed' }, 500);
  }
});
