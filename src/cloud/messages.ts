import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface Message {
  id: string;
  clientId: string;
  fromCoach: boolean;
  body: string;
  attachmentPath?: string;
  attachmentType?: 'image' | 'video';
  createdAt: string;
  readAt?: string;
}

type Row = Record<string, unknown>;
const toMsg = (r: Row): Message => ({
  id: String(r.id),
  clientId: String(r.client_id),
  fromCoach: Boolean(r.from_coach),
  body: String(r.body ?? ''),
  attachmentPath: (r.attachment_path as string) || undefined,
  attachmentType: (r.attachment_type as Message['attachmentType']) || undefined,
  createdAt: String(r.created_at),
  readAt: (r.read_at as string) || undefined
});

export function messagesErrorText(e: unknown): string {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/does not exist|schema cache|Could not find/i.test(msg)) return 'Messages are being set up. Please check back soon.';
  return msg || 'Something went wrong.';
}

/** Live thread for one client (or all threads for the coach when clientId is null). */
export function useMessages(clientId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError('Messages need the cloud version of the app.');
      return;
    }
    const sb = supabase;
    let cancelled = false;
    let q = sb.from('coach_messages').select('*').order('created_at', { ascending: true }).limit(500);
    if (clientId) q = q.eq('client_id', clientId);
    q.then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(messagesErrorText(error));
      else setMessages((data ?? []).map(toMsg));
      setLoading(false);
    });
    const ch = sb
      .channel(`messages-${clientId ?? 'all'}-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_messages', ...(clientId ? { filter: `client_id=eq.${clientId}` } : {}) }, (p) => {
        const row = (p.new && Object.keys(p.new).length ? p.new : p.old) as Row;
        const m = toMsg(row);
        setMessages((cur) => {
          if (p.eventType === 'DELETE') return cur.filter((x) => x.id !== m.id);
          const i = cur.findIndex((x) => x.id === m.id);
          if (i >= 0) return cur.map((x) => (x.id === m.id ? m : x));
          return [...cur, m];
        });
      })
      .subscribe();
    return () => {
      cancelled = true;
      sb.removeChannel(ch);
    };
  }, [clientId]);

  const send = useCallback(
    async (input: { clientId: string; fromCoach: boolean; body: string; file?: File }) => {
      if (!supabase) throw new Error('Offline');
      let attachment_path: string | null = null;
      let attachment_type: 'image' | 'video' | null = null;
      if (input.file) {
        const ext = (input.file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
        attachment_path = `${input.clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        attachment_type = input.file.type.startsWith('video') ? 'video' : 'image';
        const up = await supabase.storage.from('message-media').upload(attachment_path, input.file, { contentType: input.file.type, upsert: false });
        if (up.error) throw up.error;
      }
      const { data, error } = await supabase
        .from('coach_messages')
        .insert({ client_id: input.clientId, from_coach: input.fromCoach, body: input.body.trim(), attachment_path, attachment_type })
        .select()
        .single();
      if (error) throw error;
      const m = toMsg(data as Row);
      setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
    },
    []
  );

  const markRead = useCallback(async (ids: string[]) => {
    if (!supabase || !ids.length) return;
    const now = new Date().toISOString();
    setMessages((cur) => cur.map((m) => (ids.includes(m.id) ? { ...m, readAt: now } : m)));
    await supabase.from('coach_messages').update({ read_at: now }).in('id', ids);
  }, []);

  return { messages, error, loading, send, markRead };
}

export async function mediaUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.storage.from('message-media').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
