import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Exercise } from '../types';
import { EXERCISES_LIBRARY } from '../data/mockData';
import { usePersistentState } from '../lib/storage';
import { useSession } from '../cloud/Session';
import { stableStringify, supabase } from '../cloud/supabase';

/**
 * Exercise library = Pure Function core set + the imported 1,200+ catalog
 * (loaded in the background so the first screen stays fast) + the coach's
 * own changes. Only the coach's changes are saved; the built-in lists ship
 * with the app.
 */

interface CoachEdits {
  /** Coach-created exercises and edited copies of built-in ones, by id. */
  edits: Record<string, Exercise>;
}

interface ExerciseLibraryValue {
  exercises: Exercise[];
  catalogLoaded: boolean;
  getExercise: (id: string) => Exercise | undefined;
  saveExercise: (exercise: Exercise) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
}

const CORE: Exercise[] = EXERCISES_LIBRARY.map((e) => ({ ...e, source: 'pf' as const }));

function migrateV1(): CoachEdits {
  try {
    const raw = localStorage.getItem('pf.exercises.v1');
    if (raw) {
      const list = JSON.parse(raw) as Exercise[];
      const edits: Record<string, Exercise> = {};
      for (const e of list) {
        if (e.isCustom || e.video) edits[e.id] = e.isCustom ? { ...e, source: 'coach' } : e;
      }
      return { edits };
    }
  } catch {
    /* ignore */
  }
  return { edits: {} };
}

const ExerciseLibraryContext = createContext<ExerciseLibraryValue | null>(null);

export const ExerciseLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useSession();
  const cloud = status !== 'local';
  const [localEdits, setLocalEdits] = usePersistentState<CoachEdits>('pf.exercises.v2', migrateV1);
  const [cloudEdits, setCloudEdits] = useState<CoachEdits>({ edits: {} });
  const coach = cloud ? cloudEdits : localEdits;
  const setCoach = cloud ? setCloudEdits : setLocalEdits;

  // Cloud: the coach's exercises live in the database (everyone signed in can read them).
  useEffect(() => {
    if (!supabase || status !== 'ready') return;
    let cancelled = false;
    supabase
      .from('exercises')
      .select('id, data')
      .then(({ data }) => {
        if (cancelled || !data) return;
        const edits: Record<string, Exercise> = {};
        for (const r of data as { id: string; data: Exercise }[]) edits[r.id] = { ...r.data, id: r.id };
        setCloudEdits({ edits });
      });
    const channel = supabase
      .channel('pf-exercises')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exercises' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          setCloudEdits((c) => {
            const edits = { ...c.edits };
            delete edits[id];
            return { edits };
          });
          return;
        }
        const r = payload.new as { id: string; data: Exercise };
        setCloudEdits((c) =>
          stableStringify(c.edits[r.id]) === stableStringify({ ...r.data, id: r.id })
            ? c
            : { edits: { ...c.edits, [r.id]: { ...r.data, id: r.id } } }
        );
      })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase?.removeChannel(channel);
    };
  }, [status]);
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('../data/exerciseCatalog.json')
      .then((m) => {
        if (!cancelled) {
          setCatalog(m.default as unknown as Exercise[]);
          setCatalogLoaded(true);
        }
      })
      .catch(() => setCatalogLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // A few catalog exercises duplicate the Pure Function core set. Keep the core one (it has
  // cues) and borrow the catalog video; old workouts that used the catalog id still resolve.
  const { builtInList, aliases } = useMemo(() => {
    const key = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
    const coreByName = new Map(CORE.map((e) => [key(e.name), e]));
    const videoFor = new Map<string, Exercise['video']>();
    const aliases = new Map<string, string>();
    const rest: Exercise[] = [];
    for (const e of catalog) {
      const twin = coreByName.get(key(e.name));
      if (twin) {
        aliases.set(e.id, twin.id);
        if (e.video) videoFor.set(twin.id, e.video);
      } else rest.push(e);
    }
    const core = CORE.map((e) => (!e.video && videoFor.has(e.id) ? { ...e, video: videoFor.get(e.id) } : e));
    return { builtInList: [...core, ...rest], aliases };
  }, [catalog]);

  const exercises = useMemo(() => {
    const builtIn = builtInList;
    const builtInIds = new Set(builtIn.map((e) => e.id));
    const customs = Object.values(coach.edits)
      .filter((e) => !builtInIds.has(e.id))
      .sort((a, b) => b.id.localeCompare(a.id)); // newest first
    return [...customs, ...builtIn.map((e) => coach.edits[e.id] ?? e)];
  }, [builtInList, coach]);

  const byId = useMemo(() => {
    const m = new Map(exercises.map((e) => [e.id, e]));
    for (const [from, to] of aliases) if (!m.has(from) && m.has(to)) m.set(from, m.get(to)!);
    return m;
  }, [exercises, aliases]);

  const saveExercise = async (exercise: Exercise) => {
    if (cloud && supabase) {
      const { data, error } = await supabase.from('exercises')
        .upsert({ id: exercise.id, data: exercise }, { onConflict: 'id' }).select('id');
      if (error || !data?.length) throw new Error('Exercise was not saved. Check your connection and access.');
    }
    // Keep replaced media: existing assessments/workouts may still reference it.
    setCoach((c) => ({ edits: { ...c.edits, [exercise.id]: exercise } }));
  };

  const deleteExercise = async (id: string) => {
    const ex = byId.get(id);
    if (!ex?.isCustom) return;
    if (cloud && supabase) {
      const { data, error } = await supabase.from('exercises').delete().eq('id', id).select('id');
      if (error || !data?.length) throw new Error('Exercise was not removed. Check your connection and access.');
    }
    // Media deletion is a separate maintenance decision, never implicit in a catalog edit.
    setCoach((c) => {
      const edits = { ...c.edits }; delete edits[id]; return { edits };
    });
  };

  return (
    <ExerciseLibraryContext.Provider
      value={{ exercises, catalogLoaded, getExercise: (id) => byId.get(id), saveExercise, deleteExercise }}
    >
      {children}
    </ExerciseLibraryContext.Provider>
  );
};

export function useExerciseLibrary(): ExerciseLibraryValue {
  const ctx = useContext(ExerciseLibraryContext);
  if (!ctx) throw new Error('useExerciseLibrary must be used inside ExerciseLibraryProvider');
  return ctx;
}

export { searchExercises } from '../lib/exerciseSearch';
