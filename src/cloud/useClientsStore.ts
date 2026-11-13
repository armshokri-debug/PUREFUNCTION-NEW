import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ClientProfile, Workout } from '../types';
import { INITIAL_CLIENTS } from '../data/mockData';
import { migrateClient } from '../lib/workouts';
import { usePersistentState } from '../lib/storage';
import { stableStringify, supabase } from './supabase';
import type { Profile } from './Session';
import { workoutResults } from './workoutResults';

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
  updated_at?: string;
  id: string;
  email: string;
  data: Omit<ClientProfile, 'workouts' | 'weeklyWorkouts'>;
}
interface WorkoutRow {
  updated_at?: string;
  id: string;
  client_id: string;
  date: string;
  data: Workout;
}

const clientRow = (c: ClientProfile): ClientRow => {
  const { workouts: _w, weeklyWorkouts: _ww, coachNotes: _notes, ...doc } = c;
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
  const clientVersions = useRef(new Map<string, string>());
  const workoutVersions = useRef(new Map<string, string>());
  const mounted = useRef(true);
  const blocked = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (timer.current) window.clearTimeout(timer.current); }; }, []);
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
        supabase.from('clients').select('id, email, data, updated_at'),
        supabase.from('workouts').select('id, client_id, date, data, updated_at')
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
        if (r.updated_at) workoutVersions.current.set(r.id, r.updated_at);
        const wo = { ...r.data, id: r.id, date: r.date };
        pushedWorkouts.current.set(r.id, stableStringify(workoutRow(r.client_id, wo)));
        byClient.set(r.client_id, [...(byClient.get(r.client_id) ?? []), wo]);
      }
      pushedClients.current.clear();
      const list = ((c.data ?? []) as ClientRow[])
        .map((r) => {
          if (r.updated_at) clientVersions.current.set(r.id, r.updated_at);
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
  }, [profile?.id, profile?.role, profile?.clientId]);

  /* ---------------- writes ---------------- */
  const flush = useCallback(async () => {
    if (!supabase || !profile || !mounted.current || blocked.current || loadedFor.current !== profile.id) return;
    if (flushing.current) {
      again.current = true;
      return;
    }
    flushing.current = true;
    setSync('saving');
    let failed = false;
    let conflict = false;
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
        for (const id of goneWorkouts) {
          const version = workoutVersions.current.get(id);
          if (!version) throw new Error('Missing workout version');
          const { data, error } = await supabase.from('workouts').delete().eq('id', id).eq('updated_at', version).select('id');
          if (error) throw error;
          if (!data?.length) throw { code: '40001', message: 'Workout changed before deletion' };
          pushedWorkouts.current.delete(id); workoutVersions.current.delete(id);
        }
        const goneClients = [...pushedClients.current.keys()].filter((id) => !liveClientIds.has(id));
        for (const id of goneClients) {
          const version = clientVersions.current.get(id);
          if (!version) throw new Error('Missing profile version');
          const { data, error } = await supabase.from('clients').delete().eq('id', id).eq('updated_at', version).select('id');
          if (error) throw error;
          if (!data?.length) throw { code: '40001', message: 'Profile changed before deletion' };
          pushedClients.current.delete(id); clientVersions.current.delete(id);
        }
      }

      // 2) client profiles that changed (before their workouts: foreign key)
      const changedClients = list
        .map((c) => {
          const row = clientRow(c);
          return { row, json: stableStringify(row) };
        })
        .filter((x) => pushedClients.current.get(x.row.id) !== x.json);
      for (const x of changedClients) {
        const version = clientVersions.current.get(x.row.id);
        if (!isCoach && x.row.id !== profile.clientId) throw new Error('Own profile only');
        if (pushedClients.current.has(x.row.id)) {
          if (!version) throw new Error('Missing profile version. Reload before saving.');
          const { data, error } = await supabase.from('clients')
            .update(isCoach ? x.row : { data: x.row.data })
            .eq('id', x.row.id).eq('updated_at', version).select('id,updated_at');
          if (error) throw error;
          if (!data?.length) throw { code: '40001', message: 'Profile changed on another device. Reload before saving.' };
          clientVersions.current.set(x.row.id, data[0].updated_at);
        } else {
          if (!isCoach) throw new Error('Clients cannot create profiles');
          const { data, error } = await supabase.from('clients').insert(x.row).select('id,updated_at');
          if (error) throw error;
          if (!data?.length) throw new Error('Profile was not saved');
          clientVersions.current.set(x.row.id, data[0].updated_at);
        }
        pushedClients.current.set(x.row.id, x.json);
      }

      const changedWorkouts = [...liveWorkouts.values()].filter((x) => pushedWorkouts.current.get(x.row.id) !== x.json);
      for (const x of changedWorkouts) {
        const version = workoutVersions.current.get(x.row.id);
        if (!isCoach) {
          if (!version || x.row.client_id !== profile.clientId) throw new Error('Existing own workouts only');
          const { data, error } = await supabase.rpc('save_workout_results_secure', {
            p_workout_id: x.row.id, p_client_id: x.row.client_id,
            p_expected_version: version, p_results: workoutResults(x.row.data)
          });
          if (error) throw error;
          if (!data?.[0]?.updated_version) throw new Error('Workout result was not saved');
          workoutVersions.current.set(x.row.id, data[0].updated_version);
        } else if (pushedWorkouts.current.has(x.row.id)) {
          if (!version) throw new Error('Missing workout version. Reload before saving.');
          const { data, error } = await supabase.from('workouts').update(x.row)
            .eq('id', x.row.id).eq('updated_at', version).select('id,updated_at');
          if (error) throw error;
          if (!data?.length) throw { code: '40001', message: 'Workout changed on another device. Reload before saving.' };
          workoutVersions.current.set(x.row.id, data[0].updated_at);
        } else {
          const { data, error } = await supabase.from('workouts').insert(x.row).select('id,updated_at');
          if (error) throw error;
          if (!data?.length) throw new Error('Workout was not saved');
          workoutVersions.current.set(x.row.id, data[0].updated_at);
        }
        pushedWorkouts.current.set(x.row.id, x.json);
      }
    } catch (e) {
      failed = true;
      conflict = ['40001', '42501', '23505', '23503'].includes((e as { code?: string }).code ?? '');
      if (conflict) blocked.current = true;
      if (conflict) setLoadError('Your changes could not be saved safely. Reload to fetch the latest data before editing again.');
    } finally {
      flushing.current = false;
    }
    if (again.current && !conflict) {
      again.current = false;
      void flush();
      return;
    }
    if (!mounted.current) return;
    again.current = false;
    if (failed) {
      setSync(navigator.onLine === false ? 'offline' : 'error');
      // try again shortly (network blips, token refresh)
      if (!conflict) timer.current = window.setTimeout(() => void flush(), 5000);
    } else {
      setSync('saved');
    }
  }, [isCoach, profile]);

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
    const onOnline = () => void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('online', onOnline);
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
          const local = current.current.flatMap(c => (c.workouts ?? []).map(w => workoutRow(c.id, w))).find(w => w.id === id);
          if (local && pushedWorkouts.current.get(id) !== stableStringify(local)) { blocked.current = true; setLoadError('A workout was removed on another device. Reload before saving.'); return; }
          pushedWorkouts.current.delete(id);
          apply((list) =>
            list.map((c) => ({ ...c, workouts: (c.workouts ?? []).filter((w) => w.id !== id) }))
          );
          return;
        }
        const r = payload.new as WorkoutRow;
        const local = current.current.flatMap((c) => (c.workouts ?? []).map((w) => workoutRow(c.id, w))).find((w) => w.id === r.id);
        if (local && pushedWorkouts.current.get(r.id) !== stableStringify(local)) return;
        if (r.updated_at) workoutVersions.current.set(r.id, r.updated_at);
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
          const local = current.current.find(c => c.id === id);
          if (local && pushedClients.current.get(id) !== stableStringify(clientRow(local))) { blocked.current = true; setLoadError('A client record was removed on another device. Reload before saving.'); return; }
          pushedClients.current.delete(id);
          apply((list) => list.filter((c) => c.id !== id));
          return;
        }
        const r = payload.new as ClientRow;
        const local = current.current.find((c) => c.id === r.id);
        if (local && pushedClients.current.get(r.id) !== stableStringify(clientRow(local))) return;
        if (r.updated_at) clientVersions.current.set(r.id, r.updated_at);
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
