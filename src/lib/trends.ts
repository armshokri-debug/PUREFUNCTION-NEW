import { ClientProfile } from '../types';
import { measuresOf } from './assessments';
import { estimated1RM, parseISODate } from './workouts';

export interface Point {
  date: string;
  value: number;
}

const DAY = 86400000;
const daysBetween = (a: string, b: string) => (parseISODate(b).getTime() - parseISODate(a).getTime()) / DAY;

export interface Trend {
  /** change per week (least-squares slope) */
  perWeek: number;
  /** fitted value at the first and last date (to draw the line) */
  startFit: number;
  endFit: number;
  /** total change first → last measured value */
  total: number;
}

/** Straight-line trend through the points (needs 2+ points on different days). */
export function linearTrend(points: Point[]): Trend | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const xs = sorted.map((p) => daysBetween(sorted[0].date, p.date));
  const ys = sorted.map((p) => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx; // per day
  const intercept = my - slope * mx;
  return {
    perWeek: slope * 7,
    startFit: intercept,
    endFit: intercept + slope * xs[n - 1],
    total: ys[n - 1] - ys[0]
  };
}

/** One assessment measure over time (e.g. "body:weight", "rom:Hip IR:asym"). */
export function measureSeries(client: ClientProfile, key: string): Point[] {
  const out: Point[] = [];
  for (const a of client.assessments ?? []) {
    const m = measuresOf(a).find((r) => r.key === key);
    if (m && m.after != null) out.push({ date: a.date, value: m.after });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Measures that have at least one value, for the chart picker. */
export function chartableMeasures(client: ClientProfile): { key: string; label: string; unit: string; better: 'up' | 'down' }[] {
  const seen = new Map<string, { key: string; label: string; unit: string; better: 'up' | 'down' }>();
  for (const a of client.assessments ?? []) {
    for (const m of measuresOf(a)) {
      if (!seen.has(m.key) && !m.key.endsWith(':L') && !m.key.endsWith(':R')) {
        seen.set(m.key, { key: m.key, label: m.label, unit: m.unit, better: m.better });
      }
    }
  }
  return [...seen.values()];
}

/** Progressive overload for one exercise: best estimated 1RM and top weight per session. */
export function strengthSeries(client: ClientProfile, exerciseId: string): { e1rm: Point[]; topKg: Point[] } {
  const e1rm: Point[] = [];
  const topKg: Point[] = [];
  for (const w of client.workouts ?? []) {
    let best = 0;
    let top = 0;
    for (const b of w.blocks) {
      if (b.exerciseId !== exerciseId) continue;
      for (const s of b.loggedSets) {
        if (!s.completed || !s.kg || !s.reps || s.kg <= 0 || s.reps <= 0) continue;
        best = Math.max(best, estimated1RM(s.kg, s.reps));
        top = Math.max(top, s.kg);
      }
    }
    if (best > 0) {
      e1rm.push({ date: w.date, value: Math.round(best * 10) / 10 });
      topKg.push({ date: w.date, value: top });
    }
  }
  const byDate = (a: Point, b: Point) => a.date.localeCompare(b.date);
  return { e1rm: e1rm.sort(byDate), topKg: topKg.sort(byDate) };
}

/** Exercises with logged weighted sets (for the overload chart picker). */
export function loggedExercises(client: ClientProfile): { id: string; name: string; sessions: number }[] {
  const map = new Map<string, { id: string; name: string; sessions: number }>();
  for (const w of client.workouts ?? []) {
    for (const b of w.blocks) {
      if (b.loggedSets.some((s) => s.completed && (s.kg ?? 0) > 0 && (s.reps ?? 0) > 0)) {
        const e = map.get(b.exerciseId) ?? { id: b.exerciseId, name: b.name, sessions: 0 };
        e.sessions++;
        map.set(b.exerciseId, e);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}
