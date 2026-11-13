// Morning email to each client who has a workout today (coach's time zone).
// Called by pg_cron with the x-cron-secret header (verify_jwt = false).
// Skips: no account yet, workout already done, reminders turned off for the client.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { APP_URL, cors, json, layout, sendEmail } from '../_shared/email.ts';

const TZ = Deno.env.get('COACH_TIMEZONE') ?? 'America/New_York';

function todayIn(tz: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p; // YYYY-MM-DD
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false }
  });
  // secret is kept in Vault (see migration daily_reminders_cron)
  const given = req.headers.get('x-cron-secret') ?? '';
  const { data: ok } = given ? await admin.rpc('cron_secret_ok', { s: given }) : { data: false };
  if (ok !== true) return json(401, { error: 'unauthorized' });
  const today = todayIn(TZ);
  const { data: rows } = await admin.from('workouts').select('client_id, data').eq('date', today);
  const { data: joined } = await admin.from('profiles').select('client_id').eq('role', 'client');
  const joinedIds = new Set((joined ?? []).map((p) => p.client_id));

  const results: { client: string; status: string }[] = [];
  for (const w of rows ?? []) {
    const wo = w.data as { title?: string; status?: string; blocks?: { name: string }[] };
    if (!joinedIds.has(w.client_id)) { results.push({ client: w.client_id, status: 'skip: no account' }); continue; }
    if (wo.status === 'completed') { results.push({ client: w.client_id, status: 'skip: done' }); continue; }
    if (!wo.blocks?.length) { results.push({ client: w.client_id, status: 'skip: empty' }); continue; }
    const { data: c } = await admin.from('clients').select('email, data').eq('id', w.client_id).maybeSingle();
    if (!c?.email || c.data?.emailReminders === false) { results.push({ client: w.client_id, status: 'skip: off' }); continue; }
    if (dry) { results.push({ client: w.client_id, status: 'would send' }); continue; }
    const name = String(c.data?.name ?? '').split(' ')[0] || 'there';
    const list = wo.blocks.slice(0, 8).map((b) => `• ${b.name}`).join('  ');
    const r = await sendEmail(
      c.email,
      `Today: ${wo.title || 'your workout'}`,
      layout(`Good morning ${name}`, [`Today’s workout: ${wo.title || 'Workout'} (${wo.blocks.length} exercises).`, list], { text: 'Open today’s workout', url: APP_URL })
    );
    results.push({ client: w.client_id, status: r.ok ? 'sent' : `error: ${r.error}` });
  }
  return json(200, { today, timezone: TZ, results });
});
