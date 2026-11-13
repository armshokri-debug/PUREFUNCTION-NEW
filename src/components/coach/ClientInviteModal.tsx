import React, { useState } from 'react';
import { Check, Copy, X, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { ClientProfile } from '../../types';
import { isCloud } from '../../cloud/supabase';
import { sendInviteEmail } from '../../cloud/email';

export function inviteLink(email: string): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
  return `${base}?join=${encodeURIComponent(email)}`;
}

/** Edit a client's name/email and share their invite (like TrueCoach's "Invite client"). */
export const ClientInviteModal: React.FC<{
  client: ClientProfile;
  clients: ClientProfile[];
  joined: boolean | null;
  onSave: (updated: ClientProfile) => void;
  onClose: () => void;
}> = ({ client, clients, joined, onSave, onClose }) => {
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'message' | null>(null);
  const [mailing, setMailing] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [reminders, setReminders] = useState(client.emailReminders !== false);

  const cleanEmail = email.trim().toLowerCase();
  const link = inviteLink(cleanEmail);
  const message = `Hi ${name.split(' ')[0] || ''}! I've set up your training in Pure Function.\n1. Open: ${link}\n2. Tap "Set up your account" and choose a password (your email ${cleanEmail} is already filled in).\nAfter that, sign in any time as a client to see your workouts.`;

  const save = () => {
    if (!name.trim()) return setError('Enter a name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setError('Enter a valid email.');
    if (clients.some((c) => c.id !== client.id && (c.email ?? '').toLowerCase() === cleanEmail)) {
      return setError('Another client already uses this email.');
    }
    onSave({ ...client, name: name.trim(), email: cleanEmail, emailReminders: reminders });
    onClose();
  };

  const emailInvite = async () => {
    if (cleanEmail !== client.email) return setError('Save the new email first, then send.');
    setError(null);
    setMailing('sending');
    const err = await sendInviteEmail(client.id);
    if (err) {
      setMailing('idle');
      setError(err);
    } else setMailing('sent');
  };

  const copy = async (what: 'link' | 'message') => {
    try {
      await navigator.clipboard.writeText(what === 'link' ? link : message);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Copy failed — select the text and copy it manually.');
    }
  };

  const field =
    'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-[#111827] focus:outline-none focus:border-[#111827]';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-xl max-h-[92dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#111827]">Client & invite</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-[#111827] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {joined !== null && (
          <div
            className={`mb-4 text-sm rounded-xl px-3 py-2.5 ${
              joined ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEF3C7] text-[#92400E]'
            }`}
          >
            {joined
              ? 'Account active — this client has signed up.'
              : 'Not joined yet — send them the invite below.'}
          </div>
        )}

        <label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} mb-3`} />
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Email (they sign in with this)</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        {joined && cleanEmail !== client.email && (
          <p className="text-xs text-[#92400E] mt-1.5">
            They already have an account with the old email; changing it here doesn’t change their login.
          </p>
        )}

        {isCloud && (
          <label className="mt-4 flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm text-[#111827]">
              Morning email on workout days
              <span className="block text-xs text-gray-500">A short reminder with today’s workout.</span>
            </span>
            <input
              type="checkbox"
              checked={reminders}
              onChange={(e) => setReminders(e.target.checked)}
              aria-label="Morning email on workout days"
              className="w-5 h-5 accent-[#111827] shrink-0"
            />
          </label>
        )}

        <div className="mt-5 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
          {isCloud && !joined && (
            <button
              onClick={() => void emailInvite()}
              disabled={mailing === 'sending'}
              className="w-full mb-3 inline-flex items-center justify-center gap-2 bg-[#111827] text-white text-sm font-semibold py-3 rounded-xl cursor-pointer disabled:opacity-60"
            >
              {mailing === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : mailing === 'sent' ? <Check className="w-4 h-4 text-[#FFC809]" /> : <Mail className="w-4 h-4 text-[#FFC809]" />}
              {mailing === 'sent' ? `Invite sent to ${client.email}` : 'Email the invite'}
            </button>
          )}
          <div className="text-xs font-semibold text-[#111827] mb-1">{isCloud && !joined ? '…or share the link yourself' : 'Invite link'}</div>
          <div className="text-xs text-gray-600 break-all mb-3">{link}</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void copy('link')}
              className="inline-flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-sm font-semibold py-2.5 rounded-xl cursor-pointer"
            >
              {copied === 'link' ? <Check className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
            <button
              onClick={() => void copy('message')}
              className="inline-flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-sm font-semibold py-2.5 rounded-xl cursor-pointer"
            >
              {copied === 'message' ? <Check className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
              {copied === 'message' ? 'Copied' : 'Copy message'}
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">Save first if you changed the email, then copy.</p>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-500 cursor-pointer">
            Cancel
          </button>
          <button onClick={save} className="bg-[#111827] text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
