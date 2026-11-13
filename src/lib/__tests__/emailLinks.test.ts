import { describe, expect, it } from 'vitest';
import { resolveAppUrl } from '../../../supabase/functions/_shared/app-url';

describe('recovered email links', () => {
  it('points missing and retired production settings at the recovered app', () => {
    const current = 'https://armshokri-debug.github.io/PUREFUNCTION-NEW/';
    expect(resolveAppUrl()).toBe(current);
    expect(resolveAppUrl('https://audiovido.github.io/Purefunction-2/')).toBe(current);
    expect(resolveAppUrl('https://audiovido.github.io/Purefunction-2')).toBe(current);
  });
  it('preserves explicitly configured staging URLs and query token handling', () => {
    expect(resolveAppUrl('https://staging.example.com/')).toBe('https://staging.example.com/');
    const url = new URL(resolveAppUrl()); url.searchParams.set('verify', 'test-token');
    expect(url.pathname).toBe('/PUREFUNCTION-NEW/');
    expect(url.searchParams.get('verify')).toBe('test-token');
  });
});
