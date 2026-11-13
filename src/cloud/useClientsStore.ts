import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ClientProfile, Workout } from '../types';
import { INITIAL_CLIENTS } from '../data/mockData';
import { migrateClient } from '../lib/workouts';
import { usePersistentState } from '../lib/storage';
import { stableStringify, supabase } from './supabase';
import type { Profile } from './Session';

export type SyncState = 'saved' | 'saving' | 'error' | 'offline';

export interface ClientsStore {
  clients: ClientProfile[];
  setClients: (update: (prev: ClientProfile[]) => ClientProfile[]) => void;
  loaded: boolean;
  sync: SyncState;
  loadError: string | null;
}

/* ---------------------------------------------------------------------------
 * Local demo mode (no cloud): everything stays in this browser
 * ------------------------------------------------------------------------- */

function loadLocalClients(): ClientProfile[] {
  try {
    const old = localStorage.getItem('pf.clients.v1');
    if (old) return (JSON.parse(old) as ClientProfile[]).map((c) => migrateClient(c));
  } catch {
    /* ignore */
  }
  return INITIAL_CLIENTS.map((c) => migrateClient(c));
}

export function useLocalClientsStore(): ClientsStore {
  const [clients, setClients] = usePersistentState<ClientProfile[]>('pf.clients.v2', loadLocalClients);
  return { clients, setClients, loaded: true, sync: 'saved', loadError: null };
}

/* ---------------------------------------------------------------------------
 * Cloud mode: one row per client (profile, without workouts) and one row per
 * workout, so the coach editing a program and the client logging a session
 * never overwrite each other's rows. Writes go out shortly after each change
 * (only rows that changed); changes from other devices arrive live.
 * ------------------------------------------------------------------------- */

interface ClientRow {
  id: string;
  email: string;
  data: Omit<ClientProfile, 'workouts' | 'weeklyWorkouts'>;
}
interface WorkoutRow {
  id: string;
  client_id: string;
  date: string;
  data: Workout;
}

const clientRow = (c: ClientProfile): ClientRow => {
  const { workouts: _w, weeklyWorkouts: _ww, ...doc } = c;
  return { id: c.id, email: (c.email ?? '').trim().toLowerCase(), data: doc };
};
const workoutRow = (clientId: string, w: Workout): WorkoutRow => ({
  id: w.id,
  client_id: clientId,
  date: w.date,
  data: w
});

const sortWorkouts = (list: Workout[]) => [...list].sort((a, b) => a.date.localeCompare(b.date));

