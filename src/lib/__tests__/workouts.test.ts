import { describe, expect, it } from 'vitest';
import { ClientProfile, Workout } from '../../types';
import {
  addDays,
  copyWeek,
  effectiveStatus,
  lastPerformance,
  migrateClient,
  orderLabels,
  parseReps,
  startOfWeek,
  suggestLoad,
  upsertWorkout,
  weekDates
} from '../workouts';
import { parseVideoLink } from '../media';
import { KG_TO_LB, formatWeight, kgToLb, lbToKg, roundLb } from '../units';
import { INITIAL_CLIENTS } from '../../data/mockData';

const baseClient = { ...INITIAL_CLIENTS[0], workouts: [] } as ClientProfile;

function wo(date: string, over: Partial<Workout> = {}): Workout {
  return {
    id: `w-${date}`,
    date,
    title: 'Lower',
    focus: '',
    status: 'planned',
    blocks: [
      {
        id: `b-${date}`,
        exerciseId: 'ex-goblet-squat',
        name: 'Goblet Squat',
        sets: 3,
        reps: '8-10',
        loadKg: 30,
        restSec: 90,
        notes: '',
        loggedSets: [1, 2, 3].map((n) => ({ setNumber: n, kg: 30, reps: null, completed: false }))
      }
    ],
    ...over
  };
}

describe('dates', () => {
  it('weeks start on Monday', () => {
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19'); // Sunday → previous Monday
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
    expect(weekDates('2026-10-19')).toHaveLength(7);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09'); // DST change day
  });
});

describe('prescriptions', () => {
  it('parses rep text', () => {
    expect(parseReps('8')).toEqual({ kind: 'reps', min: 8, max: 8 });
    expect(parseReps('8-10')).toEqual({ kind: 'reps', min: 8, max: 10 });
    expect(parseReps('10–8')).toEqual({ kind: 'reps', min: 8, max: 10 });
    expect(parseReps('30s').kind).toBe('time');
    expect(parseReps('AMRAP').kind).toBe('amrap');
  });

  it('labels supersets A1/A2', () => {
    expect(orderLabels([{}, { supersetWithPrevious: true }, {}, {}, { supersetWithPrevious: true }])).toEqual([
      'A1',
      'A2',
      'B',
      'C1',
      'C2'
    ]);
  });
});

describe('weight unit conversions (kg <-> lb)', () => {
  it('converts kg to lb and lb to kg using 1 kg = 2.20462 lb', () => {
    expect(KG_TO_LB).toBe(2.20462);
    expect(kgToLb(100)).toBeCloseTo(220.462, 3);
    expect(lbToKg(220.462)).toBe(100);
    expect(lbToKg(kgToLb(60))).toBe(60);
    expect(roundLb(80)).toBe(176.4);
    expect(formatWeight(80)).toBe('176.4 lb');
  });

  it('preserves 100, 102.5, and 135 at 1 decimal when converting lbToKg then kgToLb', () => {
    for (const lb of [100, 102.5, 135]) {
      const kg = lbToKg(lb);
      expect(Number(kgToLb(kg).toFixed(1))).toBe(lb);
      expect(roundLb(kg)).toBe(lb);
    }
  });
});

