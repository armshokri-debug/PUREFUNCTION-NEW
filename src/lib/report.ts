import { AssessmentSnapshot, ClientProfile, Goal } from '../types';
import { ComparisonRow, compareAssessments, goalStatus, GoalStatus, verdict } from './assessments';
import { personalRecords, PersonalRecord } from './records';
import { addDays, adherence } from './workouts';

export interface Report {
  from: AssessmentSnapshot;
  to: AssessmentSnapshot;
  weeks: number;
  /** "Month 1" = weeks 0–4 etc. */
  month: number;
  rows: ComparisonRow[];
  /** biggest improvements (relative), up to 3 */
  highlights: ComparisonRow[];
  goals: { goal: Goal; status: GoalStatus }[];
  sessions: { completed: number; scheduled: number; percent: number | null };
  /** records first set (or beaten) in this period */
  newRecords: { record: PersonalRecord; previous?: PersonalRecord }[];
}

/** Everything for a progress report between two assessments. */
export function buildReport(client: ClientProfile, from: AssessmentSnapshot, to: AssessmentSnapshot): Report {
  const rows = compareAssessments(from, to).filter((r) => r.before != null || r.after != null);
  const rel = (r: ComparisonRow) =>
    r.before != null && r.after != null && r.before !== 0 ? Math.abs((r.after - r.before) / r.before) : 0;
  const highlights = rows
    .filter((r) => verdict(r) === 'better' && !r.key.endsWith(':L') && !r.key.endsWith(':R'))
    .sort((a, b) => rel(b) - rel(a))
    .slice(0, 3);

  const weeks = Math.max(0, to.week - from.week);
  const s = adherence(client, from.date, to.date);
  const before = new Map(personalRecords(client, from.date).map((r) => [r.key, r]));
  const now = personalRecords(client, addDays(to.date, 1));
  const newRecords = now
    .filter((r) => r.source === 'logged' && r.date && r.date >= from.date && r.date <= to.date)
    .filter((r) => !before.get(r.key) || r.best1RM > before.get(r.key)!.best1RM)
    .map((record) => ({ record, previous: before.get(record.key) }));

  return {
    from,
    to,
    weeks,
    month: Math.max(1, Math.round(to.week / 4)),
    rows,
    highlights,
    goals: (client.goals ?? []).map((goal) => ({ goal, status: goalStatus(goal, (client.assessments ?? []).filter((a) => a.date <= to.date)) })),
    sessions: { ...s, percent: s.scheduled ? Math.round((s.completed / s.scheduled) * 100) : null },
    newRecords
  };
}