export function useCloudClientsStore(profile: Profile | null): ClientsStore {
  const [clients, setState] = useState<ClientProfile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>('saved');

  const current = useRef<ClientProfile[]>([]);
  // what the server has, as last sent or received (row id -> stable JSON)
  const pushedClients = useRef(new Map<string, string>());
  const pushedWorkouts = useRef(new Map<string, string>());
  const timer = useRef<number | null>(null);
  const flushing = useRef(false);
  const again = useRef(false);

  const isCoach = profile?.role === 'coach';

  /* ---------------- initial load ---------------- */
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!supabase || !profile) return;
    let cancelled = false;
    (async () => {
      if (loadedFor.current !== profile.id) setLoaded(false); // first load only: later refreshes stay silent
      const [c, w] = await Promise.all([
        supabase.from('clients').select('id, email, data'),
        supabase.from('workouts').select('id, client_id, date, data')
      ]);
      if (cancelled) return;
      if (c.error || w.error) {
        setLoadError((c.error ?? w.error)!.message);
        setLoaded(true);
        return;
      }
      const byClient = new Map<string, Workout[]>();
      pushedWorkouts.current.clear();
      for (const r of (w.data ?? []) as WorkoutRow[]) {
        const wo = { ...r.data, id: r.id, date: r.date };
        pushedWorkouts.current.set(r.id, stableStringify(workoutRow(r.client_id, wo)));
        byClient.set(r.client_id, [...(byClient.get(r.client_id) ?? []), wo]);
      }
      pushedClients.current.clear();
      const list = ((c.data ?? []) as ClientRow[])
        .map((r) => {
          const profileDoc = { ...r.data, id: r.id, email: r.email } as ClientProfile;
          pushedClients.current.set(r.id, stableStringify(clientRow({ ...profileDoc, workouts: [] })));
          return { ...profileDoc, workouts: sortWorkouts(byClient.get(r.id) ?? []) };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      current.current = list;
      setState(list);
      setLoadError(null);
      loadedFor.current = profile.id;
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  /* ---------------- writes ---------------- */
  const flush = useCallback(async () => {
    if (!supabase) return;
    if (flushing.current) {
      again.current = true;
      return;
    }
    flushing.current = true;
    setSync('saving');
    let failed = false;
    try {
      const list = current.current;
      const liveClientIds = new Set(list.map((c) => c.id));
      const liveWorkouts = new Map<string, { json: string; row: WorkoutRow }>();
      for (const c of list) {
        for (const w of c.workouts ?? []) {
          const row = workoutRow(c.id, w);
          liveWorkouts.set(w.id, { json: stableStringify(row), row });
        }
      }

      // 1) deletions first (frees the one-workout-per-day slot for replacements)
      if (isCoach) {
        const goneWorkouts = [...pushedWorkouts.current.keys()].filter((id) => !liveWorkouts.has(id));
        if (goneWorkouts.length) {
          const { error } = await supabase.from('workouts').delete().in('id', goneWorkouts);
          if (error) throw error;
          goneWorkouts.forEach((id) => pushedWorkouts.current.delete(id));
        }
        const goneClients = [...pushedClients.current.keys()].filter((id) => !liveClientIds.has(id));
        if (goneClients.length) {
          const { error } = await supabase.from('clients').delete().in('id', goneClients);
          if (error) throw error;
          goneClients.forEach((id) => pushedClients.current.delete(id));
        }
      }

      // 2) client profiles that changed (before their workouts: foreign key)
      const changedClients = list
        .map((c) => {
          const row = clientRow(c);
          return { row, json: stableStringify(row) };
        })
        .filter((x) => pushedClients.current.get(x.row.id) !== x.json);
      if (changedClients.length) {
        if (isCoach) {
          const { error } = await supabase.from('clients').upsert(changedClients.map((x) => x.row), { onConflict: 'id' });
          if (error) throw error;
        } else {
          // A client may only UPDATE their own row (inserting is coach-only), and may not touch the
          // email column, so send just the profile data. An upsert here is rejected by the database
          // and made the app retry forever (e.g. when changing the profile photo).
          for (const x of changedClients) {
            const { data: done, error } = await supabase
              .from('clients')
              .update({ data: x.row.data })
              .eq('id', x.row.id)
              .select('id');
            if (error) throw error;
            if (!done || done.length === 0) throw new Error('Could not save your profile.');
          }
        }
        changedClients.forEach((x) => pushedClients.current.set(x.row.id, x.json));
      }

      // 3) workouts that changed
      const changedWorkouts = [...liveWorkouts.values()].filter((x) => pushedWorkouts.current.get(x.row.id) !== x.json);
      for (let i = 0; i < changedWorkouts.length; i += 200) {
        const chunk = changedWorkouts.slice(i, i + 200);
        const { error } = await supabase.from('workouts').upsert(chunk.map((x) => x.row), { onConflict: 'id' });
        if (error) throw error;
        chunk.forEach((x) => pushedWorkouts.current.set(x.row.id, x.json));
      }
    } catch (e) {
      failed = true;
      console.error('[sync]', (e as { message?: string }).message ?? e);
    } finally {
      flushing.current = false;
    }
    if (again.current) {
      again.current = false;
      void flush();
      return;
    }
    if (failed) {
      setSync(navigator.onLine === false ? 'offline' : 'error');
      // try again shortly (network blips, token refresh)
      timer.current = window.setTimeout(() => void flush(), 5000);
    } else {
      setSync('saved');
    }
  }, [isCoach]);

  const setClients = useCallback(
    (update: (prev: ClientProfile[]) => ClientProfile[]) => {
      const next = update(current.current);
      current.current = next;
      setState(next);
      setSync('saving');
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 600);
    },
    [flush]
  );

  // save before the tab closes
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('online', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('online', onHide);
    };
  }, [flush]);

  /* ---------------- live changes from other devices ---------------- */
  useEffect(() => {
    if (!supabase || !profile || !loaded) return;
    const apply = (fn: (list: ClientProfile[]) => ClientProfile[]) => {
      const next = fn(current.current);
      current.current = next;
      setState(next);
    };

    const channel: RealtimeChannel = supabase
      .channel(`pf-data-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workouts' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          pushedWorkouts.current.delete(id);
          apply((list) =>
            list.map((c) => ({ ...c, workouts: (c.workouts ?? []).filter((w) => w.id !== id) }))
          );
          return;
        }
        const r = payload.new as WorkoutRow;
        const wo: Workout = { ...r.data, id: r.id, date: r.date };
        const json = stableStringify(workoutRow(r.client_id, wo));
        if (pushedWorkouts.current.get(r.id) === json) return; // our own write coming back
        pushedWorkouts.current.set(r.id, json);
        apply((list) =>
          list.map((c) =>
            c.id !== r.client_id
              ? c
              : {
                  ...c,
                  workouts: sortWorkouts([
                    ...(c.workouts ?? []).filter((w) => w.id !== wo.id && w.date !== wo.date),
                    wo
                  ])
                }
          )
        );
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          pushedClients.current.delete(id);
          apply((list) => list.filter((c) => c.id !== id));
          return;
        }
        const r = payload.new as ClientRow;
        const doc = { ...r.data, id: r.id, email: r.email } as ClientProfile;
        const json = stableStringify(clientRow({ ...doc, workouts: [] }));
        if (pushedClients.current.get(r.id) === json) return;
        pushedClients.current.set(r.id, json);
        apply((list) => {
          const existing = list.find((c) => c.id === r.id);
          const merged = { ...doc, workouts: existing?.workouts ?? [] };
          return existing
            ? list.map((c) => (c.id === r.id ? merged : c))
            : [...list, merged].sort((a, b) => a.name.localeCompare(b.name));
        });
      })
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [profile, loaded]);

  return { clients, setClients, loaded, sync, loadError };
}
