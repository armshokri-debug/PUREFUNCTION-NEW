// Forgot password (verify_jwt = false). Emails a one-time link back to the app;
// the app verifies it and lets the user choose a new password. Always answers
// the same way so it never reveals which emails have accounts.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { APP_URL, cors, json, layout, sendEmail } from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  const { email } = await req.json().catch(() => ({}));
  const addr = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr) || addr.length > 254) return json(400, { error: 'Enter a valid email address.' });

  // Public replies stay identical for valid addresses. Operational logs contain
  // only fixed reason codes: never email addresses, recovery links/tokens or keys.
  const report = (reason: string, status?: number) => console.warn(JSON.stringify({
    event: 'password_recovery_failed', reason, ...(status === undefined ? {} : { status })
  }));
  try {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false }
  });
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: addr });
  if (!error && data?.properties?.hashed_token) {
    const link = new URL(APP_URL);
    link.searchParams.set('reset', data.properties.hashed_token);
    const r = await sendEmail(
      addr,
      'Reset your Pure Function password',
      layout('Reset your password', ['Tap the button to choose a new password. The link works once and expires in 1 hour.', 'If you didn’t ask for this, ignore this email.'], {
        text: 'Choose a new password',
        url: link.toString()
      })
    );
    if (!r.ok) {
      const reason = /only to your own address|verify.*domain/i.test(r.error)
        ? 'test_sender_restricted'
        : /RESEND_API_KEY missing/.test(r.error) ? 'mail_not_configured' : 'provider_rejected';
      report(reason, r.status);
    } else console.info(JSON.stringify({ event: 'password_recovery_mail_accepted' }));
  } else report('link_generation_failed');
  } catch {
    report('request_failed');
  }
  return json(200, { ok: true });
});
