import { useCallback, useEffect, useState } from 'react';
import { ClientProfile, CoachNote } from '../types';
import { supabase } from './supabase';

/** Private notes never travel through the client-readable clients.data document. */
export function useSecureNotes(client: ClientProfile, update?: (c: ClientProfile) => void) {
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [ready, setReady] = useState(!supabase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!supabase) return;
    const result = await supabase.from('coach_notes_secure')
      .select('id,date,text,shared,pinned').eq('client_id', client.id).order('date', { ascending: false });
    if (result.error) throw result.error;
    return result.data as CoachNote[];
  }, [client.id]);
  useEffect(() => {
    let active = true;
    setReady(!supabase); setNotes([]); setError(null);
    if (supabase) void load().then((data) => {
      if (active) { setNotes(data ?? []); setReady(true); }
    }).catch(() => { if (active) setError('Could not load notes. Reload to retry.'); });
    return () => { active = false; };
  }, [load]);
  const save = async (next: CoachNote[]) => {
    if (!supabase) { update?.({ ...client, coachNotes: next }); return true; }
    if (!ready || busy) return false;
    setBusy(true); setError(null);
    try {
      for (const note of next) {
        if (JSON.stringify(notes.find((n) => n.id === note.id)) === JSON.stringify(note)) continue;
        const row = { id: note.id, client_id: client.id, date: note.date, text: note.text,
          shared: !!note.shared, pinned: !!note.pinned };
        const { error: err } = await supabase.from('coach_notes_secure').upsert(row, { onConflict: 'id' });
        if (err) throw err;
      }
      for (const note of notes.filter((n) => !next.some((x) => x.id === n.id))) {
        const { error: err } = await supabase.from('coach_notes_secure').delete().eq('id', note.id).eq('client_id', client.id);
        if (err) throw err;
      }
      setNotes(await load() ?? []);
      return true;
    } catch { setError('Notes were not fully saved. Reload before retrying.'); setReady(false); return false; }
    finally { setBusy(false); }
  };
  return { notes: supabase ? notes : client.coachNotes ?? [], ready, busy, error, save };
}
