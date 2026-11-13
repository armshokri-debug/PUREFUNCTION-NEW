// Pure Function 2 sign-up (deployed as Edge Function "sign-up", verify_jwt = false).
// Only the coach's email, or an email the coach already added to a client,
// can create an account. Accounts are created already confirmed, so no
// confirmation email is needed (Supabase's built-in mailer only reaches
// team members). The app signs in right after with the same password.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid request' });
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const name = String(body.name ?? '').trim().slice(0, 80);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json(400, { error: 'Enter a valid email address.' });
  }
  if (password.length < 8 || password.length > 72) {
    return json(400, { error: 'Password must be at least 8 characters.' });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: role, error: roleError } = await admin.rpc('signup_role', { p_email: email });
  if (roleError) return json(500, { error: 'Could not check this email. Try again.' });
  if (!role) {
    return json(403, {
      error: 'This email isn’t on the list yet. Ask your coach to add your email first, then create your account.'
    });
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name }
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return json(409, { error: 'An account with this email already exists. Sign in instead.' });
    }
    return json(400, { error: error.message });
  }
  return json(200, { ok: true, role });
});
