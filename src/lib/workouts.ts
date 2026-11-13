import {
  ClientProfile,
  DayWorkout,
  Exercise,
  SetLog,
  Workout,
  WorkoutBlock,
  WorkoutExerciseBlock
} from '../types';
import { WEIGHT_UNIT, formatWeight, kgToLb, lbToKg, roundLb } from './units';

/* ===========================================================================
 * Dates (local calendar days as YYYY-MM-DD, weeks start on Monday)
 * ======================================================================== */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(iso, -dow);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayShort(iso: string): string {
  return DOW[parseISODate(iso).getDay()];
}

export function formatDate(iso: string, opts: { weekday?: boolean } = {}): string {
  const d = parseISODate(iso);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return opts.weekday ? `${DOW[d.getDay()]}, ${base}` : base;
}

export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const s = parseISODate(weekStart);
  const e = parseISODate(end);
  return s.getMonth() === e.getMonth()
    ? `${MONTHS[s.getMonth()]} ${s.getDate()} – ${e.getDate()}`
    : `${formatDate(weekStart)} – ${formatDate(end)}`;
}

/* ===========================================================================
 * Ids
 * ======================================================================== */

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* ===========================================================================
 * Prescriptions
 * ======================================================================== */

export interface RepTarget {
  kind: 'reps' | 'time' | 'amrap';
  min: number;
  max: number;
}

/** "8" → 8–8, "8-10" / "8–10" → 8–10, "30s" / "45 sec" → time, "AMRAP" → amrap. */
export function parseReps(text: string): RepTarget {
  const t = (text || '').trim().toLowerCase();
  if (t.includes('amrap') || t === 'max') return { kind: 'amrap', min: 1, max: Infinity };
  const time = t.match(/^(\d+)\s*(s|sec|secs|seconds|")$/);
  if (time) return { kind: 'time', min: Number(time[1]), max: Number(time[1]) };
  const range = t.match(/^(\d+)\s*[-–to]+\s*(\d+)/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return { kind: 'reps', min: Math.min(a, b), max: Math.max(a, b) };
  }
  const single = t.match(/^(\d+)/);
  if (single) return { kind: 'reps', min: Number(single[1]), max: Number(single[1]) };
  return { kind: 'reps', min: 0, max: 0 };
}

/** A1, A2, B, C1, C2 … — exercises paired with the previous one share a letter. */
export function orderLabels(blocks: Pick<WorkoutBlock, 'supersetWithPrevious'>[]): string[] {
  const letters: number[] = [];
  blocks.forEach((b, i) => {
    letters.push(i > 0 && b.supersetWithPrevious ? letters[i - 1] : (letters[i - 1] ?? -1) + 1);
  });
  return blocks.map((_, i) => {
    const letter = String.fromCharCode(65 + (letters[i] % 26));
    const group = letters.filter((l) => l === letters[i]).length;
    if (group === 1) return letter;
    const pos = letters.slice(0, i + 1).filter((l) => l === letters[i]).length;
    return `${letter}${pos}`;
  });
}

export function emptySets(count: number, kg: number | null): SetLog[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => ({
    setNumber: i + 1,
    kg,
    reps: null,
    completed: false
  }));
}

/** Keeps logged sets in step with the prescribed set count. */
export function resizeSets(sets: SetLog[], count: number, kg: number | null): SetLog[] {
  if (sets.length === count) return sets;
  if (sets.length > count) return sets.slice(0, count);
  return [...sets, ...emptySets(count - sets.length, kg).map((s, i) => ({ ...s, setNumber: sets.length + i + 1 }))];
}

export function defaultBlockFor(exercise: Exercise): WorkoutBlock {
  const light = exercise.equipment === 'Bodyweight' || exercise.equipment === 'Foam Roller';
  const reps =
    exercise.pattern === 'Breathing' || exercise.phase === 'Reposition'
      ? '5'
      : exercise.pattern === 'Mobility'
      ? '8'
      : '8-10';
  return {
    id: newId('blk'),
    exerciseId: exercise.id,
    name: exercise.name,
    sets: 3,
    reps,
    loadKg: 0,
    restSec: light ? 45 : 90,
    notes: exercise.cues[0] ?? '',
    loggedSets: emptySets(3, light ? 0 : null)
  };
}

export function blankWorkout(date: string): Workout {
  return { id: newId('wo'), date, title: 'Workout', focus: '', blocks: [], status: 'planned' };
}

/** Fresh copy for another day: new ids, results cleared. */
export function cloneWorkout(w: Workout, date: string): Workout {
  return {
    id: newId('wo'),
    date,
    title: w.title,
    focus: w.focus,
    coachNotes: w.coachNotes,
    durationMin: w.durationMin,
    status: 'planned',
    blocks: w.blocks.map((b) => ({
      id: newId('blk'),
      exerciseId: b.exerciseId,
      name: b.name,
      supersetWithPrevious: b.supersetWithPrevious,
      sets: b.sets,
      reps: b.reps,
      loadKg: b.loadKg,
      restSec: b.restSec,
      notes: b.notes,
      loggedSets: emptySets(b.sets, b.loadKg || null)
    }))
  };
}

/* ===========================================================================
 * Client workout list helpers
 * ======================================================================== */

export function hasResults(w: Workout): boolean {
  return w.status === 'completed' || w.blocks.some((b) => b.loggedSets.some((s) => s.completed));
}

export function workoutOn(client: ClientProfile, date: string): Workout | undefined {
  return (client.workouts ?? []).find((w) => w.date === date);
}

/** Status for display: a planned workout in the past with nothing logged counts as missed. */
export function effectiveStatus(w: Workout, today: string = todayISO()): Workout['status'] {
  if (w.status !== 'planned') return w.status;
  if (w.date < today && !hasResults(w)) return 'missed';
  return 'planned';
}

function sortByDate(list: Workout[]): Workout[] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date));
}