describe('load suggestions (double progression)', () => {
  const block = { reps: '8-10', sets: 3 };
  const perf = (reps: number[], extra = {}) => ({
    date: '2026-10-12',
    sets: reps.map((r) => ({ kg: 60, reps: r })),
    reps: '8-10',
    plannedSets: 3,
    ...extra
  });

  it('adds 5 lb step (rounded to nearest 2.5 lb, saved as kg) for lower body when every set hit top of range at RPE ≤ 8', () => {
    const s = suggestLoad(block, perf([10, 10, 10], { rpe: 8 }), 'Lower');
    // 60 kg = 132.28 lb + 5 lb -> rounded to nearest 2.5 lb = 137.5 lb -> saved as lbToKg(137.5)
    expect(s).toMatchObject({ action: 'increase', kg: lbToKg(137.5) });
    expect(s?.reason).toContain('+5 lb');
  });
  it('adds 2.5 lb step (rounded to nearest 2.5 lb, saved as kg) for upper body', () => {
    // 60 kg = 132.28 lb + 2.5 lb -> rounded to nearest 2.5 lb = 135 lb -> saved as lbToKg(135)
    expect(suggestLoad(block, perf([10, 10, 10]), 'Upper')).toMatchObject({
      action: 'increase',
      kg: lbToKg(135)
    });
  });
  it('uses 2.5 lb steps for small loads (< 45 lb) even on lower body', () => {
    // 10 kg = 22.05 lb + 2.5 lb -> rounded to nearest 2.5 lb = 25 lb -> saved as lbToKg(25)
    const light = { ...perf([10, 10, 10]), sets: [10, 10, 10].map((r) => ({ kg: 10, reps: r })) };
    expect(suggestLoad(block, light, 'Lower')).toMatchObject({ kg: lbToKg(25) });
  });
  it('holds when effort was too high', () => {
    expect(suggestLoad(block, perf([10, 10, 10], { rpe: 9.5 }), 'Lower')?.action).toBe('hold');
  });
  it('holds when pain was reported', () => {
    const s = suggestLoad(block, perf([10, 10, 10], { pain: true }), 'Lower');
    expect(s?.action).toBe('hold');
    expect(s?.reason).toMatch(/Pain/);
  });
  it('holds inside the range (add reps first)', () => {
    expect(suggestLoad(block, perf([10, 9, 8]), 'Lower')).toMatchObject({ action: 'hold', kg: 60 });
  });
  it('reduces after missed reps at max effort (rounded to nearest 2.5 lb, saved as kg)', () => {
    // 60 kg = 132.28 lb * 0.95 = 125.66 lb -> nearest 2.5 lb = 125 lb -> saved as lbToKg(125)
    expect(suggestLoad(block, perf([7, 6, 6], { rpe: 10 }), 'Lower')).toMatchObject({
      action: 'reduce',
      kg: lbToKg(125)
    });
  });
  it('needs all planned sets before increasing', () => {
    expect(suggestLoad(block, perf([10, 10]), 'Lower')?.action).toBe('hold');
  });
  it('no suggestion without history, for bodyweight or timed work', () => {
    expect(suggestLoad(block, null)).toBeNull();
    expect(suggestLoad({ reps: '30s', sets: 3 }, perf([30, 30, 30]))).toBeNull();
    const bw = { ...perf([10, 10, 10]), sets: [10, 10, 10].map((r) => ({ kg: 0, reps: r })) };
    expect(suggestLoad(block, bw)).toBeNull();
  });
});

describe('history & copying', () => {
  it('finds the last logged performance before a date', () => {
    const done = wo('2026-10-12', {
      status: 'completed',
      blocks: [
        {
          ...wo('x').blocks[0],
          rpe: 8,
          loggedSets: [
            { setNumber: 1, kg: 30, reps: 10, completed: true },
            { setNumber: 2, kg: 30, reps: 9, completed: true },
            { setNumber: 3, kg: 30, reps: null, completed: false }
          ]
        }
      ]
    });
    const c = upsertWorkout(upsertWorkout(baseClient, done), wo('2026-10-19'));
    const p = lastPerformance(c, 'ex-goblet-squat', '2026-10-19');
    expect(p?.date).toBe('2026-10-12');
    expect(p?.sets).toEqual([
      { kg: 30, reps: 10 },
      { kg: 30, reps: 9 }
    ]);
    expect(lastPerformance(c, 'ex-goblet-squat', '2026-10-12')).toBeNull();
  });

  it('copies a week without overwriting logged days', () => {
    let c = upsertWorkout(baseClient, wo('2026-10-19'));
    c = upsertWorkout(c, wo('2026-10-21'));
    c = upsertWorkout(c, wo('2026-10-28', { status: 'completed' })); // already done next Wed
    const r = copyWeek(c, '2026-10-19', '2026-10-26');
    expect(r.copied).toBe(1);
    expect(r.skipped).toBe(1);
    const mon = r.client.workouts!.find((w) => w.date === '2026-10-26')!;
    expect(mon.status).toBe('planned');
    expect(mon.id).not.toBe('w-2026-10-19');
    expect(mon.blocks[0].loggedSets.every((s) => !s.completed)).toBe(true);
    expect(r.client.workouts!.find((w) => w.date === '2026-10-28')!.status).toBe('completed');
  });

  it('one workout per day', () => {
    const c = upsertWorkout(upsertWorkout(baseClient, wo('2026-10-19')), { ...wo('2026-10-19'), id: 'other' });
    expect(c.workouts!.filter((w) => w.date === '2026-10-19')).toHaveLength(1);
  });

  it('past planned workout with nothing logged shows as missed', () => {
    expect(effectiveStatus(wo('2026-10-12'), '2026-10-19')).toBe('missed');
    expect(effectiveStatus(wo('2026-10-19'), '2026-10-19')).toBe('planned');
  });
});

