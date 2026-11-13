import { describe, expect, it } from 'vitest';
import { availableCredit, formatMoney, Referral, Redemption } from '../../cloud/referrals';

const ref = (status: Referral['status'], credit: number): Referral => ({
  id: Math.random().toString(),
  referrerClientId: 'c1',
  name: 'A',
  email: 'a@b.co',
  location: '',
  note: '',
  status,
  credit,
  createdAt: '2026-11-01'
});
const red = (amount: number): Redemption => ({ id: 'r', clientId: 'c1', amount, note: '', createdAt: '2026-11-01' });

describe('availableCredit', () => {
  it('counts only paying referrals', () => {
    expect(availableCredit([ref('paying', 50), ref('invited', 50), ref('signed_up', 50)], [])).toBe(50);
  });
  it('subtracts redemptions and never goes negative', () => {
    expect(availableCredit([ref('paying', 50), ref('paying', 50)], [red(30)])).toBe(70);
    expect(availableCredit([ref('paying', 50)], [red(80)])).toBe(0);
  });
});

describe('formatMoney', () => {
  it('drops cents on whole amounts', () => {
    expect(formatMoney(50)).toBe('$50');
    expect(formatMoney(12.5)).toBe('$12.50');
  });
});
