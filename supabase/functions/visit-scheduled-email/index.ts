import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { escapeHtml, sendBrevoEmail } from '../_shared/email.ts';

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

const normalizeRole = (value: unknown) => {
  const role = String(value || '').trim().toLowerCase().replaceAll('_', ' ');
  return role === 'station staff' ? 'staff' : role;
};

function formatScheduleDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!admin) return json({ error: 'Notification service is not configured' }, 500);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Authentication required' }, 401);

  const { data: authResult, error: authError } = await admin.auth.getUser(token);
  const authUser = authResult?.user;
  if (authError || !authUser?.id) return json({ error: 'Authentication required' }, 401);

  try {
    const body = await request.json();
    const visitType = body?.visit_type;
    const visitId = String(body?.visit_id || '').trim();
    if (!['prenatal', 'postpartum'].includes(visitType)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitId)) {
      return json({ error: 'A supported visit type and visit ID are required' }, 400);
    }

    const { data: userRow, error: userError } = await admin
      .from('users')
      .select('usertype')
      .eq('id', authUser.id)
      .maybeSingle();
    if (userError) throw userError;
    if (!userRow?.usertype) return json({ error: 'Authorized staff account required' }, 403);

    const { data: typeRow, error: typeError } = await admin
      .from('user_type')
      .select('user_type')
      .eq('id', userRow.usertype)
      .maybeSingle();
    if (typeError) throw typeError;
    if (!['admin', 'staff', 'cho personnel'].includes(normalizeRole(typeRow?.user_type))) {
      return json({ error: 'Only authorized staff can send visit notifications' }, 403);
    }

    const isPrenatal = visitType === 'prenatal';
    const table = isPrenatal ? 'prenatal_visits' : 'postpartum_visits';
    const columns = isPrenatal
      ? 'id, patient_id, visit_date, next_appt_type, created_by, status'
      : 'id, patient_id, scheduled_date, visit_type, created_by, status';
    const { data: visit, error: visitError } = await admin
      .from(table)
      .select(columns)
      .eq('id', visitId)
      .maybeSingle();
    if (visitError) throw visitError;
    if (!visit) return json({ error: 'Scheduled visit was not found' }, 404);
    if (visit.created_by !== authUser.id || visit.status !== 'Scheduled') {
      return json({ error: 'Notification does not match a visit created by this account' }, 403);
    }

    const { data: account, error: accountError } = await admin
      .from('users')
      .select('email_address')
      .eq('id', visit.patient_id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account?.email_address) return json({ error: 'Patient has no email address on file' }, 422);

    const { data: patient, error: patientError } = await admin
      .from('patient_basic_info')
      .select('first_name, last_name')
      .eq('id', visit.patient_id)
      .maybeSingle();
    if (patientError) throw patientError;

    const date = isPrenatal ? visit.visit_date : visit.scheduled_date;
    const visitLabel = isPrenatal
      ? visit.next_appt_type || 'Prenatal visit'
      : visit.visit_type || 'Postpartum visit';
    const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'there';
    const htmlContent = `
      <h2>New appointment scheduled, ${escapeHtml(patientName)}</h2>
      <p>A ${escapeHtml(visitLabel)} has been scheduled for you.</p>
      <p><strong>Date:</strong> ${escapeHtml(formatScheduleDate(date))}</p>
      <p>Please contact your local health station if you have questions or need assistance.</p>
      <p>With care,<br>DASMOM</p>
    `;
    await sendBrevoEmail(account.email_address, 'Your DasMom appointment has been scheduled', htmlContent);
    return json({ emailSent: true });
  } catch (error) {
    console.error('[visit-scheduled-email] request failed');
    return json({
      emailSent: false,
      error: error instanceof Error ? error.message : 'Could not send the visit notification',
    }, 500);
  }
});
