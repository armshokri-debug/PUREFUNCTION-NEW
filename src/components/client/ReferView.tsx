import React, { useEffect, useState } from 'react';
import { Check, Copy, Gift, Globe2, Share2, Users } from 'lucide-react';
import {
  Redemption,
  Referral,
  STATUS_LABEL,
  availableCredit,
  formatMoney,
  getCreditAmount,
  getMyReferralCode,
  listRedemptions,
  listReferrals,
  referralErrorText,
  referralLink
} from '../../cloud/referrals';

const card = 'bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100';

const STATUS_STYLE: Record<Referral['status'], string> = {
  invited: 'bg-gray-100 text-gray-700',
  signed_up: 'bg-blue-50 text-blue-700',
  paying: 'bg-[#FFC809] text-[#111827]',
  declined: 'bg-gray-100 text-gray-400'
};

export const ReferView: React.FC<{ firstName?: string }> = ({ firstName }) => {
  const [code, setCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [creditPer, setCreditPer] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyReferralCode(), listReferrals(), listRedemptions(), getCreditAmount()])
      .then(([c, refs, reds, amt]) => {
        if (cancelled) return;
        setCode(c);
        setReferrals(refs);
        setRedemptions(reds);
        setCreditPer(amt);
      })
      .catch((e) => !cancelled && setError(referralErrorText(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const link = code ? referralLink(code) : '';
  const credit = availableCredit(referrals, redemptions);
  const earned = referrals.filter((r) => r.status === 'paying').length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy your invite link:', link);
    }
  };

  const share = async () => {
    const text = `${firstName ? `${firstName} here — ` : ''}I train with Pure Function and love it. Remote coaching from anywhere: a personal program updated every month and a monthly check-in.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Train with Pure Function', text, url: link });
        return;
      } catch {
        /* cancelled: fall back to copy */
      }
    }
    copy();
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">
      <div>
        <span className="text-xs font-semibold text-gray-500">Invite friends from anywhere</span>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827] mt-0.5">Refer</h1>
      </div>

      {/* Credit */}
      <div className="bg-[#111827] text-white rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-gray-400">Available credit</div>
          <div className="text-3xl font-bold tabular-nums mt-1">{loading ? '…' : formatMoney(credit)}</div>
          <div className="text-xs text-gray-400 mt-1">
            {earned} paying {earned === 1 ? 'member' : 'members'} referred · use it toward your own purchases
          </div>
        </div>
        <Gift className="w-10 h-10 text-[#FFC809] shrink-0" />
      </div>

      {/* Invite */}
      <div className={card}>
        <h2 className="text-sm font-bold text-[#111827]">Your invite link</h2>
        {error ? (
          <p className="text-sm text-gray-500 mt-2">{error}</p>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-2">
              <input
                readOnly
                value={loading ? 'Loading…' : link}
                aria-label="Invite link"
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-700"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                onClick={copy}
                disabled={!code}
                aria-label="Copy link"
                className="p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={share}
              disabled={!code}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-[#FFC809] text-[#111827] font-semibold text-sm py-3 rounded-xl disabled:opacity-40 cursor-pointer"
            >
              <Share2 className="w-4 h-4" /> Share invite
            </button>
          </>
        )}
        <p className="text-xs text-gray-500 mt-3">
          When someone you invite becomes a paying member, you earn{' '}
          {creditPer ? <b>{formatMoney(creditPer)}</b> : 'credit'} to use toward your own purchases.
        </p>
      </div>

      {/* Remote program */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-[#111827]" />
          <h2 className="text-sm font-bold text-[#111827]">What remote members get</h2>
        </div>
        <ul className="mt-3 space-y-2.5 text-sm text-gray-700">
          {[
            'One or two initial virtual sessions to understand their movement, body, and goals',
            'A personalized program, updated month by month',
            'One virtual check-in each month to review progress and adjust the program'
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#FFC809] shrink-0" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Referral status */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#111827]" />
          <h2 className="text-sm font-bold text-[#111827]">Your referrals</h2>
        </div>
        {!loading && referrals.length === 0 && (
          <p className="text-sm text-gray-500 mt-3">No one yet. Share your link and their status shows up here.</p>
        )}
        <ul className="mt-2 divide-y divide-gray-100">
          {referrals.map((r) => (
            <li key={r.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#111827] truncate">{r.name}</div>
                <div className="text-xs text-gray-500">
                  {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
                {r.status === 'paying' && r.credit > 0 && (
                  <div className="text-xs font-semibold text-[#111827] mt-1 tabular-nums">+{formatMoney(r.credit)}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
        {redemptions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
            {redemptions.map((r) => (
              <div key={r.id} className="flex justify-between tabular-nums">
                <span>Credit used{r.note ? ` · ${r.note}` : ''}</span>
                <span>−{formatMoney(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
