import React, { useEffect, useState } from 'react';
import { supabase } from '../../cloud/supabase';

/** Existing head-coach API; ownership remains automatic and cannot be transferred. */
export function CoachAccounts() {
  const [allowed, setAllowed] = useState(false);
  const [coaches, setCoaches] = useState<{ email: string; display_name: string; verified: boolean }[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    if (supabase) void supabase.rpc('pf_head_coach').then(async ({ data, error }) => {
      if (!active || error || data !== true) return;
      setAllowed(true);
      const result = await supabase!.rpc('pf_list_trainers');
      if (active) { if (result.error) setMessage('Could not load coach accounts.'); else setCoaches(result.data ?? []); }
    });
    return () => { active = false; };
  }, []);
  if (!supabase || !allowed) return null;
  return <section className="bg-white rounded-[28px] border border-gray-100 p-4 sm:p-6 mt-6 min-w-0">
    <h2 className="font-bold mb-2">Coach accounts</h2>
    <p className="text-sm text-gray-500 mb-3">Each verified coach has an independent roster. New clients belong to the coach who creates them.</p>
    <ul className="space-y-2 text-sm">{coaches.map((coach) => <li key={coach.email} className="break-all">{coach.display_name || coach.email} · {coach.verified ? 'Verified' : 'Awaiting verification'}</li>)}</ul>
    <form className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 mt-4" onSubmit={async (event) => {
      event.preventDefault(); if (busy) return; setBusy(true); setMessage('');
      try {
        const grant = await supabase!.rpc('pf_manage_trainer', { p_action: 'invite', p_email: email.trim(), p_client_id: null });
        if (grant.error) throw grant.error;
        const sent = await supabase!.functions.invoke('invite-trainer', { body: { email: email.trim() } });
        if (sent.error) { setMessage('Coach is allowed, but the invitation email was not confirmed. They can create an account using this email.'); }
        else { setMessage('Coach allowed and invitation sent. Email verification is required.'); setEmail(''); }
        const list = await supabase!.rpc('pf_list_trainers'); if (!list.error) setCoaches(list.data ?? []);
      } catch { setMessage('Coach invitation could not be completed.'); }
      finally { setBusy(false); }
    }}>
      <input aria-label="Coach email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 w-full border rounded-xl p-3 text-base" />
      <button disabled={busy} className="min-h-[44px] rounded-xl bg-[#111827] text-white px-4 disabled:opacity-40">Invite coach</button>
    </form>
    {message && <p role="status" className="text-sm mt-3 break-words">{message}</p>}
  </section>;
}
