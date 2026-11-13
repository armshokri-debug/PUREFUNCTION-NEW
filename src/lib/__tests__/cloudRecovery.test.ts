import { describe, expect, it } from 'vitest';
import { workoutResults } from '../../cloud/workoutResults';
import { blankWorkout } from '../workouts';
import { stableStringify } from '../../cloud/supabase';

describe('cloud recovery contracts', () => {
  it('does not send client changes to prescriptions through the secure result RPC', () => {
    const workout = { ...blankWorkout('2026-11-13'), title: 'Private coach prescription', coachNotes: 'Keep unchanged', blocks: [{
      id: 'b1', exerciseId: 'squat', name: 'Squat', sets: 1, reps: '8', loadKg: 20, restSec: 60, notes: 'Coach cue',
      loggedSets: [{ setNumber: 1, kg: 21, reps: 8, completed: true }], rpe: 8, pain: false, clientNote: 'Done'
    }] };
    const result = workoutResults(workout);
    expect(Object.keys(result).sort()).toEqual(['blocks','clientFeedback','completedAt','sessionRpe','status'].sort());
    expect(result.blocks[0]).toEqual({ id: 'b1', loggedSets: [{ setNumber: 1, kg: 21, reps: 8, completed: true }], rpe: 8, pain: false, clientNote: 'Done' });
    expect(JSON.stringify(result)).not.toContain('Coach cue');
    expect(JSON.stringify(result)).not.toContain('prescription');
  });
  it('normalizes absent optional result fields explicitly to the database contract', () => {
    const result = workoutResults(blankWorkout('2026-11-13'));
    expect(result.completedAt).toBeNull(); expect(result.sessionRpe).toBeNull();
    expect(result.clientFeedback).toBeNull(); expect(result.blocks).toEqual([]);
  });
  it('compares persisted JSON without depending on Postgres key order', () => {
    expect(stableStringify({ a: 1, b: { z: 2, x: 3 }, absent: undefined }))
      .toBe(stableStringify({ b: { x: 3, z: 2 }, a: 1 }));
  });
});
