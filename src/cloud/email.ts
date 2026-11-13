import { supabase, supabaseUrl } from './supabase';

/** Coach only: emails the client their invite link. Returns an error message or null. */
export async function sendInviteEmail(clientId: string): Promise<string | null> {
  if (!supabase) return 'Cloud is not configured.';
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return 'Sign in again.';
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientId })
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? null : body.error ?? 'Could not send the email. Try again.';
  } catch {
    return 'No connection. Check your internet and try again.';
  }
}
