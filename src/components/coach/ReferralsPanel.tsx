import React, { useCallback, useEffect, useState } from 'react';
import { Gift, ChevronDown } from 'lucide-react';
import { ClientProfile } from '../../types';
import {
  Redemption,
  Referral,
  ReferralStatus,
  STATUS_LABEL,
  addRedemption,
  availableCredit,
  formatMoney,
  listRedemptions,
  listReferrals,
  referralErrorText,
  setReferralStatus
} from '../../cloud/referrals';

/** Coach: see referral leads, mark them paying (earns credit), record credit used. */
export const ReferralsPanel: React.FC<{ clients: ClientProfile[] }> = ({ clients }) => {
  const [open, setOpen] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([listReferrals(), listRedemptions()])
      .then(([a, b]) => {
        setReferrals(a);
        setRedemptions(b);
        setError(null);
      })
      .catch((e) => setError(referralErrorText(e)));
  }, []);
  useEffect(load, [load]);

  const nameOf = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Client';
  const fresh = referrals.filter((r) => r.status === 'invited').length;

  const change = async (id: string, s: ReferralStatus) => {
    try {
      await setReferralStatus(id, s);
      load();
    } catch (e) {
      setError(referralErrorText(e));
    }
  };

  const useCredit = async (clientId: string, max: number) => {
    const raw = window.prompt(`Credit to apply for ${nameOf(clientId)} (available ${formatMoney(max)}):`);
    const amount = Number(raw);
    if (!raw || !Number.isFinite(amount) || amount <= 0) return;
    if (amount > max) return setError(`Only ${formatMoney(max)} available.`);
    try {
      await addRedemption(clientId, amount, 'Applied by coach');
      load();
    } catch (e) {
      setError(referralErrorText(e));
    }
  };

  const referrers = Array.from(new Set(referrals.map((r) => r.referrerClientId)));

  return (
    <section className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)]">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 sm:p-5 cursor-pointer">
        <span className="flex items-center gap-2 text-sm font-bold text-[#111827]">
          <Gift className="w-4 h-4" /> Referrals
          {fresh > 0 && <span className="bg-[#FFC809] text-[#111827] text-[11px] px-2 py-0.5 rounded-full">{fresh} new</span>}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-5 space-y-4">
          {error && <p className="text-sm text-gray-500">{error}</p>}
          {!error && referrals.length === 0 && <p className="text-sm text-gray-500">No referrals yet.</p>}
          <p className="text-xs text-gray-500">
            New lead → email them and add them as a client (status becomes “Signed up” automatically when the email matches) → mark
            “Paying” to give the referrer credit.
          </p>
          <ul className="divide-y divide-gray-100">
            {referrals.map((r) => (
              <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                <div className="min-w-0 text-sm">
                  <div className="font-semibold text-[#111827]">
                    {r.name} <span className="font-normal text-gray-500">· {r.email}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Invited by {nameOf(r.referrerClientId)}
                    {r.location ? ` · ${r.location}` : ''}
                    {r.note ? ` · “${r.note}”` : ''}
                  </div>
                </div>
                <select
                  value={r.status}
                  onChange={(e) => change(r.id, e.target.value as ReferralStatus)}
                  aria-label={`Status for ${r.name}`}
                  className="border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-sm shrink-0"
                >
                  {(Object.keys(STATUS_LABEL) as ReferralStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {referrers.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-600 mb-2">Credit by client</h3>
              {referrers.map((id) => {
                const avail = availableCredit(
                  referrals.filter((r) => r.referrerClientId === id),
                  redemptions.filter((r) => r.clientId === id)
                );
                return (
                  <div key={id} className="flex items-center justify-between py-1.5 text-sm">
                    <span>{nameOf(id)}</span>
                    <span className="flex items-center gap-3 tabular-nums">
                      {formatMoney(avail)}
                      <button
                        disabled={avail <= 0}
                        onClick={() => useCredit(id, avail)}
                        className="text-xs font-semibold underline disabled:opacity-30 cursor-pointer"
                      >
                        Apply credit
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