/** Insert or replace the workout for its date (one workout per day). */
export function upsertWorkout(client: ClientProfile, workout: Workout): ClientProfile {
  const others = (client.workouts ?? []).filter((w) => w.id !== workout.id && w.date !== workout.date);
  return { ...client, workouts: sortByDate([...others, workout]) };
}

export function removeWorkout(client: ClientProfile, workoutId: string): ClientProfile {
  return { ...client, workouts: (client.workouts ?? []).filter((w) => w.id !== workoutId) };
}

export interface CopyResult {
  client: ClientProfile;
  copied: number;
  skipped: number;
}

/**
 * Copies workouts to other dates. A target day that already has logged
 * results is never overwritten (it is skipped); an untouched planned
 * workout on the target day is replaced.
 */
export function copyWorkouts(client: ClientProfile, pairs: { from: Workout; toDate: string }[]): CopyResult {
  let next = client;
  let copied = 0;
  let skipped = 0;
  for (const { from, toDate } of pairs) {
    const existing = workoutOn(next, toDate);
    if (existing && hasResults(existing)) {
      skipped++;
      continue;
    }
    next = upsertWorkout(next, cloneWorkout(from, toDate));
    copied++;
  }
  return { client: next, copied, skipped };
}

export function copyWeek(client: ClientProfile, fromWeekStart: string, toWeekStart: string): CopyResult {
  const days = weekDates(fromWeekStart);
  const pairs = days
    .map((d, i) => ({ from: workoutOn(client, d), toDate: addDays(toWeekStart, i) }))
    .filter((p): p is { from: Workout; toDate: string } => !!p.from);
  return copyWorkouts(client, pairs);
}

/* ===========================================================================
 * History & progression
 * ======================================================================== */

export interface Performance {
  date: string;
  sets: { kg: number; reps: number }[];
  rpe?: number;
  pain?: boolean;
  /** prescription at the time */
  reps: string;
  plannedSets: number;
}

