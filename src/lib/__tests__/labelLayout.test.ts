import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BODY_BOX,
  DEFAULT_FIGURE_BOX,
  DEFAULT_GUTTER_GAP,
  DEFAULT_MIN_GAP,
  LayoutLabelInput,
  layoutLabels
} from '../labelLayout';

function segmentsProperlyCross(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number]
): boolean {
  // Ignore segments that share the exact same joint anchor
  if (Math.hypot(a1[0] - b1[0], a1[1] - b1[1]) < 1e-6) return false;
  const ccw = (p1: [number, number], p2: [number, number], p3: [number, number]) =>
    (p3[1] - p1[1]) * (p2[0] - p1[0]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
  const d1 = ccw(b1, b2, a1);
  const d2 = ccw(b1, b2, a2);
  const d3 = ccw(a1, a2, b1);
  const d4 = ccw(a1, a2, b2);
  return ((d1 > 1e-6 && d2 < -1e-6) || (d1 < -1e-6 && d2 > 1e-6)) &&
    ((d3 > 1e-6 && d4 < -1e-6) || (d3 < -1e-6 && d4 > 1e-6));
}

describe('layoutLabels', () => {
  const sampleLabels: LayoutLabelInput[] = [
    { at: [185, 290], text: 'L hip IR 28°', color: '#EF4444', side: 'right' },
    { at: [204, 118], text: 'L shoulder IR 52°', color: '#EF4444', side: 'right' },
    { at: [204, 118], text: 'L shoulder ER 72°', color: '#F59E0B', side: 'right' },
    { at: [204, 118], text: 'L shoulder flex 115°', color: '#F59E0B', side: 'right' },
    { at: [178, 514], text: 'L ankle dorsi 28°', color: '#F59E0B', side: 'right' },
    { at: [185, 290], text: 'L SLR 70°', color: '#F59E0B', side: 'right' },
    { at: [96, 118], text: 'R shoulder abd 35°', color: '#F59E0B', side: 'left' },
    { at: [115, 290], text: 'R hip ER 34°', color: '#F59E0B', side: 'left' },
    { at: [115, 290], text: 'R hip flex 112°', color: '#F59E0B', side: 'left' },
    { at: [124, -65], text: '2° to the right', color: '#F59E0B', side: 'left' },
    { at: [122, 548], text: 'R ankle dorsi 24°', color: '#EF4444', side: 'left' }
  ];

  it('keeps every tag inside the figure box and outside the body box with ~16px gutter gap', () => {
    const placed = layoutLabels(sampleLabels, { view: 'front' });
    expect(placed).toHaveLength(sampleLabels.length);

    for (const tag of placed) {
      // Inside outer figure box
      expect(tag.x).toBeGreaterThanOrEqual(DEFAULT_FIGURE_BOX.left);
      expect(tag.x + tag.width).toBeLessThanOrEqual(DEFAULT_FIGURE_BOX.right);
      expect(tag.y).toBeGreaterThanOrEqual(DEFAULT_FIGURE_BOX.top);
      expect(tag.y + tag.height).toBeLessThanOrEqual(DEFAULT_FIGURE_BOX.bottom);

      // Outside body silhouette box with >= 16px gap
      if (tag.column === 'left') {
        expect(tag.x + tag.width).toBeLessThanOrEqual(DEFAULT_BODY_BOX.left - DEFAULT_GUTTER_GAP);
      } else {
        expect(tag.x).toBeGreaterThanOrEqual(DEFAULT_BODY_BOX.right + DEFAULT_GUTTER_GAP);
      }
    }
  });

  it('sorts tags top to bottom by joint height and prevents any overlap (min 6px gap)', () => {
    const placed = layoutLabels(sampleLabels, { view: 'front' });

    for (const col of ['left', 'right'] as const) {
      const colTags = placed.filter((t) => t.column === col);
      expect(colTags.length).toBeGreaterThan(1);

      for (let i = 1; i < colTags.length; i++) {
        const prev = colTags[i - 1];
        const curr = colTags[i];

        // Sort order by joint height is kept
        expect(curr.jointY).toBeGreaterThanOrEqual(prev.jointY);
        expect(curr.centerY).toBeGreaterThan(prev.centerY);

        // No overlap: at least minGap (6px) between bottom of prev and top of curr
        const gap = curr.y - (prev.y + prev.height);
        expect(gap).toBeGreaterThanOrEqual(DEFAULT_MIN_GAP - 1e-6);
      }

      // Leader lines within the column must not cross each other
      for (let i = 0; i < colTags.length; i++) {
        for (let j = i + 1; j < colTags.length; j++) {
          const a = colTags[i];
          const b = colTags[j];
          expect(
            segmentsProperlyCross(
              [a.jointX, a.jointY],
              [a.lineX, a.lineY],
              [b.jointX, b.jointY],
              [b.lineX, b.lineY]
            )
          ).toBe(false);
        }
      }
    }
  });

  it('uses a single column in side view and keeps uniform tag dimensions', () => {
    const placed = layoutLabels(sampleLabels, { view: 'side' });
    expect(placed).toHaveLength(sampleLabels.length);

    const columns = new Set(placed.map((t) => t.column));
    expect(columns.size).toBe(1);

    const firstWidth = placed[0].width;
    const firstHeight = placed[0].height;
    for (let i = 0; i < placed.length; i++) {
      const tag = placed[i];
      expect(tag.width).toBe(firstWidth);
      expect(tag.height).toBe(firstHeight);
      expect(tag.x).toBeGreaterThanOrEqual(DEFAULT_FIGURE_BOX.left);
      expect(tag.x + tag.width).toBeLessThanOrEqual(DEFAULT_BODY_BOX.left - DEFAULT_GUTTER_GAP);
      expect(tag.y).toBeGreaterThanOrEqual(DEFAULT_FIGURE_BOX.top);
      expect(tag.y + tag.height).toBeLessThanOrEqual(DEFAULT_FIGURE_BOX.bottom);

      if (i > 0) {
        const prev = placed[i - 1];
        expect(tag.jointY).toBeGreaterThanOrEqual(prev.jointY);
        expect(tag.y - (prev.y + prev.height)).toBeGreaterThanOrEqual(DEFAULT_MIN_GAP - 1e-6);
      }
    }
  });
});
