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

type VisitType = 'prenatal' | 'postpartum' | 'maternal_vaccination' | 'newborn_vaccination';
type VisitRow = {
  id: string;
  patient_id: string | null;
  newborn_id?: string | null;
  visit_type?: string | null;
  status: string;
  scheduled_date: string;
  rescheduled_from_date: string | null;
  rescheduled_by: string | null;
  reschedule_reason: string | null;
  reschedule_event_id: string | null;
  vaccine_inventory?: { vaccine_name?: string | null } | { vaccine_name?: string | null }[] | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const normalizeRole = (value: unknown) => {
  const role = String(value || '').trim().toLowerCase().replaceAll('_', ' ');
  return role === 'station staff' ? 'staff' : role;
};

const visitTables: Record<VisitType, { table: string; dateColumn: string }> = {
  prenatal: { table: 'prenatal_visits', dateColumn: 'visit_date' },
  postpartum: { table: 'postpartum_visits', dateColumn: 'scheduled_date' },
  maternal_vaccination: { table: 'vaccinations', dateColumn: 'scheduled_vaccination' },
  newborn_vaccination: { table: 'vaccinations', dateColumn: 'scheduled_vaccination' },
};

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatScheduleDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function vaccineName(value: VisitRow['vaccine_inventory']) {
  const inventory = Array.isArray(value) ? value[0] : value;
  return inventory?.vaccine_name || 'scheduled vaccination';
}

async function updateEventStatus(eventId: string, status: 'sent' | 'failed') {
  const { error } = await admin!
    .from('visit_reschedule_email_events')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('event_id', eventId);
  if (error) {
    console.error('[visit-reschedule-email] notification status update failed');
    throw new Error('Could not record notification status');
  }
}

async function claimEvent(eventId: string, visitType: VisitType, visitId: string) {
  const { data, error } = await admin!
    .from('visit_reschedule_email_events')
    .insert({ event_id: eventId, visit_type: visitType, visit_id: visitId, status: 'processing' })
    .select('event_id')
    .maybeSingle();

  if (!error) return data ? 'claimed' : 'processing';
  if (error.code !== '23505') throw error;

  const { data: retry, error: retryError } = await admin!
    .from('visit_reschedule_email_events')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('visit_type', visitType)
    .eq('visit_id', visitId)
    .eq('status', 'failed')
    .select('event_id')
    .maybeSingle();
  if (retryError) throw retryError;
  if (retry) return 'claimed';

  const { data: existing, error: existingError } = await admin!
    .from('visit_reschedule_email_events')
    .select('status, visit_type, visit_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing || existing.visit_type !== visitType || existing.visit_id !== visitId) {
    throw new Error('Notification event does not match the rescheduling record');
  }
  return existing.status === 'sent' ? 'sent' : 'processing';
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

  let eventId = '';
  let emailDelivered = false;
  try {
    const body = await request.json();
    const visitType = body?.visit_type as VisitType;
    const visitId = String(body?.visit_id || '').trim();
    eventId = String(body?.event_id || '').trim();
    const originalDate = body?.original_date;
    const newDate = body?.new_date;

    if (!Object.hasOwn(visitTables, visitType) || !isUuid(visitId) || !isUuid(eventId)) {
      return json({ error: 'A supported visit type, visit ID, and event ID are required' }, 400);
    }
    if (!isDate(originalDate) || !isDate(newDate) || originalDate === newDate) {
      return json({ error: 'Valid, different original and new dates are required' }, 400);
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
    const role = normalizeRole(typeRow?.user_type);
    if (!['admin', 'staff', 'cho personnel'].includes(role)) {
      return json({ error: 'Only authorized staff can send visit notifications' }, 403);
    }

    const { table, dateColumn } = visitTables[visitType];
    const selectColumns = visitType === 'postpartum'
      ? `id, patient_id, status, ${dateColumn}, visit_type, rescheduled_from_date, rescheduled_by, reschedule_reason, reschedule_event_id`
      : visitType === 'maternal_vaccination' || visitType === 'newborn_vaccination'
        ? `id, patient_id, newborn_id, status, ${dateColumn}, vaccine_inventory(vaccine_name), rescheduled_from_date, rescheduled_by, reschedule_reason, reschedule_event_id`
        : `id, patient_id, status, ${dateColumn}, rescheduled_from_date, rescheduled_by, reschedule_reason, reschedule_event_id`;
    const { data: rawVisit, error: visitError } = await admin
      .from(table)
      .select(selectColumns)
      .eq('id', visitId)
      .maybeSingle();
    if (visitError) throw visitError;
    if (!rawVisit) return json({ error: 'Rescheduled visit was not found' }, 404);

    const visit = rawVisit as VisitRow & Record<string, unknown>;
    const scheduledDate = visit.scheduled_date || String(visit[dateColumn] || '').slice(0, 10);
    if (
      visit.rescheduled_by !== authUser.id
      || visit.reschedule_event_id !== eventId
      || visit.rescheduled_from_date !== originalDate
      || scheduledDate !== newDate
      || !['Scheduled', 'Pending'].includes(visit.status)
    ) {
      return json({ error: 'Notification does not match a current successful reschedule' }, 409);
    }
    if (visitType === 'maternal_vaccination' && (!visit.patient_id || visit.newborn_id)) {
      return json({ error: 'The record is not a maternal vaccination' }, 400);
    }

    let patientId = visit.patient_id;
    let babyName = '';
    if (visitType === 'newborn_vaccination') {
      if (!visit.newborn_id) {
        return json({ error: 'The record is not a newborn vaccination' }, 400);
      }
      const { data: newborn, error: newbornError } = await admin
        .from('newborns')
        .select('baby_name, mother_id')
        .eq('id', visit.newborn_id)
        .maybeSingle();
      if (newbornError) throw newbornError;
      if (!newborn?.mother_id) return json({ error: 'The baby’s mother was not found' }, 404);
      patientId = newborn.mother_id;
      babyName = newborn.baby_name || 'your baby';
    }
    if (!patientId) return json({ error: 'The patient for this visit was not found' }, 404);

    const claim = await claimEvent(eventId, visitType, visitId);
    if (claim === 'sent') return json({ emailSent: true, duplicate: true });
    if (claim === 'processing') return json({ emailSent: false, duplicate: true }, 202);

    let patientName = 'there';
    let accountEmail = '';
    let visitLabel = '';
    let appointmentDescription = '';
    let reason = '';
    try {
      const [{ data: patient, error: patientError }, { data: account, error: accountError }] = await Promise.all([
        admin.from('patient_basic_info').select('first_name, last_name').eq('id', patientId).maybeSingle(),
        admin.from('users').select('email_address').eq('id', patientId).maybeSingle(),
      ]);
      if (patientError) throw patientError;
      if (accountError) throw accountError;
      if (!account?.email_address) throw new Error('Patient has no email address on file');

      patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'there';
      visitLabel = visitType === 'prenatal'
        ? 'Prenatal visit'
        : visitType === 'postpartum'
          ? `Postpartum visit${visit.visit_type ? ` (${visit.visit_type})` : ''}`
          : visitType === 'newborn_vaccination'
            ? `${vaccineName(visit.vaccine_inventory)} for ${babyName}`
            : vaccineName(visit.vaccine_inventory);
      appointmentDescription = visitType === 'newborn_vaccination'
        ? `Your baby’s vaccination appointment for ${visitLabel} has been rescheduled.`
        : `Your ${visitLabel} appointment has been rescheduled.`;
      reason = visit.reschedule_reason?.trim()
        ? `<p><strong>Reason:</strong> ${escapeHtml(visit.reschedule_reason)}</p>`
        : '';
      const htmlContent = `
        <h2>Appointment rescheduled, ${escapeHtml(patientName)}</h2>
        <p>${escapeHtml(appointmentDescription)}</p>
        <p><strong>Original date:</strong> ${escapeHtml(formatScheduleDate(originalDate))}<br>
        <strong>New date:</strong> ${escapeHtml(formatScheduleDate(newDate))}</p>
        ${reason}
        <p>Please contact your local health station if you have questions or need assistance.</p>
        <p>With care,<br>DASMOM</p>
      `;
      accountEmail = account.email_address;
      await sendBrevoEmail(accountEmail, 'Your DasMom appointment has been rescheduled', htmlContent);
      emailDelivered = true;
    } catch (error) {
      await updateEventStatus(eventId, 'failed');
      const message = error instanceof Error && error.message === 'Patient has no email address on file'
        ? error.message
        : 'Could not send the rescheduling notification';
      return json({ emailSent: false, error: message });
    }

    await updateEventStatus(eventId, 'sent');
    return json({ emailSent: true });
  } catch (error) {
    console.error('[visit-reschedule-email] request failed');
    if (eventId && !emailDelivered) {
      try {
        await updateEventStatus(eventId, 'failed');
      } catch {
        // The original failure is returned; no patient information is logged.
      }
    }
    return json({ error: 'Could not process the rescheduling notification' }, 500);
  }
});