/** Most recent logged performance of an exercise before `beforeDate`. */
export function lastPerformance(
  client: ClientProfile,
  exerciseId: string,
  beforeDate: string
): Performance | null {
  const list = (client.workouts ?? []).filter((w) => w.date < beforeDate).sort((a, b) => b.date.localeCompare(a.date));
  for (const w of list) {
    for (const b of w.blocks) {
      if (b.exerciseId !== exerciseId) continue;
      const done = b.loggedSets.filter((s) => s.completed && s.reps != null);
      if (!done.length) continue;
      return {
        date: w.date,
        sets: done.map((s) => ({ kg: s.kg ?? 0, reps: s.reps ?? 0 })),
        rpe: b.rpe,
        pain: b.pain,
        reps: b.reps,
        plannedSets: b.sets
      };
    }
  }
  return null;
}

export function formatPerformance(p: Performance): string {
  const sameKg = p.sets.every((s) => s.kg === p.sets[0].kg);
  if (sameKg) {
    const kg = p.sets[0].kg;
    return `${kg > 0 ? formatWeight(kg) : 'Bodyweight'} × ${p.sets.map((s) => s.reps).join(', ')}`;
  }
  return p.sets.map((s) => `${s.kg > 0 ? roundLb(s.kg) : 'BW'}×${s.reps}`).join(', ');
}

