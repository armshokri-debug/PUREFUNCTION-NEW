import { describe, expect, it } from 'vitest';
import catalog from '../../data/exerciseCatalog.json';
import { Exercise } from '../../types';
import { editDistance, equipmentOf, muscleGroupOf, searchExercises, stem, suggestQuery } from '../exerciseSearch';

const all = catalog as unknown as Exercise[];
const top = (q: string, n = 5, f = {}) => searchExercises(all, q, f).slice(0, n).map((e) => e.name);

describe('exercise search', () => {
  it('stems plurals', () => {
    expect(stem('lunges')).toBe('lunge');
    expect(stem('presses')).toBe('press');
    expect(stem('glutes')).toBe('glute');
  });
  it('edit distance counts a swap as one edit', () => {
    expect(editDistance('squat', 'sqaut', 2)).toBe(1);
    expect(editDistance('abc', 'xyz', 1)).toBeGreaterThan(1);
  });
  it('puts the plain exercise before long variations', () => {
    const r = top('goblet squat', 3);
    expect(r[0].toLowerCase()).toContain('goblet squat');
    const first = top('deadlift', 1)[0].toLowerCase();
    expect(first).toContain('deadlift');
  });
  it('understands abbreviations', () => {
    expect(top('db bench').some((n) => /dumbbell/i.test(n) && /bench/i.test(n))).toBe(true);
    expect(top('rdl').some((n) => /romanian/i.test(n))).toBe(true);
  });
  it('tolerates typos', () => {
    expect(top('sqaut', 5).some((n) => /squat/i.test(n))).toBe(true);
    expect(top('rommanian deadlift', 5).some((n) => /romanian/i.test(n))).toBe(true);
  });
  it('matches push-up however it is typed', () => {
    for (const q of ['pushup', 'push up', 'push-up', 'pushups']) {
      expect(top(q, 5).some((n) => /push.?up/i.test(n))).toBe(true);
    }
  });
  it('matches muscles, not just names', () => {
    const r = searchExercises(all, 'glutes', {});
    expect(r.length).toBeGreaterThan(20);
  });
  it('every word must match', () => {
    expect(searchExercises(all, 'banana squat', {})).toHaveLength(0);
  });
  it('suggests a correction when nothing matches', () => {
    expect(searchExercises(all, 'dedlfit', {})).toHaveLength(0);
    expect(suggestQuery(all, 'dedlfit')).toMatch(/deadlift/);
    expect(suggestQuery(all, 'squat')).toBeNull();
  });
  it('classifies muscle group and equipment from the name', () => {
    const mk = (name: string, extra: Partial<Exercise> = {}) => ({ id: name, name, bodyPart: 'Upper', equipment: 'Other', cues: [], ...extra }) as Exercise;
    expect(muscleGroupOf(mk('Barbell Calf Raise'))).toBe('Calves');
    expect(equipmentOf(mk('Barbell Calf Raise', { equipment: 'Bodyweight' }))).toBe('Barbell');
    expect(muscleGroupOf(mk('Lying Leg Curl'))).toBe('Hamstrings');
    expect(muscleGroupOf(mk('Dumbbell Biceps Curl'))).toBe('Biceps');
    expect(muscleGroupOf(mk('Pallof Press'))).toBe('Core');
    expect(muscleGroupOf(mk('Seated Cable Row'))).toBe('Back');
    expect(muscleGroupOf(mk('Dumbbell Bench Press'))).toBe('Chest');
    expect(equipmentOf(mk('Pause Back Squat'))).toBe('Barbell');
  });
  it('filters by group and equipment', () => {
    const r = searchExercises(all, '', { group: 'Chest', equipment: 'Dumbbell' });
    expect(r.length).toBeGreaterThan(3);
    expect(r.every((e) => /dumbbell|db/i.test(e.name) || e.equipment === 'Dumbbell')).toBe(true);
  });
  it('favorites and mine scopes work', () => {
    const fav = new Set([all[3].id]);
    expect(searchExercises(all, '', { scope: 'favorites' }, { favorites: fav }).map((e) => e.id)).toEqual([all[3].id]);
    expect(searchExercises(all, '', { scope: 'mine' })).toHaveLength(0);
  });
});
