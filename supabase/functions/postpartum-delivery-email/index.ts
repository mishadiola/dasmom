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
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!admin) throw new Error('Missing Supabase Edge Function environment variables');

    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Authentication required' }, 401);

    const { data: authResult, error: authError } = await admin.auth.getUser(token);
    const authUser = authResult?.user;
    if (authError || !authUser?.id) return json({ error: 'Authentication required' }, 401);

    const { data: userRow, error: userError } = await admin
      .from('users')
      .select('usertype')
      .eq('id', authUser.id)
      .maybeSingle();
    if (userError) throw userError;
    if (!userRow?.usertype) return json({ error: 'Staff account required' }, 403);

    const { data: typeRow, error: typeError } = await admin
      .from('user_type')
      .select('user_type')
      .eq('id', userRow.usertype)
      .maybeSingle();
    if (typeError) throw typeError;

    const role = normalizeRole(typeRow?.user_type);
    if (!['admin', 'cho personnel', 'staff'].includes(role)) {
      return json({ error: 'Only authorized staff can process delivery notifications' }, 403);
    }

    const body = await request.json();
    const deliveryId = String(body?.delivery_id || '').trim();
    if (!deliveryId) return json({ error: 'delivery_id is required' }, 400);

    const { data: delivery, error: deliveryError } = await admin
      .from('deliveries')
      .select('id, mother_id, delivery_date, delivery_time, station_ass')
      .eq('id', deliveryId)
      .maybeSingle();
    if (deliveryError) throw deliveryError;
    if (!delivery) return json({ error: 'Delivery not found' }, 404);

    if (role !== 'admin') {
      const { data: profile, error: profileError } = await admin
        .from('staff_profiles')
        .select('station_ass')
        .eq('id', authUser.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.station_ass || profile.station_ass !== delivery.station_ass) {
        return json({ error: 'You are not authorized to process this delivery' }, 403);
      }
    }

    const { data: visitRows, error: visitsError } = await admin
      .from('postpartum_visits')
      .select('visit_type, scheduled_at')
      .eq('delivery_id', delivery.id)
      .order('scheduled_at', { ascending: true });
    if (visitsError) throw visitsError;
    if (!visitRows?.length) {
      return json({ error: 'Postpartum schedule was not created for this delivery' }, 500);
    }

    const { data: mother, error: motherError } = await admin
      .from('patient_basic_info')
      .select('first_name, last_name')
      .eq('id', delivery.mother_id)
      .maybeSingle();
    if (motherError) throw motherError;

    const { data: account, error: accountError } = await admin
      .from('users')
      .select('email_address')
      .eq('id', delivery.mother_id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account?.email_address) {
      return json({ emailSent: false, error: 'Mother has no email address on file' }, 422);
    }

    const motherName = `${mother?.first_name || ''} ${mother?.last_name || ''}`.trim() || 'there';
    const scheduleItems = visitRows.map(visit =>
      `<li><strong>${escapeHtml(visit.visit_type)}</strong>: ${escapeHtml(formatScheduleDate(visit.scheduled_at))}</li>`
    ).join('');
    const htmlContent = `
      <h2>Congratulations, ${escapeHtml(motherName)}!</h2>
      <p>We are happy to welcome your baby. Please keep these postpartum follow-up appointments so your care team can check on your recovery:</p>
      <ul>${scheduleItems}</ul>
      <p>If you need help or cannot attend an appointment, please contact your health station.</p>
      <p>With care,<br>DASMOM</p>
    `;

    await sendBrevoEmail(
      account.email_address,
      'Congratulations on your new baby — your postpartum schedule',
      htmlContent,
    );

    return json({ emailSent: true, visitCount: visitRows.length });
  } catch (error) {
    console.error('[postpartum-delivery-email] request failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Request failed' }, 500);
  }
});
