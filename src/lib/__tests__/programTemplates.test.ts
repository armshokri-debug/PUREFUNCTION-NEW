import { describe, expect, it } from 'vitest';
import { createClientProfile } from '../clients';
import { blankWorkout, upsertWorkout } from '../workouts';
import { applyProgramTemplate, createProgramTemplate, duplicateProgramTemplate, ProgramTemplate } from '../programTemplates';

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

  it('duplicates a template with fresh IDs, preserved prescriptions, cleared results, and full independence', () => {
    const source: ProgramTemplate = {
      id: 'tpl-source-1',
      name: '12-Week Strength',
      scope: 'program',
      createdAt: '2026-01-01T00:00:00.000Z',
      days: [
        {
          offset: 0,
          workout: {
            id: 'wo-src-1',
            date: '2026-11-02',
            title: 'Upper Control',
            focus: 'Scapular stability',
            coachNotes: 'Keep ribs stacked',
            durationMin: 45,
            status: 'completed',
            completedAt: '2026-11-02T15:00:00.000Z',
            sessionRpe: 8,
            clientFeedback: 'Felt solid',
            blocks: [
              {
                id: 'blk-src-1',
                exerciseId: 'ex-row',
                name: 'Seated Row',
                supersetWithPrevious: false,
                sets: 3,
                reps: '10',
                loadKg: 40,
                restSec: 90,
                notes: 'Pause at chest',
                rpe: 8,
                pain: false,
                clientNote: 'Left felt tight',
                loggedSets: [
                  { setNumber: 1, kg: 40, reps: 10, completed: true },
                  { setNumber: 2, kg: 40, reps: 10, completed: true },
                  { setNumber: 3, kg: 40, reps: 10, completed: true }
                ]
              },
              {
                id: 'blk-src-2',
                exerciseId: 'ex-breath',
                name: '90-90 Breathing',
                supersetWithPrevious: true,
                sets: 0,
                reps: '0',
                loadKg: 0,
                restSec: 0,
                notes: 'Zero values preserved',
                loggedSets: []
              }
            ]
          }
        },
        {
          offset: 77,
          workout: {
            id: 'wo-src-2',
            date: '2027-01-18',
            title: 'Peak Week 12',
            focus: 'Force output',
            status: 'planned',
            blocks: [
              {
                id: 'blk-src-3',
                exerciseId: 'ex-squat',
                name: 'Back Squat',
                sets: 4,
                reps: '4',
                loadKg: 100,
                restSec: 180,
                notes: '',
                loggedSets: []
              }
            ]
          }
        }
      ]
    };
    const sourceSnapshot = JSON.parse(JSON.stringify(source));

    const copy = duplicateProgramTemplate(source, '  12-Week Strength (Copy)  ');
    const copyTwo = duplicateProgramTemplate(source, '12-Week Strength v2');

    expect(copy.id).not.toBe(source.id);
    expect(copyTwo.id).not.toBe(copy.id);
    expect(copy.name).toBe('12-Week Strength (Copy)');
    expect(copy.scope).toBe('program');
    expect(Number.isNaN(Date.parse(copy.createdAt))).toBe(false);
    expect(copy.days).toHaveLength(2);
    expect(copy.days.map((d) => d.offset)).toEqual([0, 77]);

    // Distinct IDs and zero shared nested references
    expect(copy.days).not.toBe(source.days);
    expect(copy.days[0]).not.toBe(source.days[0]);
    expect(copy.days[0].workout).not.toBe(source.days[0].workout);
    expect(copy.days[0].workout.id).not.toBe(source.days[0].workout.id);
    expect(copy.days[1].workout.id).not.toBe(source.days[1].workout.id);
    expect(copy.days[0].workout.blocks).not.toBe(source.days[0].workout.blocks);
    expect(copy.days[0].workout.blocks[0]).not.toBe(source.days[0].workout.blocks[0]);
    expect(copy.days[0].workout.blocks[0].id).not.toBe(source.days[0].workout.blocks[0].id);
    expect(copy.days[0].workout.blocks[1].id).not.toBe(source.days[0].workout.blocks[1].id);
    expect(copy.days[0].workout.blocks[0].loggedSets).not.toBe(source.days[0].workout.blocks[0].loggedSets);

    // Preserved prescriptions & exercise metadata (including zero values and ordering)
    const w0 = copy.days[0].workout;
    expect(w0.title).toBe('Upper Control');
    expect(w0.focus).toBe('Scapular stability');
    expect(w0.coachNotes).toBe('Keep ribs stacked');
    expect(w0.durationMin).toBe(45);
    expect(w0.blocks.map((b) => b.exerciseId)).toEqual(['ex-row', 'ex-breath']);
    expect(w0.blocks[0]).toMatchObject({
      exerciseId: 'ex-row',
      name: 'Seated Row',
      supersetWithPrevious: false,
      sets: 3,
      reps: '10',
      loadKg: 40,
      restSec: 90,
      notes: 'Pause at chest'
    });
    expect(w0.blocks[1]).toMatchObject({
      exerciseId: 'ex-breath',
      name: '90-90 Breathing',
      supersetWithPrevious: true,
      sets: 0,
      reps: '0',
      loadKg: 0,
      restSec: 0,
      notes: 'Zero values preserved',
      loggedSets: []
    });

    // No recorded workout results carried into copy
    expect(w0.status).toBe('planned');
    expect(w0.completedAt).toBeUndefined();
    expect(w0.sessionRpe).toBeUndefined();
    expect(w0.clientFeedback).toBeUndefined();
    expect(w0.blocks[0].rpe).toBeUndefined();
    expect(w0.blocks[0].pain).toBeUndefined();
    expect(w0.blocks[0].clientNote).toBeUndefined();
    expect(w0.blocks[0].loggedSets).toEqual([
      { setNumber: 1, kg: 40, reps: null, completed: false },
      { setNumber: 2, kg: 40, reps: null, completed: false },
      { setNumber: 3, kg: 40, reps: null, completed: false }
    ]);

    // Mutating copy does not affect source
    copy.name = 'Mutated Copy';
    copy.days[0].workout.title = 'Mutated Workout';
    copy.days[0].workout.blocks[0].sets = 99;
    copy.days[0].workout.blocks[0].loadKg = 120;
    copy.days[0].workout.blocks[0].notes = 'Changed cue';
    expect(source).toEqual(sourceSnapshot);
  });

  it('rejects blank or whitespace-only copy names', () => {
    const source = createProgramTemplate(
      upsertWorkout(client('source'), { ...blankWorkout('2026-11-02'), title: 'Session A' }),
      'Original',
      'week',
      '2026-11-02'
    );
    expect(() => duplicateProgramTemplate(source, '')).toThrow('Enter a template name.');
    expect(() => duplicateProgramTemplate(source, '   \t\n  ')).toThrow('Enter a template name.');
  });
});
