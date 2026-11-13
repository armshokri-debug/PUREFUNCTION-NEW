import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BodyFigure } from '../../components/BodyFigure';
import { MOVEMENTS, movementPose, solve } from '../bodyModel';

// Guard for redesigns of the human drawing: it must render for every pose the app uses.
describe('BodyFigure', () => {
  it('renders standing front and side', () => {
    for (const view of ['front', 'side'] as const) {
      const html = renderToStaticMarkup(<BodyFigure view={view} />);
      expect(html).toContain('<svg');
    }
  });
  it('renders every movement at start, middle and end of range', () => {
    for (const m of MOVEMENTS) {
      for (const view of ['front', 'side'] as const) {
        for (const f of [0, 0.5, 1]) {
          for (const side of ['L', 'R'] as const) {
            const html = renderToStaticMarkup(
              <BodyFigure view={view} pose={movementPose(m, view, m.normal * f, side)} ghost={movementPose(m, view, m.normal, side)} arcs={[{ center: [150, 120], fromDeg: 90, toDeg: 150, color: '#F59E0B', text: '45°' }]} labels={[{ at: [150, 120], text: 'Test', color: '#EF4444', side: 'left' }]} />
            );
            expect(html).toContain('<svg');
            expect(html).not.toContain('NaN');
          }
        }
      }
      // In each projection, the same limb endpoint must move when the range changes.
      for (const view of ['front', 'side'] as const) {
        for (const side of ['L', 'R'] as const) {
          const key = (joint: string) => view === 'front' ? `${joint}${side}` : joint;
          const before = solve(view, movementPose(m, view, 0, side)).p;
          const after = solve(view, movementPose(m, view, m.normal, side)).p;
          const from = before[key(m.end)];
          const to = after[key(m.end)];
          expect(from).toBeDefined();
          expect(to).toBeDefined();
          expect(Math.hypot(to[0] - from[0], to[1] - from[1])).toBeGreaterThan(0.1);
        }
      }
    }
  });
});
