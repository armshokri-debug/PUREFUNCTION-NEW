import { AssessmentSnapshot, ClientProfile, Goal, calculateAsymmetryPercent } from '../types';
import { WEIGHT_UNIT } from './units';
import { estimated1RM, parseISODate, todayISO } from './workouts';

/**
 * Freezes the client's current assessment values as a dated record.
 * Saving again on the same day replaces that day's record (the coach corrected something).
 */
export function saveAssessment(
  client: ClientProfile,
  values: Omit<AssessmentSnapshot, 'id' | 'date' | 'week'>,
  date: string = todayISO()
): ClientProfile {
  const list = (client.assessments ?? []).filter((a) => a.date !== date);
  const first = [...list].sort((a, b) => a.date.localeCompare(b.date))[0];
  const week = first
    ? Math.max(0, Math.round((parseISODate(date).getTime() - parseISODate(first.date).getTime()) / (7 * 86400000)))
    : 0;
  const sameDay = (client.assessments ?? []).find((a) => a.date === date);
  const snapshot: AssessmentSnapshot = {
    id: `as-${date}`,
    date,
    week,
    ...JSON.parse(JSON.stringify(values))
  };
  // re-saving the same day keeps that day's notes and adds to its videos
  if (sameDay?.notes && !values.notes) snapshot.notes = sameDay.notes;
  if (sameDay?.clips?.length) {
    const ids = new Set((snapshot.clips ?? []).map((c) => c.id));
    snapshot.clips = [...sameDay.clips.filter((c) => !ids.has(c.id)), ...(snapshot.clips ?? [])];
  }
  return {
    ...client,
    assessments: [...list, snapshot].sort((a, b) => a.date.localeCompare(b.date))
  };
}

export interface ComparisonRow {
  /** stable id of the measure across assessments, e.g. "rom:Hip internal rotation:asym" */
  key: string;
  group: 'Body composition' | 'Range of motion' | 'Strength';
  label: string;
  unit: string;
  before: number | null;
  after: number | null;
  /** which direction is an improvement */
  better: 'up' | 'down';
}

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) && v !== 0 ? v : null);

/** Side-by-side numbers for two assessments (missing values stay empty instead of 0). */
export function compareAssessments(a: AssessmentSnapshot, b: AssessmentSnapshot): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const body: [keyof AssessmentSnapshot['inBody'], string, string, 'up' | 'down'][] = [
    ['weight', 'Weight', WEIGHT_UNIT, 'down'],
    ['skeletalMuscleMass', 'Skeletal muscle mass', WEIGHT_UNIT, 'up'],
    ['bodyFatMass', 'Body fat mass', WEIGHT_UNIT, 'down'],
    ['bodyFatPercent', 'Body fat', '%', 'down'],
    ['visceralFatLevel', 'Visceral fat level', '', 'down'],
    ['inBodyScore', 'InBody score', '', 'up']
  ];
  for (const [k, label, unit, better] of body) {
    rows.push({ key: `body:${String(k)}`, group: 'Body composition', label, unit, before: num(a.inBody[k]), after: num(b.inBody[k]), better });
  }

  const names = new Set([...a.rom, ...b.rom].map((r) => r.name));
  for (const name of names) {
    const ra = a.rom.find((r) => r.name === name);
    const rb = b.rom.find((r) => r.name === name);
    const asym = (r?: { left: number; right: number }) =>
      r && (r.left > 0 || r.right > 0) ? calculateAsymmetryPercent(r.left, r.right) : null;
    const side = (r: typeof ra, s: 'left' | 'right') => (r ? num(r[s]) : null);
    rows.push({ key: `rom:${name}:L`, group: 'Range of motion', label: `${name} — L`, unit: '°', before: side(ra, 'left'), after: side(rb, 'left'), better: 'up' });
    rows.push({ key: `rom:${name}:R`, group: 'Range of motion', label: `${name} — R`, unit: '°', before: side(ra, 'right'), after: side(rb, 'right'), better: 'up' });
    rows.push({ key: `rom:${name}:asym`, group: 'Range of motion', label: `${name} — asymmetry`, unit: '%', before: asym(ra), after: asym(rb), better: 'down' });
  }

  const lifts = new Set([...a.strengthTests, ...b.strengthTests].map((s) => s.exercise));
  for (const lift of lifts) {
    const e = (list: AssessmentSnapshot['strengthTests']) => {
      const t = list.find((s) => s.exercise === lift);
      return t ? num(Math.round(estimated1RM(t.loadKg, t.reps))) : null;
    };
    rows.push({ key: `str:${lift}`, group: 'Strength', label: `${lift} (est. 1RM)`, unit: WEIGHT_UNIT, before: e(a.strengthTests), after: e(b.strengthTests), better: 'up' });
  }
  return rows;
}

/** 'better' | 'worse' | 'same' | null (not comparable) */
export function verdict(row: ComparisonRow): 'better' | 'worse' | 'same' | null {
  if (row.before == null || row.after == null) return null;
  const d = row.after - row.before;
  if (Math.abs(d) < 1e-9) return 'same';
  return (d > 0) === (row.better === 'up') ? 'better' : 'worse';
}

/* ---------------------------------------------------------------------------
 * Goals: a target for one measure, tracked automatically by each assessment
 * ------------------------------------------------------------------------- */

/** Every measure in one assessment, by key (value = that assessment's number). */
export function measuresOf(a: AssessmentSnapshot): ComparisonRow[] {
  return compareAssessments(a, a).filter((r) => r.after != null);
}

export interface GoalStatus {
  current: number | null;
  /** 0–100, how far from start to target */
  percent: number;
  achieved: boolean;
  /** date of the assessment the current value comes from */
  asOf: string | null;
}

export function goalStatus(goal: Goal, assessments: AssessmentSnapshot[]): GoalStatus {
  const sorted = [...assessments].sort((a, b) => a.date.localeCompare(b.date));
  let current: number | null = null;
  let asOf: string | null = null;
  for (const a of sorted) {
    const m = measuresOf(a).find((r) => r.key === goal.metricKey);
    if (m && m.after != null) {
      current = m.after;
      asOf = a.date;
    }
  }
  if (current == null) return { current: null, percent: 0, achieved: false, asOf: null };
  const up = goal.direction === 'up';
  const achieved = up ? current >= goal.target : current <= goal.target;
  const span = goal.target - goal.start;
  const percent = achieved ? 100 : span === 0 ? 0 : Math.max(0, Math.min(100, Math.round(((current - goal.start) / span) * 100)));
  return { current, percent, achieved, asOf };
}
