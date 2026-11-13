import { ClientProfile, Workout } from '../types';
import { addDays, cloneWorkout, copyWorkouts, startOfWeek } from './workouts';

export interface ProgramTemplate {
  id: string;
  name: string;
  scope: 'week' | 'program';
  createdAt: string;
  days: { offset: number; workout: Workout }[];
}

export function createProgramTemplate(
  client: ClientProfile, name: string, scope: 'week' | 'program', sourceDate: string
): ProgramTemplate {
  const start = startOfWeek(sourceDate);
  const length = scope === 'week' ? 7 : 84;
  const days = (client.workouts ?? [])
    .filter((w) => w.date >= start && w.date < addDays(start, length))
    .map((w) => ({
      offset: Math.round((Date.parse(`${w.date}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000),
      workout: cloneWorkout(w, w.date)
    }))
    .sort((a, b) => a.offset - b.offset);
  if (!name.trim()) throw new Error('Enter a template name.');
  if (!days.length) throw new Error('No workouts in the selected period.');
  return {
    id: `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    name: name.trim(), scope, days, createdAt: new Date().toISOString()
  };
}

/** Existing logged results are never overwritten; clones contain no client results. */
export function applyProgramTemplate(
  clients: ClientProfile[], template: ProgramTemplate, ids: string[], startDate: string
): { clients: ClientProfile[]; copied: number; skipped: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error('Choose a valid start date.');
  const start = startOfWeek(startDate);
  const selected = new Set(ids);
  let copied = 0, skipped = 0;
  const next = clients.map((client) => {
    if (!selected.has(client.id)) return client;
    const pairs = template.days.map(({ offset, workout }) => ({
      from: workout, toDate: addDays(start, offset)
    }));
    const result = copyWorkouts(client, pairs);
    copied += result.copied;
    skipped += result.skipped;
    return result.client;
  });
  return { clients: next, copied, skipped };
}
