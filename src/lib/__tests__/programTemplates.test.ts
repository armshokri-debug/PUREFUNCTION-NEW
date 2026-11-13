import { describe, expect, it } from 'vitest';
import { createClientProfile } from '../clients';
import { blankWorkout, upsertWorkout } from '../workouts';
import { applyProgramTemplate, createProgramTemplate } from '../programTemplates';

const client = (name: string) => createClientProfile({ name, email: `${name}@example.invalid`, phaseNumber: 1, phaseName: 'Reposition' });

describe('program templates', () => {
  it('captures one week and applies fresh workouts without overwriting logged results', () => {
    const source = upsertWorkout(client('source'), { ...blankWorkout('2026-11-02'), title: 'Monday plan' });
    const template = createProgramTemplate(source, 'Basics', 'week', '2026-11-03');
    expect(template.days).toHaveLength(1);
    expect(template.days[0].offset).toBe(0);
    const target = upsertWorkout(client('target'), { ...blankWorkout('2026-11-09'), status: 'completed' });
    const skipped = applyProgramTemplate([target], template, [target.id], '2026-11-09');
    expect(skipped.skipped).toBe(1);
    expect(skipped.clients[0].workouts?.[0].status).toBe('completed');
    const next = applyProgramTemplate([client('another')], template, ['not-selected'], '2026-11-09');
    expect(next.copied).toBe(0);
    const recipient = client('recipient');
    const applied = applyProgramTemplate([recipient], template, [recipient.id], '2026-11-09');
    expect(applied.copied).toBe(1);
    expect(applied.clients[0].workouts?.[0].date).toBe('2026-11-09');
    expect(applied.clients[0].workouts?.[0].title).toBe('Monday plan');
    expect(applied.clients[0].workouts?.[0].status).toBe('planned');
  });
  it('rejects empty source periods', () => {
    expect(() => createProgramTemplate(client('empty'), 'No workouts', 'program', '2026-11-02')).toThrow('No workouts');
  });

  it('captures a 12-week program with correct day offsets', () => {
    let source = client('twelve');
    source = upsertWorkout(source, { ...blankWorkout('2026-11-01'), title: 'Before window' });
    source = upsertWorkout(source, { ...blankWorkout('2026-11-02'), title: 'Week 1 Mon' });
    source = upsertWorkout(source, { ...blankWorkout('2026-11-11'), title: 'Week 2 Wed' });
    source = upsertWorkout(source, { ...blankWorkout('2027-01-24'), title: 'Week 12 Sun' });
    source = upsertWorkout(source, { ...blankWorkout('2027-01-25'), title: 'Week 13 Mon' });

    const template = createProgramTemplate(source, '12-Week Strength', 'program', '2026-11-04');
    expect(template.scope).toBe('program');
    expect(template.days.map((d) => ({ offset: d.offset, title: d.workout.title }))).toEqual([
      { offset: 0, title: 'Week 1 Mon' },
      { offset: 9, title: 'Week 2 Wed' },
      { offset: 83, title: 'Week 12 Sun' }
    ]);
  });

  it('preserves a workout containing completed logged sets', () => {
    const source = upsertWorkout(client('source'), { ...blankWorkout('2026-11-02'), title: 'Template Bench' });
    const template = createProgramTemplate(source, 'Bench Template', 'week', '2026-11-02');

    const target = upsertWorkout(client('target'), {
      ...blankWorkout('2026-11-09'),
      title: 'Existing Logged Bench',
      status: 'planned',
      blocks: [
        {
          id: 'blk-logged',
          exerciseId: 'ex-bench',
          name: 'Bench Press',
          sets: 1,
          reps: '5',
          loadKg: 70,
          restSec: 90,
          notes: '',
          loggedSets: [{ setNumber: 1, kg: 70, reps: 6, completed: true }]
        }
      ]
    });

    const result = applyProgramTemplate([target], template, [target.id], '2026-11-09');
    expect(result.skipped).toBe(1);
    expect(result.copied).toBe(0);
    expect(result.clients[0].workouts?.[0].title).toBe('Existing Logged Bench');
    expect(result.clients[0].workouts?.[0].blocks[0].loggedSets[0]).toEqual({
      setNumber: 1,
      kg: 70,
      reps: 6,
      completed: true
    });
  });

  it('preserves unselected clients unchanged', () => {
    const source = upsertWorkout(client('source'), { ...blankWorkout('2026-11-02'), title: 'Monday Plan' });
    const template = createProgramTemplate(source, 'Week Plan', 'week', '2026-11-02');

    const selected = client('selected');
    const unselected = upsertWorkout(client('unselected'), { ...blankWorkout('2026-11-09'), title: 'Keep Unselected' });
    const unselectedBefore = JSON.parse(JSON.stringify(unselected));

    const result = applyProgramTemplate([selected, unselected], template, [selected.id], '2026-11-09');
    expect(result.copied).toBe(1);
    expect(result.clients[0].workouts?.[0].title).toBe('Monday Plan');
    expect(result.clients[1]).toBe(unselected);
    expect(result.clients[1]).toEqual(unselectedBefore);
  });

  it('confirms copied workouts contain no source client results', () => {
    const source = upsertWorkout(client('source'), {
      ...blankWorkout('2026-11-02'),
      title: 'Completed Source Session',
      status: 'completed',
      completedAt: '2026-11-02T14:00:00.000Z',
      sessionRpe: 9,
      clientFeedback: 'Very heavy session',
      blocks: [
        {
          id: 'blk-src',
          exerciseId: 'ex-squat',
          name: 'Back Squat',
          sets: 2,
          reps: '5',
          loadKg: 80,
          restSec: 120,
          notes: 'Brace hard',
          loggedSets: [
            { setNumber: 1, kg: 80, reps: 5, completed: true },
            { setNumber: 2, kg: 80, reps: 5, completed: true }
          ]
        }
      ]
    });

    const template = createProgramTemplate(source, 'Clean Copy Template', 'week', '2026-11-02');
    const recipient = client('recipient');
    const result = applyProgramTemplate([recipient], template, [recipient.id], '2026-11-09');
    const copiedWorkout = result.clients[0].workouts?.[0];

    expect(copiedWorkout?.title).toBe('Completed Source Session');
    expect(copiedWorkout?.status).toBe('planned');
    expect(copiedWorkout?.completedAt).toBeUndefined();
    expect(copiedWorkout?.sessionRpe).toBeUndefined();
    expect(copiedWorkout?.clientFeedback).toBeUndefined();
    expect(copiedWorkout?.blocks[0].loggedSets).toEqual([
      { setNumber: 1, kg: 80, reps: null, completed: false },
      { setNumber: 2, kg: 80, reps: null, completed: false }
    ]);
  });
});