describe('migration from the old weekly template', () => {
  it('creates dated workouts this week plus last week from "last time" numbers', () => {
    const legacy = INITIAL_CLIENTS[0];
    const c = migrateClient(legacy, '2026-10-25');
    expect(c.weeklyWorkouts).toBeUndefined();
    // Sunday → plan next week, last week (this week) becomes history
    const monday = c.workouts!.find((w) => w.date === '2026-10-26')!;
    expect(monday.status).toBe('planned');
    const prev = c.workouts!.find((w) => w.date === '2026-10-19')!;
    expect(prev.status).toBe('completed');
    // Monday's goblet squat last week was 32.5 kg × 8, 8, 8
    const mondayPrev = prev.blocks.find((b) => b.exerciseId === 'ex-goblet-squat')!;
    expect(mondayPrev.loggedSets.map((s) => [s.kg, s.reps])).toEqual([
      [32.5, 8],
      [32.5, 8],
      [32.5, 8]
    ]);
    // the most recent goblet squat before this Monday is the one from later last week
    const p = lastPerformance(c, 'ex-goblet-squat', '2026-10-26');
    expect(p!.date > '2026-10-19' && p!.date < '2026-10-26').toBe(true);
    // early in the week the plan starts this week
    expect(migrateClient(legacy, '2026-10-20').workouts!.some((w) => w.date === '2026-10-19' && w.status === 'planned')).toBe(true);
    expect(migrateClient(c)).toBe(c); // idempotent
  });
});

