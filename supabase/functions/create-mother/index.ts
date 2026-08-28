import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const APP_URL = 'https://dasmom.vercel.app/';
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const brevoApiKey = Deno.env.get('BREVO_API_KEY');
const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL');
const senderName = Deno.env.get('BREVO_SENDER_NAME') || 'DASMOM';

const admin = createClient(supabaseUrl, serviceRoleKey);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const dateLabel = (value: string | null | undefined) => value
  ? new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  : 'Not set';

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

async function sendBrevoEmail(to: string, subject: string, htmlContent: string) {
  if (!brevoApiKey || !senderEmail) throw new Error('BREVO_API_KEY and BREVO_SENDER_EMAIL must be configured');

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'accept': 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  if (!response.ok) throw new Error(`Brevo returned ${response.status}: ${await response.text()}`);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json();
    const action = String(body.action || '');

    // Preserve the deployed function's original account-creation contract.
    if (!action && body.email && body.password && body.motherName) {
      if (!await requireStaff(request)) return json({ error: 'Staff authorization required' }, 401);

      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email: String(body.email).trim().toLowerCase(),
        password: String(body.password),
        email_confirm: true,
        user_metadata: { full_name: String(body.motherName) },
      });
      if (userError) throw userError;

      const motherName = escapeHtml(body.motherName);
      const email = String(body.email).trim().toLowerCase();
      await sendBrevoEmail(email, 'Welcome to DASMOM', `<h2>Welcome to DASMOM, ${motherName}!</h2><p>Your DASMOM account has been created.</p><p><strong>Email:</strong> ${escapeHtml(email)}<br><strong>Temporary password:</strong> ${escapeHtml(body.password)}</p><p><a href="${APP_URL}">Open DASMOM</a></p><p>Please change your password after your first login.</p>`);
      return json({ success: true, userId: userData.user?.id, message: 'Mother account created and welcome email sent' });
    }

    if (action === 'password_reset') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return json({ error: 'Email is required' }, 400);

      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: body.redirectTo || `${APP_URL}reset-password` },
      });
      // Keep this response generic so the endpoint does not reveal whether an account exists.
      if (linkError || !linkData?.properties?.action_link) return json({ sent: true });

      await sendBrevoEmail(email, 'Reset your DASMOM password', `<p>Hello,</p><p>Use the secure link below to reset your DASMOM password:</p><p><a href="${escapeHtml(linkData.properties.action_link)}">Reset my password</a></p><p>This link expires soon. If you did not request this, you can ignore this email.</p>`);
      return json({ sent: true });
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
    console.error('create-mother:', error);
    return json({ error: error instanceof Error ? error.message : 'Email request failed' }, 500);
  }
});
