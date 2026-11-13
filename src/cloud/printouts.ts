import { supabase } from './supabase';

const BUCKET = 'inbody-printouts';
const signed = new Map<string, { url: string; expires: number }>();

/** Stores an InBody printout (photo or PDF) under the client's own folder; returns the file path. */
export async function uploadPrintout(
  clientId: string,
  blob: Blob,
  contentType: string,
  ext: 'jpg' | 'pdf'
): Promise<string> {
  if (!supabase) throw new Error('Cloud is not configured');
  const path = `${clientId}/${Date.now().toString(36)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

/** Short-lived link for viewing a private printout. */
export async function printoutUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const hit = signed.get(path);
  if (hit && hit.expires > Date.now() + 60_000) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  signed.set(path, { url: data.signedUrl, expires: Date.now() + 60 * 60 * 1000 });
  return data.signedUrl;
}

export async function deletePrintout(path: string): Promise<void> {
  if (!supabase) return;
  signed.delete(path);
  await supabase.storage.from(BUCKET).remove([path]);
}
