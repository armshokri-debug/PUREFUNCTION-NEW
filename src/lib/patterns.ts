import { ClientProfile, Exercise } from '../types';

/** The movement families a balanced program covers (radar axes). */
export const SPECTRUM = ['Squat', 'Hinge', 'Single leg', 'Push', 'Pull', 'Core', 'Mobility & breathing'] as const;
export type SpectrumAxis = (typeof SPECTRUM)[number];

/** Which family an exercise belongs to: library pattern first, then the name. */
export function axisOf(ex: Pick<Exercise, 'pattern' | 'phase' | 'bodyPart'> | undefined, name: string): SpectrumAxis | null {
  switch (ex?.pattern) {
    case 'Squat':
      return 'Squat';
    case 'Hinge':
      return 'Hinge';
    case 'Lunge / Single Leg':
      return 'Single leg';
    case 'Push':
      return 'Push';
    case 'Pull':
      return 'Pull';
    case 'Core':
      return 'Core';
    case 'Mobility':
    case 'Breathing':
      return 'Mobility & breathing';
  }
  const n = name.toLowerCase();
  if (/breath|90\/90|belly lift|clam|rotation|mobility|stretch|cars\b/.test(n) || ex?.phase === 'Reposition') return 'Mobility & breathing';
  if (/split squat|lunge|step[- ]?up|single[- ]leg|bulgarian|pistol/.test(n)) return 'Single leg';
  if (/squat|leg press/.test(n)) return 'Squat';
  if (/deadlift|\brdl\b|hinge|hip thrust|good morning|swing|bridge/.test(n)) return 'Hinge';
  if (/row|pull|chin|lat |face pull/.test(n)) return 'Pull';
  // core before push: "Pallof press" is anti-rotation core work, not a push
  if (/plank|pallof|dead bug|carry|core|ab |crunch|bird dog|anti/.test(n)) return 'Core';
  if (/press|push|dip|bench|fly/.test(n)) return 'Push';
  return null;
}

export interface Spectrum {
  sets: Record<SpectrumAxis, number>;
  planes: Record<'Sagittal' | 'Frontal' | 'Transverse' | 'Multiplanar', number>;
  total: number;
  unclassified: number;
  insights: string[];
}

/**
 * How the training is spread across movement families and planes between two
 * dates: 'planned' counts prescribed sets, 'done' counts completed sets.
 */
export function patternSpectrum(
  client: ClientProfile,
  getExercise: (id: string) => Exercise | undefined,
  from: string,
  to: string,
  mode: 'planned' | 'done' = 'planned'
): Spectrum {
  const sets = Object.fromEntries(SPECTRUM.map((a) => [a, 0])) as Record<SpectrumAxis, number>;
  const planes = { Sagittal: 0, Frontal: 0, Transverse: 0, Multiplanar: 0 };
  let unclassified = 0;
  for (const w of client.workouts ?? []) {
    if (w.date < from || w.date > to) continue;
    for (const b of w.blocks) {
      const n = mode === 'planned' ? b.sets : b.loggedSets.filter((s) => s.completed).length;
      if (!n) continue;
      const ex = getExercise(b.exerciseId);
      const axis = axisOf(ex, b.name);
      if (axis) sets[axis] += n;
      else unclassified += n;
      if (ex?.plane) planes[ex.plane] += n;
    }
  }
  const total = SPECTRUM.reduce((a, k) => a + sets[k], 0);

  const insights: string[] = [];
  if (total > 0) {
    const missing = SPECTRUM.filter((k) => sets[k] === 0);
    if (missing.length) insights.push(`No ${missing.join(', ').toLowerCase()} work in this period.`);
    if (sets.Push > 0 && sets.Pull > 0) {
      const r = sets.Push / sets.Pull;
      if (r >= 1.5) insights.push(`Push : pull is ${r.toFixed(1)} : 1 — consider more pulling.`);
      else if (r <= 0.67) insights.push(`Pull : push is ${(1 / r).toFixed(1)} : 1.`);
    }
    const lower = sets.Squat + sets.Hinge + sets['Single leg'];
    if (lower > 0 && sets['Single leg'] === 0) insights.push('All lower-body work is on two legs — add single-leg work for left/right balance.');
    const planeTotal = planes.Sagittal + planes.Frontal + planes.Transverse + planes.Multiplanar;
    if (planeTotal > 0 && planes.Sagittal / planeTotal >= 0.8) {
      insights.push(`${Math.round((planes.Sagittal / planeTotal) * 100)}% of sets are in the sagittal plane — little frontal / transverse work.`);
    }
  }
  return { sets, planes, total, unclassified, insights };
}
