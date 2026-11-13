export type Pt = [number, number];

export interface LayoutLabelInput {
  at: Pt;
  text: string;
  color: string;
  /** Which side of the figure the tag sits on in front view */
  side: 'left' | 'right';
  dy?: number;
  onClick?: () => void;
}

export interface BoxBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface LayoutOptions {
  view?: 'front' | 'side';
  /** Outer figure box: every tag must stay strictly inside this box */
  box?: BoxBounds;
  /** Body silhouette box: every tag must stay strictly outside this box (by at least gutterGap) */
  bodyBox?: BoxBounds;
  /** Horizontal gap between the widest part of the body and the inner edge of tags (default 16) */
  gutterGap?: number;
  /** Minimum vertical gap between adjacent tags in the same column (default 6) */
  minGap?: number;
  /** Uniform tag width so all tags share the exact same size (default 144) */
  tagWidth?: number;
  /** Uniform tag height so all tags share the exact same size (default 24) */
  tagHeight?: number;
  /** Which single column to use when view === 'side' (default 'left') */
  sideViewColumn?: 'left' | 'right';
}

export interface PlacedLabel extends LayoutLabelInput {
  column: 'left' | 'right';
  x: number;
  y: number;
  centerY: number;
  width: number;
  height: number;
  jointX: number;
  jointY: number;
  lineX: number;
  lineY: number;
}

/** Bounding box of the standing human silhouette in BodyFigure coordinate space (centered at x = 150) */
export const DEFAULT_BODY_BOX: BoxBounds = {
  left: 64,
  right: 236,
  top: -10,
  bottom: 550
};

/** Outer figure box including left and right label gutters (centered at x = 150, height = 638) */
export const DEFAULT_FIGURE_BOX: BoxBounds = {
  left: -112,
  right: 412,
  top: -70,
  bottom: 568
};

export const DEFAULT_GUTTER_GAP = 16;
export const DEFAULT_MIN_GAP = 6;
export const DEFAULT_TAG_WIDTH = 140;
export const DEFAULT_TAG_HEIGHT = 24;
export const DEFAULT_BOX_PADDING = 20;

export const LABEL_VIEWBOX_FRONT = `${DEFAULT_FIGURE_BOX.left} ${DEFAULT_FIGURE_BOX.top} ${DEFAULT_FIGURE_BOX.right - DEFAULT_FIGURE_BOX.left} ${DEFAULT_FIGURE_BOX.bottom - DEFAULT_FIGURE_BOX.top}`;
export const LABEL_VIEWBOX_SIDE = `${DEFAULT_FIGURE_BOX.left} ${DEFAULT_FIGURE_BOX.top} ${252 - DEFAULT_FIGURE_BOX.left} ${DEFAULT_FIGURE_BOX.bottom - DEFAULT_FIGURE_BOX.top}`;

/**
 * Pure layout function that places Body map finding tags into clean columns outside the body silhouette:
 * - Two columns ('left' and 'right') in front view, one column in side view.
 * - Sorted top-to-bottom within each column by the joint's height (`at[1]`) so leader lines do not cross.
 * - Spread vertically with at least `minGap` (6px) between tags while staying as close as possible to `at[1]`.
 * - Clamped inside `box` (with padding from frame edges) and kept outside `bodyBox` by at least `gutterGap` (16px).
 */
export function layoutLabels(
  labels: readonly LayoutLabelInput[],
  options?: LayoutOptions
): PlacedLabel[] {
  if (!labels || labels.length === 0) return [];

  const view = options?.view ?? 'front';
  const box = options?.box ?? DEFAULT_FIGURE_BOX;
  const bodyBox = options?.bodyBox ?? DEFAULT_BODY_BOX;
  const gutterGap = options?.gutterGap ?? DEFAULT_GUTTER_GAP;
  const minGap = options?.minGap ?? DEFAULT_MIN_GAP;
  const tagWidth = options?.tagWidth ?? DEFAULT_TAG_WIDTH;
  const tagHeight = options?.tagHeight ?? DEFAULT_TAG_HEIGHT;
  const sideViewColumn = options?.sideViewColumn ?? 'left';

  const step = tagHeight + minGap;

  const leftEdgeRightCol = Math.max(bodyBox.right + gutterGap, box.left);
  const rightColX = Math.min(leftEdgeRightCol, box.right - tagWidth);

  const rightEdgeLeftCol = Math.min(bodyBox.left - gutterGap, box.right);
  const leftColX = Math.max(box.left, rightEdgeLeftCol - tagWidth);

  const byCol: Record<'left' | 'right', { label: LayoutLabelInput; index: number }[]> = {
    left: [],
    right: []
  };

  labels.forEach((label, index) => {
    const col: 'left' | 'right' = view === 'side' ? sideViewColumn : label.side;
    byCol[col].push({ label, index });
  });

  const result: PlacedLabel[] = [];

  for (const col of ['left', 'right'] as const) {
    const items = byCol[col];
    if (items.length === 0) continue;

    // Sort top-to-bottom by joint height (at[1]); tie-break by original order
    items.sort((a, b) => a.label.at[1] - b.label.at[1] || a.index - b.index);

    const n = items.length;
    const availH = box.bottom - box.top - tagHeight - (n - 1) * step;
    const padY = Math.max(0, Math.min(DEFAULT_BOX_PADDING, availH / 2));
    const minCenterY = box.top + padY + tagHeight / 2;
    const maxCenterY = box.bottom - padY - tagHeight / 2;

    const desired = items.map((item) =>
      Math.min(maxCenterY, Math.max(minCenterY, item.label.at[1]))
    );

    // Pool Adjacent Violators Algorithm (PAVA) for least-squares vertical placement with spacing >= step
    const blocks: { sumW: number; count: number }[] = [];
    for (let i = 0; i < n; i++) {
      blocks.push({ sumW: desired[i] - i * step, count: 1 });
      while (blocks.length >= 2) {
        const top = blocks[blocks.length - 1];
        const prev = blocks[blocks.length - 2];
        if (prev.sumW / prev.count > top.sumW / top.count) {
          prev.sumW += top.sumW;
          prev.count += top.count;
          blocks.pop();
        } else {
          break;
        }
      }
    }

    const centers: number[] = [];
    let idx = 0;
    for (const b of blocks) {
      const mean = b.sumW / b.count;
      for (let k = 0; k < b.count; k++) {
        centers.push(mean + idx * step);
        idx++;
      }
    }

    // Clamp inside [minCenterY, maxCenterY] while maintaining step spacing
    centers[0] = Math.max(minCenterY, centers[0]);
    for (let i = 1; i < n; i++) {
      centers[i] = Math.max(centers[i], centers[i - 1] + step);
    }
    centers[n - 1] = Math.min(maxCenterY, centers[n - 1]);
    for (let i = n - 2; i >= 0; i--) {
      centers[i] = Math.min(centers[i], centers[i + 1] - step);
    }

    const x = col === 'left' ? leftColX : rightColX;
    const lineX = col === 'left' ? x + tagWidth : x;

    for (let i = 0; i < n; i++) {
      const { label } = items[i];
      const centerY = centers[i];
      const y = centerY - tagHeight / 2;
      result.push({
        ...label,
        column: col,
        x,
        y,
        centerY,
        width: tagWidth,
        height: tagHeight,
        jointX: label.at[0],
        jointY: label.at[1],
        lineX,
        lineY: centerY
      });
    }
  }

  return result;
}
