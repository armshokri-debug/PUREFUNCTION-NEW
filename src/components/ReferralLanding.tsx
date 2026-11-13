import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { getInviterName, referralErrorText, submitReferral } from '../cloud/referrals';

/** Shown to someone who opens an invite link (?ref=CODE) and is not signed in. */
export const ReferralLanding: React.FC<{ code: string; onSignIn: () => void }> = ({ code, onSignIn }) => {
  const [inviter, setInviter] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', location: '', note: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInviterName(code).then(setInviter).catch(() => setInviter(null));
  }, [code]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setState('sending');
    try {
      await submitReferral({ code, ...form });
      setState('done');
    } catch (err) {
      setError(referralErrorText(err));
      setState('idle');
    }
  };

  const input = 'w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm bg-white focus:outline-none focus:border-[#111827]';

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-6 sm:p-8">
        <div className="text-xs font-semibold text-gray-500">Pure Function · Remote coaching</div>
        {state === 'done' ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <h1 className="text-xl font-bold text-[#111827] mt-4">Thanks, we got it!</h1>
            <p className="text-sm text-gray-600 mt-2">Your coach will email you to set up your first virtual session.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827] mt-1">
              {inviter ? `${inviter} invited you to train` : 'You’re invited to train'}
            </h1>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li>• 1–2 initial virtual sessions to understand your movement, body, and goals</li>
              <li>• A personalized program, updated month by month</li>
              <li>• One virtual check-in each month to review progress</li>
            </ul>
            <form onSubmit={send} className="mt-6 space-y-3">
              <input required maxLength={120} placeholder="Your name" className={input} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input required type="email" maxLength={200} placeholder="Email" className={input} value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input maxLength={120} placeholder="City / country" className={input} value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <textarea maxLength={1000} rows={3} placeholder="Your goals (optional)" className={input} value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={state === 'sending'}
                className="w-full bg-[#111827] text-white font-semibold text-sm py-3 rounded-xl disabled:opacity-50 cursor-pointer">
                {state === 'sending' ? 'Sending…' : 'I’m interested'}
              </button>
            </form>
          </>
        )}
        <button onClick={onSignIn} className="mt-5 w-full text-xs text-gray-500 hover:text-[#111827] cursor-pointer">
          Already a member? Sign in
        </button>
      </div>
    </div>
  );
};
