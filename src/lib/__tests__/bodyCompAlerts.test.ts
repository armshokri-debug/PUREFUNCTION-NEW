import { describe, expect, it } from 'vitest';
import { createClientProfile } from '../clients';
import { evaluateMuscleMassAlert, getClientBodyCompAlert } from '../bodyCompAlerts';

describe('evaluateMuscleMassAlert', () => {
  it('returns an alert on a steady decline across 3+ readings with >= 1% total drop and converts muscle mass from kg to lb rounded to 1 decimal', () => {
    const alert = evaluateMuscleMassAlert([
      { date: '2026-08-01', skeletalMuscleMass: 38.0 },
      { date: '2026-09-01', skeletalMuscleMass: 37.6 },
      { date: '2026-10-01', skeletalMuscleMass: 37.2 }
    ]);

    expect(alert).not.toBeNull();
    expect(alert?.readingsCount).toBe(3);
    expect(alert?.startMuscleMass).toBe(83.8);
    expect(alert?.latestMuscleMass).toBe(82.0);
    expect(alert?.dropPercent).toBe(2.1);
    expect(alert?.message).toMatch(/protein intake, hydration, and training consistency/i);
  });

  it('returns null when total body water changed by 2% or more during the decline', () => {
    const alert = evaluateMuscleMassAlert([
      { date: '2026-08-01', skeletalMuscleMass: 80.0, totalBodyWater: 50.0 },
      { date: '2026-09-01', skeletalMuscleMass: 79.2, totalBodyWater: 49.8 },
      // Water drops from 49.8 to 48.5 (~2.61% change >= 2%)
      { date: '2026-10-01', skeletalMuscleMass: 78.2, totalBodyWater: 48.5 }
    ]);

    expect(alert).toBeNull();
  });

  it('returns an alert when total body water changed less than 2% at every step of the decline', () => {
    const alert = evaluateMuscleMassAlert([
      { date: '2026-08-01', skeletalMuscleMass: 80.0, totalBodyWater: 50.0 },
      { date: '2026-09-01', skeletalMuscleMass: 79.2, totalBodyWater: 49.6 }, // 0.8% change
      { date: '2026-10-01', skeletalMuscleMass: 78.4, totalBodyWater: 49.2 } // ~0.81% change
    ]);

    expect(alert).not.toBeNull();
    expect(alert?.readingsCount).toBe(3);
  });

  it('returns null when there are only 2 readings', () => {
    const alert = evaluateMuscleMassAlert([
      { date: '2026-09-01', skeletalMuscleMass: 80.0 },
      { date: '2026-10-01', skeletalMuscleMass: 78.0 }
    ]);

    expect(alert).toBeNull();
  });

  it('returns null when muscle mass is going up', () => {
    const alert = evaluateMuscleMassAlert([
      { date: '2026-08-01', skeletalMuscleMass: 78.0 },
      { date: '2026-09-01', skeletalMuscleMass: 79.0 },
      { date: '2026-10-01', skeletalMuscleMass: 80.2 }
    ]);

    expect(alert).toBeNull();
  });

  it('returns null when there was an old decline, then the latest reading goes up', () => {
    const alert = evaluateMuscleMassAlert([
      { date: '2026-07-01', skeletalMuscleMass: 82.0 },
      { date: '2026-08-01', skeletalMuscleMass: 80.5 },
      { date: '2026-09-01', skeletalMuscleMass: 79.0 },
      { date: '2026-10-01', skeletalMuscleMass: 79.6 } // latest goes back up
    ]);

    expect(alert).toBeNull();
  });

  it('returns null when the decline across 3 readings is tiny noise (< 1% total drop)', () => {
    const alert = evaluateMuscleMassAlert([
      { date: '2026-08-01', skeletalMuscleMass: 80.0 },
      { date: '2026-09-01', skeletalMuscleMass: 79.8 },
      { date: '2026-10-01', skeletalMuscleMass: 79.5 } // 0.625% drop (< 1%)
    ]);

    expect(alert).toBeNull();
  });

  it('getClientBodyCompAlert passes totalBodyWater from client assessments and returns null when water changes >= 2%', () => {
    const base = createClientProfile({
      name: 'Test Client',
      email: 'test@example.com',
      phaseNumber: 1,
      phaseName: 'Reposition'
    });

    const makeSnapshot = (date: string, week: number, smm: number, water: number) => ({
      id: `as-${date}`,
      date,
      week,
      inBody: { ...base.inBody, skeletalMuscleMass: smm, totalBodyWater: water },
      rom: [],
      priTests: [],
      gaitPosture: [],
      strengthTests: [],
      videos: []
    });

    const clientWithWaterSwing = {
      ...base,
      assessments: [
        makeSnapshot('2026-08-01', 0, 80.0, 50.0),
        makeSnapshot('2026-09-01', 4, 79.1, 49.7),
        // Water drops from 49.7 to 48.4 (~2.6% >= 2%)
        makeSnapshot('2026-10-01', 8, 78.2, 48.4)
      ]
    };

    expect(getClientBodyCompAlert(clientWithWaterSwing)).toBeNull();
  });
});