export interface LoadSuggestion {
  action: 'increase' | 'hold' | 'reduce';
  kg: number;
  /** short reason shown to the client and coach */
  reason: string;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Double progression (computed in lb, saved in kg):
 * - every planned set done at the TOP of the rep range, effort RPE ≤ 8, no pain
 *   → add load in lb: ~5% for lower body (min 5 lb), ~2.5% for upper body / small loads (min 2.5 lb),
 *   round suggested load to nearest 2.5 lb, then save as kg.
 * - pain last time → hold the load and tell the coach
 * - 2+ sets below the BOTTOM of the range → hold; if that happened at RPE ≥ 9.5,
 *   drop ~5% (rounded to nearest 2.5 lb, saved as kg)
 * - otherwise → same load, add reps first
 * Returns null when there is nothing to suggest (bodyweight, time or no history).
 */
export function suggestLoad(
  block: Pick<WorkoutBlock, 'reps' | 'sets'>,
  last: Performance | null,
  bodyPart?: Exercise['bodyPart']
): LoadSuggestion | null {
  if (!last) return null;
  const target = parseReps(block.reps);
  if (target.kind !== 'reps' || target.max === 0) return null;
  const top = Math.max(...last.sets.map((s) => s.kg));
  if (!(top > 0)) return null;

  if (last.pain) {
    return { action: 'hold', kg: top, reason: 'Pain reported last time — same load, tell your coach how it feels.' };
  }

  const atTop = last.sets.filter((s) => s.kg >= top);
  const allSetsDone = atTop.length >= block.sets;
  const allAtTopOfRange = atTop.every((s) => s.reps >= target.max);
  const effortOk = last.rpe == null || last.rpe <= 8;

  const topLb = kgToLb(top);
  const lower = bodyPart === 'Lower' || bodyPart === 'Hips' || bodyPart === 'Full Body';
  const stepLb = topLb < 45 || !lower ? 2.5 : 5;

  if (allSetsDone && allAtTopOfRange && effortOk) {
    const incLb = Math.max(stepLb, roundTo(topLb * (lower ? 0.05 : 0.025), stepLb));
    const nextLb = roundTo(topLb + incLb, 2.5);
    const kg = lbToKg(nextLb);
    return {
      action: 'increase',
      kg,
      reason: `Hit ${target.max} reps on every set${last.rpe ? ` at RPE ${last.rpe}` : ''} → +${incLb} ${WEIGHT_UNIT}`
    };
  }

  const missed = last.sets.filter((s) => s.reps < target.min).length;
  if (missed >= 2 && (last.rpe ?? 0) >= 9.5) {
    const nextLb = Math.max(2.5, roundTo(topLb * 0.95, 2.5));
    const kg = lbToKg(nextLb);
    return { action: 'reduce', kg, reason: `Missed reps at max effort last time → ${formatWeight(kg)} to rebuild quality reps` };
  }
  if (missed >= 2) {
    return { action: 'hold', kg: top, reason: `Missed reps last time — stay at ${formatWeight(top)} and own the range.` };
  }
  if (allSetsDone && allAtTopOfRange && !effortOk) {
    return { action: 'hold', kg: top, reason: `Reps were there but effort was high (RPE ${last.rpe}) — same load.` };
  }
  return { action: 'hold', kg: top, reason: `Add reps before adding weight (aim for ${target.max}).` };
}

/** Epley estimate, used for strength charts. */
export function estimated1RM(kg: number, reps: number): number {
  if (kg <= 0 || reps <= 0) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

/* ===========================================================================
 * Adherence
 * ======================================================================== */

/** Completed vs scheduled workouts between two dates (inclusive), up to today. */
export function adherence(
  client: ClientProfile,
  from: string,
  to: string,
  today: string = todayISO()
): { completed: number; scheduled: number } {
  const list = (client.workouts ?? []).filter((w) => w.date >= from && w.date <= to);
  const completed = list.filter((w) => w.status === 'completed').length;
  return { completed, scheduled: list.length };
}

/* ===========================================================================
 * Migration from the old Mon–Sun template (sample data / older saves)
 * ======================================================================== */

const DAY_INDEX: Record<DayWorkout['dayKey'], number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function legacyBlock(b: WorkoutExerciseBlock): WorkoutBlock {
  return {
    id: b.id,
    exerciseId: b.exerciseId,
    name: b.name,
    sets: b.sets,
    reps: String(b.targetReps),
    loadKg: b.loadKg,
    restSec: b.restSec,
    notes: b.cue,
    loggedSets: b.loggedSets.map((s) => ({
      setNumber: s.setNumber,
      kg: s.kg,
      reps: s.completed ? s.reps : null,
      completed: s.completed
    }))
  };
}

/**
 * Converts the old template into dated workouts for the coming week, plus
 * the previous week's sessions rebuilt from the "last time" numbers so the
 * history-based "Last time" and load suggestions have something to show.
 */
export function migrateClient(client: ClientProfile, today: string = todayISO()): ClientProfile {
  if (client.workouts) return client;
  const template = client.weeklyWorkouts ?? [];
  // Plan from this week early in the week, otherwise from next week, so the
  // week before is the (completed) history rather than a row of missed days.
  const dow = (parseISODate(today).getDay() + 6) % 7;
  const thisWeek = dow <= 2 ? startOfWeek(today) : addDays(startOfWeek(today), 7);
  const workouts: Workout[] = [];

  for (const day of template) {
    if (day.isRestDay || !day.blocks.length) continue;
    const date = addDays(thisWeek, DAY_INDEX[day.dayKey]);
    const prevDate = addDays(date, -7);

    workouts.push({
      id: `wo-${client.id}-${prevDate}`,
      date: prevDate,
      title: day.title,
      focus: day.focus,
      durationMin: day.durationMin,
      status: 'completed',
      completedAt: `${prevDate}T18:00:00.000Z`,
      blocks: day.blocks.map((b) => ({
        ...legacyBlock(b),
        id: `${b.id}-prev`,
        loadKg: b.lastTimeLoadKg,
        loggedSets: b.lastTimeRepsPerSet.map((reps, i) => ({
          setNumber: i + 1,
          kg: b.lastTimeLoadKg,
          reps,
          completed: true
        }))
      }))
    });

    workouts.push({
      id: `wo-${client.id}-${date}`,
      date,
      title: day.title,
      focus: day.focus,
      durationMin: day.durationMin,
      status: 'planned',
      blocks: day.blocks.map(legacyBlock)
    });
  }

  const { weeklyWorkouts: _drop, ...rest } = client;
  return { ...rest, workouts: sortByDate(workouts) };
}