describe('video links', () => {
  it('accepts YouTube, Vimeo, Drive and direct files; rejects others', () => {
    expect(parseVideoLink('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({ ok: true, video: { kind: 'youtube' } });
    expect(parseVideoLink('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toMatchObject({ ok: true });
    expect(parseVideoLink('https://vimeo.com/558288571')).toMatchObject({ ok: true, video: { kind: 'vimeo', src: '558288571' } });
    expect(parseVideoLink('https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing')).toMatchObject({ ok: true, video: { kind: 'drive' } });
    expect(parseVideoLink('https://cdn.example.com/a/squat.mp4')).toMatchObject({ ok: true, video: { kind: 'url' } });
    expect(parseVideoLink('https://example.com/page').ok).toBe(false);
    expect(parseVideoLink('http://cdn.example.com/a.mp4').ok).toBe(false);
  });
});

import { compareAssessments, saveAssessment, verdict } from '../assessments';
import { createClientProfile } from '../clients';

describe('assessments', () => {
  const base = createClientProfile({ name: 'Ryan', email: 'r@x.com', phaseNumber: 1, phaseName: 'Reposition' });
  const vals = (weight: number, hipL: number, hipR: number, squatKg: number) => ({
    inBody: { ...base.inBody, weight, bodyFatPercent: 20 },
    rom: [{ id: 'r1', name: 'Hip IR', left: hipL, right: hipR }],
    priTests: [],
    gaitPosture: [],
    strengthTests: [{ id: 's1', exercise: 'Squat', loadKg: squatKg, reps: 5 }],
    videos: []
  });

  it('saves dated records with week numbers; same day replaces', () => {
    let c = saveAssessment(base, vals(80, 30, 40, 60), '2026-10-01');
    c = saveAssessment(c, vals(79, 36, 40, 65), '2026-10-29');
    c = saveAssessment(c, vals(78.5, 37, 40, 65), '2026-10-29');
    expect(c.assessments!.map((a) => [a.date, a.week])).toEqual([
      ['2026-10-01', 0],
      ['2026-10-29', 4]
    ]);
    expect(c.assessments![1].inBody.weight).toBe(78.5);
  });

  it('compares two assessments with direction-aware verdicts', () => {
    let c = saveAssessment(base, vals(80, 30, 40, 60), '2026-10-01');
    c = saveAssessment(c, vals(79, 36, 40, 65), '2026-10-29');
    const rows = compareAssessments(c.assessments![0], c.assessments![1]);
    const get = (l: string) => rows.find((r) => r.label === l)!;
    expect(verdict(get('Weight'))).toBe('better');
    expect(get('Hip IR — asymmetry')).toMatchObject({ before: 25, after: 10 });
    expect(verdict(get('Hip IR — asymmetry'))).toBe('better');
    expect(verdict(get('Squat (est. 1RM)'))).toBe('better');
    expect(verdict(get('Body fat'))).toBe('same');
    expect(verdict(get('InBody score'))).toBeNull(); // not measured
  });
});

import { goalStatus } from '../assessments';

describe('goals', () => {
  const base = createClientProfile({ name: 'G', email: 'g@x.com', phaseNumber: 1, phaseName: 'Reposition' });
  const snap = (hipL: number, kg: number) => ({
    inBody: { ...base.inBody, weight: kg },
    rom: [{ id: 'r1', name: 'Hip IR', left: hipL, right: 40 }],
    priTests: [], gaitPosture: [], strengthTests: [], videos: []
  });
  it('tracks progress toward a lower-is-better target from the latest assessment', () => {
    let c = saveAssessment(base, snap(30, 82), '2026-10-01');
    const goal = { id: 'g', metricKey: 'rom:Hip IR:asym', label: 'Hip IR asymmetry', unit: '%', direction: 'down' as const, start: 25, target: 10, createdAt: '2026-10-01' };
    expect(goalStatus(goal, c.assessments!)).toMatchObject({ current: 25, percent: 0, achieved: false });
    c = saveAssessment(c, snap(34, 81), '2026-10-29'); // 15%
    expect(goalStatus(goal, c.assessments!)).toMatchObject({ current: 15, percent: 67, achieved: false, asOf: '2026-10-29' });
    c = saveAssessment(c, snap(37, 80), '2026-11-26'); // 8%
    expect(goalStatus(goal, c.assessments!)).toMatchObject({ achieved: true, percent: 100 });
    const w = { ...goal, metricKey: 'body:weight', direction: 'down' as const, start: 82, target: 78 };
    expect(goalStatus(w, c.assessments!).percent).toBe(50);
  });
});

import { isNewRecord, personalRecords } from '../records';

describe('personal records', () => {
  const base = createClientProfile({ name: 'P', email: 'p@x.com', phaseNumber: 1, phaseName: 'Reposition' });
  const done = (date: string, sets: [number, number][]): Workout => ({
    id: 'w' + date, date, title: '', focus: '', status: 'completed',
    blocks: [{ id: 'b' + date, exerciseId: 'ex-curl', name: 'Biceps Curl', sets: sets.length, reps: '8', loadKg: 0, restSec: 60, notes: '',
      loggedSets: sets.map(([kg, reps], i) => ({ setNumber: i + 1, kg, reps, completed: true })) }]
  });
  it('takes the best estimated 1RM from logs and hand-entered records', () => {
    let c: ClientProfile = { ...base, workouts: [done('2026-10-05', [[12, 10], [14, 6]]), done('2026-10-12', [[15, 5]])] };
    let r = personalRecords(c);
    expect(r).toHaveLength(1);
    // est. 1RM: 12×10 = 16, 14×6 = 16.8, 15×5 = 17.5 → 15 kg × 5 is the best
    expect(r[0]).toMatchObject({ kg: 15, reps: 5, date: '2026-10-12', heaviestKg: 15, source: 'logged', best1RM: 17.5 });
    c = { ...c, manualRecords: [{ id: 'm1', exerciseId: 'ex-curl', name: 'Biceps Curl', kg: 20, reps: 3, addedBy: 'client' }] };
    r = personalRecords(c);
    expect(r[0]).toMatchObject({ kg: 20, reps: 3, source: 'manual', heaviestKg: 20 });
  });
  it('flags a new record only when it beats the earlier best', () => {
    const c: ClientProfile = { ...base, workouts: [done('2026-10-05', [[12, 10]])] };
    expect(isNewRecord(c, 'ex-curl', 'Biceps Curl', '2026-10-12', 14, 10)).toBe(true);
    expect(isNewRecord(c, 'ex-curl', 'Biceps Curl', '2026-10-12', 12, 9)).toBe(false);
    expect(isNewRecord(c, 'ex-squat', 'Squat', '2026-10-12', 100, 5)).toBe(false); // first time
  });
});

import { linearTrend, measureSeries, strengthSeries } from '../trends';

describe('trends', () => {
  it('fits a weekly rate through the points', () => {
    const t = linearTrend([
      { date: '2026-10-01', value: 82 },
      { date: '2026-10-15', value: 81 },
      { date: '2026-10-29', value: 80 }
    ])!;
    expect(t.perWeek).toBeCloseTo(-0.5, 5);
    expect(t.total).toBe(-2);
    expect(linearTrend([{ date: '2026-10-01', value: 1 }])).toBeNull();
  });
  it('builds series from assessments and logged workouts', () => {
    const base = createClientProfile({ name: 'T', email: 't@x.com', phaseNumber: 1, phaseName: 'Reposition' });
    let c = saveAssessment(base, { inBody: { ...base.inBody, weight: 82 }, rom: [], priTests: [], gaitPosture: [], strengthTests: [], videos: [] }, '2026-10-01');
    c = saveAssessment(c, { inBody: { ...base.inBody, weight: 80 }, rom: [], priTests: [], gaitPosture: [], strengthTests: [], videos: [] }, '2026-10-29');
    expect(measureSeries(c, 'body:weight')).toEqual([
      { date: '2026-10-01', value: 82 },
      { date: '2026-10-29', value: 80 }
    ]);
    c = { ...c, workouts: [
      { id: 'a', date: '2026-10-05', title: '', focus: '', status: 'completed', blocks: [{ id: 'b', exerciseId: 'sq', name: 'Squat', sets: 2, reps: '5', loadKg: 0, restSec: 0, notes: '', loggedSets: [{ setNumber: 1, kg: 100, reps: 5, completed: true }, { setNumber: 2, kg: 105, reps: 3, completed: true }] }] }
    ] };
    const s = strengthSeries(c, 'sq');
    expect(s.topKg).toEqual([{ date: '2026-10-05', value: 105 }]);
    expect(s.e1rm[0].value).toBeCloseTo(116.7, 1);
  });
});

import { axisOf, patternSpectrum } from '../patterns';

describe('pattern spectrum', () => {
  it('classifies exercises into movement families', () => {
    expect(axisOf({ pattern: 'Pull', bodyPart: 'Upper' } as never, 'x')).toBe('Pull');
    expect(axisOf(undefined, 'Left AIC Split Squat')).toBe('Single leg');
    expect(axisOf(undefined, 'Goblet Squat')).toBe('Squat');
    expect(axisOf(undefined, 'Romanian Deadlift')).toBe('Hinge');
    expect(axisOf(undefined, '90/90 Hip Lift')).toBe('Mobility & breathing');
    expect(axisOf(undefined, 'Cable Pallof Press')).toBe('Core');
  });
  it('counts sets per family and flags gaps', () => {
    const base = createClientProfile({ name: 'S', email: 's@x.com', phaseNumber: 1, phaseName: 'Reposition' });
    const blk = (name: string, sets: number) => ({ id: name, exerciseId: name, name, sets, reps: '8', loadKg: 0, restSec: 0, notes: '', loggedSets: [] });
    const c = { ...base, workouts: [{ id: 'w', date: '2026-10-20', title: '', focus: '', status: 'planned' as const, blocks: [blk('Goblet Squat', 3), blk('DB Bench Press', 4), blk('Push-up', 2), blk('Single-Arm Row', 3)] }] };
    const s = patternSpectrum(c, () => undefined, '2026-10-19', '2026-10-25');
    expect(s.sets).toMatchObject({ Squat: 3, Push: 6, Pull: 3, Hinge: 0 });
    expect(s.insights.join(' ')).toMatch(/No hinge, single leg, core, mobility & breathing work/);
    expect(s.insights.join(' ')).toMatch(/Push : pull is 2.0 : 1/);
  });
});

import { buildReport } from '../report';

describe('progress report', () => {
  it('summarises two assessments, sessions and new records in between', () => {
    const base = createClientProfile({ name: 'R', email: 'r@x.com', phaseNumber: 1, phaseName: 'Reposition' });
    const v = (w: number, hipL: number) => ({ inBody: { ...base.inBody, weight: w, skeletalMuscleMass: 30 }, rom: [{ id: 'r', name: 'Hip IR', left: hipL, right: 40 }], priTests: [], gaitPosture: [], strengthTests: [], videos: [] });
    let c = saveAssessment(base, v(82, 30), '2026-10-01');
    c = saveAssessment(c, v(80, 36), '2026-10-29');
    const blk = (kg: number) => ({ id: 'b' + kg, exerciseId: 'sq', name: 'Squat', sets: 1, reps: '5', loadKg: kg, restSec: 0, notes: '', loggedSets: [{ setNumber: 1, kg, reps: 5, completed: true }] });
    c = { ...c, workouts: [
      { id: 'a', date: '2026-09-20', title: '', focus: '', status: 'completed', blocks: [blk(80)] },
      { id: 'b', date: '2026-10-08', title: '', focus: '', status: 'completed', blocks: [blk(90)] },
      { id: 'c', date: '2026-10-15', title: '', focus: '', status: 'missed', blocks: [] }
    ] };
    const r = buildReport(c, c.assessments![0], c.assessments![1]);
    expect(r.weeks).toBe(4);
    expect(r.month).toBe(1);
    expect(r.highlights.map((h) => h.label)).toContain('Hip IR — asymmetry');
    expect(r.sessions).toEqual({ completed: 1, scheduled: 2, percent: 50 });
    expect(r.newRecords).toHaveLength(1);
    expect(r.newRecords[0].record.kg).toBe(90);
    expect(r.newRecords[0].previous?.kg).toBe(80);
  });
});
