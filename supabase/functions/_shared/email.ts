export const APP_URL = Deno.env.get('DASMOM_APP_URL') || 'https://dasmom.vercel.app/';

const brevoApiKey = Deno.env.get('BREVO_API_KEY');
const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL');
const senderName = Deno.env.get('BREVO_SENDER_NAME') || 'DASMOM';

export const DUPLICATE_EMAIL_MESSAGE = 'Email already exists. Please use a different email address.';

export function isDuplicateEmailError(error: unknown) {
  const candidate = error as { status?: number; code?: string; message?: string };
  const message = String(candidate?.message || '').toLowerCase();
  return candidate?.code === 'email_exists'
    || candidate?.code === 'user_already_exists'
    || message.includes('already registered')
    || message.includes('already exists')
    || (message.includes('email') && message.includes('exist'));
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')   
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export async function sendBrevoEmail(to: string, subject: string, htmlContent: string) {
  if (!brevoApiKey || !senderEmail) {
    throw new Error('BREVO_API_KEY and BREVO_SENDER_EMAIL must be configured');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': brevoApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  if (!response.ok) {
    throw new Error(`Brevo returned ${response.status}: ${await response.text()}`);
  }
}

export function accountEmail({
  name,
  email,
  role,
  station,
  password,
  accountType,
}: {
  name: string;
  email: string;
  role: string;
  station?: string;
  password?: string;
  accountType: 'staff' | 'mother';
}) {
  const stationBlock = accountType === 'staff'
    ? `<p><strong>Assigned station:</strong> ${escapeHtml(station || 'Not assigned')}</p>`
    : '';
  const passwordBlock = password
    ? `<p><strong>Initial password:</strong> ${escapeHtml(password)}</p><p>Please change it after signing in.</p>`
    : '';

  return `<h2>Welcome to DASMOM, ${escapeHtml(name)}!</h2><p>Your ${accountType} account was created by an authorized DasMom administrator.</p><p><strong>Registered email:</strong> ${escapeHtml(email)}<br><strong>Account role:</strong> ${escapeHtml(role)}</p>${stationBlock}${passwordBlock}<p><strong>Login methods:</strong> use your DasMom email and initial password, or choose Sign in with Google using this same registered email address.</p><p><a href="${escapeHtml(APP_URL)}">Open DASMOM</a></p><p>Forgot your password? Use the Forgot password link on the login page to receive a secure reset email.</p>`;
}

export { escapeHtml };
