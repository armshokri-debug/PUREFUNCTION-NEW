// Coach-only: email a client their invite link (verify_jwt = true).
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { APP_URL, cors, json, layout, sendEmail } from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // who is calling?
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData } = await admin.auth.getUser(token);
  const uid = userData.user?.id;
  if (!uid) return json(401, { error: 'Sign in again.' });
  const { data: me } = await admin.from('profiles').select('role, display_name').eq('id', uid).maybeSingle();
  if (me?.role !== 'coach') return json(403, { error: 'Only the coach can send invites.' });

  const { clientId } = await req.json().catch(() => ({}));
  const { data: client } = await admin.from('clients').select('id, email, data').eq('id', String(clientId ?? '')).maybeSingle();
  if (!client?.email) return json(400, { error: 'This client has no email yet.' });

  const name = String(client.data?.name ?? '').split(' ')[0] || 'there';
  const coach = me.display_name || 'Your coach';
  const link = `${APP_URL}?join=${encodeURIComponent(client.email)}`;
  const r = await sendEmail(
    client.email,
    `${coach} invited you to Pure Function`,
    layout(
      `Hi ${name}, your training is ready`,
      [
        `${coach} set up your program in Pure Function.`,
        `Tap the button, choose a password, and you’ll see your workouts. Your email (${client.email}) is already filled in.`
      ],
      { text: 'Set up my account', url: link }
    )
  );
  return r.ok ? json(200, { ok: true }) : json(r.status, { error: r.error });
});
