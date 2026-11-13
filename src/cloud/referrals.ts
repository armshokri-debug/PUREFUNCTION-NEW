import { supabase } from './supabase';

export type ReferralStatus = 'invited' | 'signed_up' | 'paying' | 'declined';

export interface Referral {
  id: string;
  referrerClientId: string;
  name: string;
  email: string;
  location: string;
  note: string;
  status: ReferralStatus;
  credit: number;
  createdAt: string;
}

export interface Redemption {
  id: string;
  clientId: string;
  amount: number;
  note: string;
  createdAt: string;
}

export const STATUS_LABEL: Record<ReferralStatus, string> = {
  invited: 'Invited',
  signed_up: 'Signed up',
  paying: 'Paying member · credit earned',
  declined: 'Not joining'
};

/** Credit the client can still spend: earned minus redeemed, never below zero. */
export function availableCredit(referrals: Referral[], redemptions: Redemption[]): number {
  const earned = referrals.reduce((s, r) => s + (r.status === 'paying' ? r.credit : 0), 0);
  const used = redemptions.reduce((s, r) => s + r.amount, 0);
  return Math.max(0, Math.round((earned - used) * 100) / 100);
}

export function formatMoney(n: number): string {
  return `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
}

/** The referral link for a code: the app's own address + ?ref=CODE. */
export function referralLink(code: string): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return `${base}?ref=${encodeURIComponent(code)}`;
}

/** ?ref=CODE from the current address, if any. */
export function refCodeFromUrl(): string | null {
  try {
    const c = new URLSearchParams(window.location.search).get('ref');
    return c && /^[a-z0-9]{4,32}$/i.test(c) ? c.toLowerCase() : null;
  } catch {
    return null;
  }
}

type Row = Record<string, unknown>;
const toReferral = (r: Row): Referral => ({
  id: String(r.id),
  referrerClientId: String(r.referrer_client_id),
  name: String(r.name ?? ''),
  email: String(r.email ?? ''),
  location: String(r.location ?? ''),
  note: String(r.note ?? ''),
  status: r.status as ReferralStatus,
  credit: Number(r.credit ?? 0),
  createdAt: String(r.created_at)
});
const toRedemption = (r: Row): Redemption => ({
  id: String(r.id),
  clientId: String(r.client_id),
  amount: Number(r.amount ?? 0),
  note: String(r.note ?? ''),
  createdAt: String(r.created_at)
});

function need() {
  if (!supabase) throw new Error('Referrals need the cloud version of the app.');
  return supabase;
}

export async function getMyReferralCode(): Promise<string> {
  const { data, error } = await need().rpc('my_referral_code');
  if (error) throw error;
  if (!data) throw new Error('No client profile linked to this account yet.');
  return String(data);
}

export async function getCreditAmount(): Promise<number> {
  const { data, error } = await need().rpc('referral_credit_amount');
  if (error) throw error;
  return Number(data ?? 0);
}

/** RLS limits a client to their own rows; the coach gets everyone's. */
export async function listReferrals(): Promise<Referral[]> {
  const { data, error } = await need().from('referrals').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toReferral);
}

export async function listRedemptions(): Promise<Redemption[]> {
  const { data, error } = await need().from('credit_redemptions').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toRedemption);
}

export async function getInviterName(code: string): Promise<string | null> {
  const { data, error } = await need().rpc('referral_inviter', { p_code: code });
  if (error) throw error;
  return data ? String(data) : null;
}

export async function submitReferral(input: { code: string; name: string; email: string; location: string; note: string }) {
  const { error } = await need().rpc('submit_referral', {
    p_code: input.code,
    p_name: input.name,
    p_email: input.email,
    p_location: input.location,
    p_note: input.note
  });
  if (error) throw error;
}

export async function setReferralStatus(id: string, status: ReferralStatus) {
  const { error } = await need().rpc('set_referral_status', { p_id: id, p_status: status });
  if (error) throw error;
}

export async function addRedemption(clientId: string, amount: number, note: string) {
  const { error } = await need().from('credit_redemptions').insert({ client_id: clientId, amount, note });
  if (error) throw error;
}

/** Friendly text for any error (also when the referral tables aren't set up yet). */
export function referralErrorText(e: unknown): string {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/does not exist|schema cache|Could not find/i.test(msg)) return 'Referrals are being set up. Please check back soon.';
  return msg || 'Something went wrong. Please try again.';
}
