// Shared by the email Edge Functions. Sends through Resend (https://resend.com).
// Secrets: RESEND_API_KEY (required), EMAIL_FROM (optional, needs a verified domain),
// APP_URL (optional).
export const APP_URL = Deno.env.get('APP_URL') ?? 'https://audiovido.github.io/Purefunction-2/';
const FROM = Deno.env.get('EMAIL_FROM') ?? 'Pure Function <onboarding@resend.dev>';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Simple branded email: heading, paragraphs, one button. */
export function layout(heading: string, paragraphs: string[], button?: { text: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#F7F8FA;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="font-weight:700;font-size:17px;margin-bottom:20px">Pure Function</div>
    <div style="background:#fff;border:1px solid #F3F4F6;border-radius:20px;padding:28px">
      <h1 style="font-size:22px;margin:0 0 12px">${esc(heading)}</h1>
      ${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.55;color:#374151;margin:0 0 12px">${esc(p)}</p>`).join('')}
      ${button ? `<a href="${esc(button.url)}" style="display:inline-block;margin-top:8px;background:#111827;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:12px">${esc(button.text)}</a>` : ''}
    </div>
    <p style="font-size:12px;color:#9CA3AF;margin-top:16px">Sent by your coach’s Pure Function app.</p>
  </div></body></html>`;
}

export type SendResult = { ok: true } | { ok: false; error: string; status: number };

export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { ok: false, status: 503, error: 'Email is not set up yet (RESEND_API_KEY missing).' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html })
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  const msg = String((body as { message?: string }).message ?? res.statusText);
  if (/testing emails|verify a domain|own email address/i.test(msg)) {
    return {
      ok: false,
      status: 403,
      error: 'Email works only to your own address until a domain is verified in Resend.'
    };
  }
  return { ok: false, status: 502, error: `Email service error: ${msg}` };
}
