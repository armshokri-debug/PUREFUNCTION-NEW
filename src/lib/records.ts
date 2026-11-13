import { ClientProfile } from '../types';
import { estimated1RM } from './workouts';

export interface PersonalRecord {
  /** grouping key: library id when known, else the lower-cased name */
  key: string;
  exerciseId?: string;
  name: string;
  /** best estimated 1RM (Epley) and the set it came from */
  best1RM: number;
  kg: number;
  reps: number;
  date?: string;
  source: 'logged' | 'manual';
  /** heaviest weight ever lifted for this exercise (any reps) */
  heaviestKg: number;
  manualId?: string;
}

const keyOf = (exerciseId: string | undefined, name: string) =>
  exerciseId ? `id:${exerciseId}` : `name:${name.trim().toLowerCase()}`;

/**
 * All-time bests per exercise: from every completed, weighted set the client
 * logged (optionally only before a date) plus hand-entered records.
 * Ranked by estimated 1RM so 60 kg × 10 beats 70 kg × 1.
 */
export function personalRecords(client: ClientProfile, beforeDate?: string): PersonalRecord[] {
  const map = new Map<string, PersonalRecord>();
  const consider = (r: Omit<PersonalRecord, 'heaviestKg'>) => {
    const prev = map.get(r.key);
    const heaviestKg = Math.max(prev?.heaviestKg ?? 0, r.kg);
    if (!prev || r.best1RM > prev.best1RM) map.set(r.key, { ...r, heaviestKg, name: prev?.name ?? r.name });
    else map.set(r.key, { ...prev, heaviestKg });
  };

  for (const w of client.workouts ?? []) {
    if (beforeDate && w.date >= beforeDate) continue;
    for (const b of w.blocks) {
      for (const s of b.loggedSets) {
        if (!s.completed || !s.kg || !s.reps || s.kg <= 0 || s.reps <= 0) continue;
        consider({
          key: keyOf(b.exerciseId, b.name),
          exerciseId: b.exerciseId,
          name: b.name,
          best1RM: Math.round(estimated1RM(s.kg, s.reps) * 10) / 10,
          kg: s.kg,
          reps: s.reps,
          date: w.date,
          source: 'logged'
        });
      }
    }
  }
  for (const m of client.manualRecords ?? []) {
    if (m.kg <= 0 || m.reps <= 0) continue;
    if (beforeDate && m.date && m.date >= beforeDate) continue;
    consider({
      key: keyOf(m.exerciseId, m.name),
      exerciseId: m.exerciseId,
      name: m.name,
      best1RM: Math.round(estimated1RM(m.kg, m.reps) * 10) / 10,
      kg: m.kg,
      reps: m.reps,
      date: m.date,
      source: 'manual',
      manualId: m.id
    });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** True when this set beats the client's previous best for the exercise (logged before `date` + manual). */
export function isNewRecord(
  client: ClientProfile,
  exerciseId: string,
  name: string,
  date: string,
  kg: number | null,
  reps: number | null
): boolean {
  if (!kg || !reps || kg <= 0 || reps <= 0) return false;
  const prev = personalRecords(client, date).find((r) => r.key === keyOf(exerciseId, name));
  if (!prev) return false; // first time doing it: not a "record" yet
  return estimated1RM(kg, reps) > prev.best1RM + 1e-9;
}
