import { describe, expect, it } from 'vitest';
import { MOVEMENTS, POSTURE, movementPose, rateRom, ratePosture, sideDifference, solve } from '../bodyModel';

describe('solve', () => {
  it('raises the arm overhead at 180° shoulder flexion', () => {
    const j = solve('side', { shFlex: 180 });
    expect(j.p.el[1]).toBeLessThan(j.p.sh[1]);
    expect(Math.abs(j.p.el[0] - j.p.sh[0])).toBeLessThan(1);
  });
  it('drops the left shoulder with a positive tilt', () => {
    const j = solve('front', { shoulderTilt: 3 });
    expect(j.p.shL[1]).toBeGreaterThan(j.p.shR[1]);
  });
  it('keeps the feet on the floor when grounded', () => {
    const a = solve('side', { grounded: true });
    const b = solve('side', { grounded: true, kneeFlex: 100, ankleDorsi: 30 });
    expect(a.p.an).toEqual(b.p.an);
    expect(b.p.hip[1]).toBeGreaterThan(a.p.hip[1]);
  });
  it('every movement produces finite joints', () => {
    for (const m of MOVEMENTS) {
      for (const s of ['L', 'R'] as const) {
        for (const view of ['front', 'side'] as const) {
          const j = solve(view, movementPose(m, view, m.normal, s));
          Object.values(j.p).forEach(([x, y]) => {
            expect(Number.isFinite(x)).toBe(true);
            expect(Number.isFinite(y)).toBe(true);
          });
        }
      }
    }
  });
});

describe('alternate frontal ankle model', () => {
  it('rotates the shin while keeping its ankle pivot planted', () => {
    const m = MOVEMENTS.find((movement) => movement.id === 'ankle-dorsiflexion')!;
    const start = solve('front', movementPose(m, 'front', 0, 'L'));
    const end = solve('front', movementPose(m, 'front', m.normal, 'L'));
    expect(start.p.anL).toEqual(end.p.anL);
    expect(start.p.knL).not.toEqual(end.p.knL);
  });
});

describe('ratings', () => {
  it('rates ROM against normal', () => {
    expect(rateRom(165, 180)).toBe('ok');
    expect(rateRom(130, 180)).toBe('watch');
    expect(rateRom(22, 70)).toBe('work');
  });
  it('rates posture in degrees', () => {
    const sh = POSTURE.find((d) => d.key === 'shoulderTilt')!;
    expect(ratePosture(sh, 0.5)).toBe('ok');
    expect(ratePosture(sh, -3)).toBe('watch');
    expect(ratePosture(sh, 5)).toBe('work');
    expect(ratePosture(sh, undefined)).toBeNull();
  });
  it('describes side differences in degrees, never percent', () => {
    expect(sideDifference(30, 22)).toBe('Right 8° less than left');
    expect(sideDifference(20, 22)).toBe('Left 2° less than right');
    expect(sideDifference(40, 40.4)).toBe('Even both sides');
  });
});
