import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Cloud mode only when both values are set (production build). Otherwise the app runs as a local demo. */
export const isCloud = Boolean(url && key);
export const supabaseUrl = url ?? '';

export const supabase: SupabaseClient | null = isCloud
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

/** JSON with sorted keys, so the same data always compares equal (jsonb reorders keys). */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}
