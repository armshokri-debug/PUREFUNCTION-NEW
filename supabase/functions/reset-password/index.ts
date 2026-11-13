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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return json(400, { error: 'Enter a valid email address.' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false }
  });
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: addr });
  if (!error && data?.properties?.hashed_token) {
    const link = `${APP_URL}?reset=${encodeURIComponent(data.properties.hashed_token)}`;
    const r = await sendEmail(
      addr,
      'Reset your Pure Function password',
      layout('Reset your password', ['Tap the button to choose a new password. The link works once and expires in 1 hour.', 'If you didn’t ask for this, ignore this email.'], {
        text: 'Choose a new password',
        url: link
      })
    );
    if (!r.ok && r.status === 503) return json(503, { error: r.error });
  }
  return json(200, { ok: true });
});
