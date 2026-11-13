import { ClientProfile } from '../types';
import { roundLb } from './units';

export interface BodyCompReading {
  /** YYYY-MM-DD */
  date: string;
  skeletalMuscleMass: number;
  /** Optional total body water (when available on InBody readings) */
  totalBodyWater?: number;
}

export interface BodyCompAlert {
  readingsCount: number;
  startDate: string;
  endDate: string;
  startMuscleMass: number;
  latestMuscleMass: number;
  dropPercent: number;
  title: string;
  message: string;
}

/**
 * Evaluates whether to show a gentle body composition check-in card.
 *
 * Rules:
 * - Sorts valid readings (skeletalMuscleMass > 0) by date ascending.
 * - Finds the consecutive declining run that ENDS at the most recent reading.
 * - When totalBodyWater is present on a step, requires water change < 2% at every step of the run.
 * - Requires at least 3 readings in the declining run and a total drop of >= 1%.
 */
export function evaluateMuscleMassAlert(readings: BodyCompReading[]): BodyCompAlert | null {
  const valid = readings
    .filter((r) => typeof r.skeletalMuscleMass === 'number' && isFinite(r.skeletalMuscleMass) && r.skeletalMuscleMass > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (valid.length < 3) return null;

  const run: BodyCompReading[] = [valid[valid.length - 1]];

  for (let i = valid.length - 1; i >= 1; i--) {
    const curr = valid[i];
    const prev = valid[i - 1];

    // Must strictly go down at each step leading to the latest reading
    if (!(curr.skeletalMuscleMass < prev.skeletalMuscleMass)) {
      break;
    }

    // Hydration guard: if water is present on both readings, water must change < 2% at every step
    if (
      typeof prev.totalBodyWater === 'number' &&
      prev.totalBodyWater > 0 &&
      typeof curr.totalBodyWater === 'number' &&
      curr.totalBodyWater > 0
    ) {
      const waterChangePct = (Math.abs(curr.totalBodyWater - prev.totalBodyWater) / prev.totalBodyWater) * 100;
      if (waterChangePct >= 2) {
        break;
      }
    }

    run.unshift(prev);
  }

  if (run.length < 3) return null;

  const first = run[0];
  const latest = run[run.length - 1];
  const dropPercent = ((first.skeletalMuscleMass - latest.skeletalMuscleMass) / first.skeletalMuscleMass) * 100;

  if (dropPercent < 1) return null;

  return {
    readingsCount: run.length,
    startDate: first.date,
    endDate: latest.date,
    startMuscleMass: roundLb(first.skeletalMuscleMass),
    latestMuscleMass: roundLb(latest.skeletalMuscleMass),
    dropPercent: Math.round(dropPercent * 10) / 10,
    title: 'Muscle mass check-in',
    message:
      'Your skeletal muscle mass has trended slightly lower across your recent check-ins. Consider reviewing your daily protein intake, hydration, and training consistency with your coach.'
  };
}

/**
 * Extracts dated InBody skeletal muscle mass readings from a client's saved assessments
 * and returns a gentle alert if warranted.
 */
export function getClientBodyCompAlert(client: ClientProfile): BodyCompAlert | null {
  const readings: BodyCompReading[] = (client.assessments ?? []).map((a) => ({
    date: a.date,
    skeletalMuscleMass: a.inBody?.skeletalMuscleMass ?? 0,
    totalBodyWater: a.inBody?.totalBodyWater
  }));
  return evaluateMuscleMassAlert(readings);
}
