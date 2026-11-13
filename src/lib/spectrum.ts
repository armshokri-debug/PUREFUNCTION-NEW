import { ClientProfile, RomMovement } from '../types';
import { MOVEMENTS, Severity, latestRom, rateRom, romFor, sideDifference } from './bodyModel';

export interface ClientFinding {
  key: string;
  label: string;
  left: number | null;
  right: number | null;
  full: number;
  sideLimited: 'none' | 'L' | 'R' | 'both';
  worse: 'L' | 'R' | null;
  severity: Severity;
  diffText: string;
}

export type PatternKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type RowResult =
  | 'none'
  | 'L'
  | 'R'
  | 'Both(L)'
  | 'Both(R)'
  | 'Balanced'
  | 'Left sup/Right pron'
  | 'Right more supinated';

export interface SpectrumPatternDef {
  key: PatternKey;
  code: PatternKey;
  label: string;
  shortLabel: string;
}

export const SPECTRUM_PATTERNS: SpectrumPatternDef[] = [
  { key: 'A', code: 'A', label: 'Functionally Left Lateralized', shortLabel: 'Func. Left' },
  { key: 'B', code: 'B', label: 'In-Tact Left Lateralized', shortLabel: 'In-Tact Left' },
  { key: 'C', code: 'C', label: 'Incomplete Left Lateralization', shortLabel: 'Incomp. Left' },
  { key: 'D', code: 'D', label: 'Incomplete Right Lateralization', shortLabel: 'Incomp. Right' },
  { key: 'E', code: 'E', label: 'In-Tact Right Lateralized', shortLabel: 'In-Tact Right' },
  { key: 'F', code: 'F', label: 'Functionally Right Lateralized', shortLabel: 'Func. Right' }
];

export type SpectrumRowKind = 'degrees' | 'obers' | 'foot';

export interface SpectrumRowDef {
  id: string;
  label: string;
  kind: SpectrumRowKind;
  full: number | string;
  romName?: string;
  expected: Record<PatternKey, RowResult>;
  displayExpected?: Partial<Record<PatternKey, string>>;
}

export const FOOT_OPTIONS = [
  'Balanced',
  'Left supination-right pronation',
  'Right relatively more supinated'
] as const;

export const OBERS_OPTIONS = ['Knee to table', 'Limited'] as const;

export const SPECTRUM_ROWS: SpectrumRowDef[] = [
  {
    id: 'shoulder-ir',
    label: 'Shoulder IR',
    kind: 'degrees',
    full: 90,
    romName: 'Shoulder internal rotation',
    expected: { A: 'none', B: 'L', C: 'Both(L)', D: 'Both(R)', E: 'R', F: 'none' }
  },
  {
    id: 'shoulder-er',
    label: 'Shoulder ER',
    kind: 'degrees',
    full: 90,
    romName: 'Shoulder external rotation',
    expected: { A: 'none', B: 'R', C: 'Both(R)', D: 'Both(L)', E: 'L', F: 'none' }
  },
  {
    id: 'shoulder-abd',
    label: 'Shoulder Abduction',
    kind: 'degrees',
    full: 45,
    romName: 'Shoulder abduction',
    expected: { A: 'none', B: 'R', C: 'Both(R)', D: 'Both(L)', E: 'L', F: 'none' }
  },
  {
    id: 'shoulder-flex',
    label: 'Shoulder Flexion',
    kind: 'degrees',
    full: 140,
    romName: 'Shoulder flexion',
    expected: { A: 'none', B: 'R', C: 'Both(R)', D: 'Both(L)', E: 'L', F: 'none' }
  },
  {
    id: 'trunk-rot',
    label: 'Trunk Rotation',
    kind: 'degrees',
    full: 70,
    romName: 'Trunk rotation',
    expected: { A: 'none', B: 'R', C: 'Both(R)', D: 'Both(L)', E: 'L', F: 'none' },
    displayExpected: { B: 'R (knees right)', E: 'L (knees left)' }
  },
  {
    id: 'obers',
    label: "Ober's (Hip Adduction)",
    kind: 'obers',
    full: 'Knee to table',
    expected: { A: 'none', B: 'R', C: 'Both(R)', D: 'Both(L)', E: 'L', F: 'none' }
  },
  {
    id: 'hip-abd',
    label: 'Hip Abduction',
    kind: 'degrees',
    full: 45,
    romName: 'Hip abduction',
    expected: { A: 'none', B: 'L', C: 'Both(L)', D: 'Both(R)', E: 'R', F: 'none' }
  },
  {
    id: 'hip-flex',
    label: 'Hip Flexion',
    kind: 'degrees',
    full: 140,
    romName: 'Hip flexion',
    expected: { A: 'none', B: 'L', C: 'Both(L)', D: 'Both(R)', E: 'R', F: 'none' }
  },
  {
    id: 'slr',
    label: 'Straight Leg Raise',
    kind: 'degrees',
    full: 90,
    romName: 'Straight leg raise',
    expected: { A: 'none', B: 'R', C: 'Both(R)', D: 'Both(L)', E: 'L', F: 'none' }
  },
  {
    id: 'hip-ir',
    label: 'Hip IR',
    kind: 'degrees',
    full: 40,
    romName: 'Hip internal rotation',
    expected: { A: 'none', B: 'R', C: 'Both(R)', D: 'Both(L)', E: 'L', F: 'none' }
  },
  {
    id: 'hip-er',
    label: 'Hip ER',
    kind: 'degrees',
    full: 45,
    romName: 'Hip external rotation',
    expected: { A: 'none', B: 'L', C: 'Both(L)', D: 'Both(R)', E: 'R', F: 'none' }
  },
  {
    id: 'foot',
    label: 'Foot Presentation',
    kind: 'foot',
    full: 'Balanced',
    expected: {
      A: 'Balanced',
      B: 'Left sup/Right pron',
      C: 'Left sup/Right pron',
      D: 'Right more supinated',
      E: 'Right more supinated',
      F: 'Balanced'
    }
  }
];

export type SpectrumEntry = { left?: number | string; right?: number | string };
export type SpectrumTestsMap = Record<string, SpectrumEntry>;

/**
 * Merge saved spectrumTests with pre-filled values from latestRom(client)
 * when a matching ROM test exists and the coach hasn't overridden it.
 */
export function resolveSpectrumTests(
  client: Pick<ClientProfile, 'rom' | 'assessments' | 'spectrumTests'>,
  romOverride?: RomMovement[]
): SpectrumTestsMap {
  const rom = romOverride ?? latestRom(client as ClientProfile);
  const saved = client.spectrumTests ?? {};
  const out: SpectrumTestsMap = {};

  for (const row of SPECTRUM_ROWS) {
    const s = saved[row.id];
    const matchedRom = row.romName ? romFor(rom, row.romName) : undefined;
    // A saved blank explicitly clears that side; never refill it from ROM.
    // ROM defaults of zero mean "not entered". A saved zero is a real measurement.
    const left = resolvedSide(s, 'left', matchedRom?.left, row.kind);
    const right = resolvedSide(s, 'right', matchedRom?.right, row.kind);
    if (left !== undefined || right !== undefined) {
      out[row.id] = { left, right };
    }
  }
  return out;
}

function toNum(v: number | string | undefined): number | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 180 ? n : null;
}

/** Browser input guard: only whole degrees from 0 through 180 can be saved. */
export function parseDegreeInput(raw: string): number | null {
  if (!/^(0|[1-9]\d*)$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n <= 180 ? n : null;
}

function resolvedSide(
  saved: SpectrumEntry | undefined,
  side: 'left' | 'right',
  romValue: number | undefined,
  kind: SpectrumRowKind = 'degrees'
): number | string | undefined {
  const hasSaved = saved != null && Object.prototype.hasOwnProperty.call(saved, side);
  const value = hasSaved ? saved![side] : romValue;
  if (kind !== 'degrees') return value === '' ? undefined : value;
  // Negative, non-numeric and out-of-range historical values are unmeasured.
  const parsed = toNum(value);
  if (parsed === null || (!hasSaved && parsed === 0)) return undefined;
  return parsed;
}

export function buildDegreeFinding(
  key: string,
  label: string,
  left: number | null,
  right: number | null,
  full: number
): ClientFinding {
  const lLim = left !== null && rateRom(left, full) !== 'ok';
  const rLim = right !== null && rateRom(right, full) !== 'ok';

  let sideLimited: 'none' | 'L' | 'R' | 'both' = 'none';
  if (lLim && rLim) sideLimited = 'both';
  else if (lLim) sideLimited = 'L';
  else if (rLim) sideLimited = 'R';

  // Never invent a comparison if only one side has been measured.
  let worse: 'L' | 'R' | null = null;
  if (left !== null && right !== null) {
    if (sideLimited === 'L') worse = 'L';
    else if (sideLimited === 'R') worse = 'R';
    else if (sideLimited === 'both') worse = left <= right ? 'L' : 'R';
    else if (Math.round(Math.abs(left - right)) >= 1) worse = left < right ? 'L' : 'R';
  }

  const measured = [left, right].filter((n): n is number => n !== null);
  const severity = rateRom(Math.min(...measured), full);
  const diffText = left === null ? 'Only Right measured'
    : right === null ? 'Only Left measured'
      : sideDifference(left, right);

  return {
    key,
    label,
    left,
    right,
    full,
    sideLimited,
    worse,
    severity,
    diffText
  };
}

/**
 * Single source of truth for all measured degree tests on a client.
 * Reads from client.spectrumTests first, then latestRom(client) as fallback.
 * Uses the unified rating rule: limited = value < 90% of Full;
 * severity: ok >= 90%, watch >= 70%, work < 70%.
 */
export function clientFindings(
  client: Pick<ClientProfile, 'rom' | 'assessments' | 'spectrumTests'>
): ClientFinding[] {
  const rom = latestRom(client as ClientProfile);
  const resolved = resolveSpectrumTests(client, rom);
  const findings: ClientFinding[] = [];
  const seenKeys = new Set<string>();

  for (const row of SPECTRUM_ROWS) {
    if (row.kind !== 'degrees') continue;
    const entry = resolved[row.id];
    const l = toNum(entry?.left);
    const r = toNum(entry?.right);
    if (l === null && r === null) continue;
    const full = Number(row.full);
    findings.push(buildDegreeFinding(row.id, row.label, l, r, full));
    seenKeys.add(row.id);
  }

  // Also include any additional measured movements in MOVEMENTS (e.g. Ankle dorsiflexion)
  const saved = client.spectrumTests ?? {};
  for (const m of MOVEMENTS) {
    if (seenKeys.has(m.sopKey)) continue;
    const s = saved[m.sopKey];
    const matchedRom = romFor(rom, m.romName);
    const l = toNum(resolvedSide(s, 'left', matchedRom?.left));
    const r = toNum(resolvedSide(s, 'right', matchedRom?.right));
    if (l === null && r === null) continue;
    const full = m.normal;
    findings.push(buildDegreeFinding(m.sopKey, m.label, l, r, full));
    seenKeys.add(m.sopKey);
  }

  return findings;
}

/**
 * Classify a single row into its actual limitation result, or null if not measured.
 * - Degree rows: limited when < 90% of Full (e.g. < 81° when Full is 90°).
 * - Ober's: limited when 'Limited'.
 * - Foot presentation: maps selection to 'Balanced' | 'Left sup/Right pron' | 'Right more supinated'.
 */
export function classifyRow(row: SpectrumRowDef, entry?: SpectrumEntry): RowResult | null {
  if (!entry) return null;

  if (row.kind === 'foot') {
    const raw = String(entry.left ?? entry.right ?? '').trim();
    if (!raw) return null;
    if (raw === 'Balanced') return 'Balanced';
    if (raw === 'Left supination-right pronation' || raw === 'Left sup/Right pron') {
      return 'Left sup/Right pron';
    }
    if (raw === 'Right relatively more supinated' || raw === 'Right more supinated') {
      return 'Right more supinated';
    }
    return null;
  }

  if (row.kind === 'obers') {
    const lRaw = String(entry.left ?? '').trim();
    const rRaw = String(entry.right ?? '').trim();
    if (!lRaw && !rRaw) return null;
    const lLim = lRaw === 'Limited';
    const rLim = rRaw === 'Limited';
    if (!lLim && !rLim) return 'none';
    if (lLim && !rLim) return 'L';
    if (!lLim && rLim) return 'R';
    return 'Both(L)';
  }

  const l = toNum(entry.left);
  const r = toNum(entry.right);
  if (l === null && r === null) return null;

  const full = Number(row.full);
  const f = buildDegreeFinding(row.id, row.label, l, r, full);
  const lLim = l !== null && rateRom(l, full) !== 'ok';
  const rLim = r !== null && rateRom(r, full) !== 'ok';

  if (!lLim && !rLim) return 'none';
  if (lLim && !rLim) return 'L';
  if (!lLim && rLim) return 'R';
  return f.worse === 'L' ? 'Both(L)' : 'Both(R)';
}

function isBothResult(res: RowResult | null): res is 'Both(L)' | 'Both(R)' {
  return res === 'Both(L)' || res === 'Both(R)';
}

/**
 * Score how well a row's actual result matches a column's expected result:
 * - 1 point for an exact match
 * - 0.5 points when both are Both(...) with the opposite worse side
 * - 0 otherwise
 */
export function scoreCellMatch(actual: RowResult | null, expected: RowResult): number {
  if (!actual) return 0;
  if (actual === expected) return 1;
  if (isBothResult(actual) && isBothResult(expected)) return 0.5;
  return 0;
}

export interface SpectrumEvaluation {
  rowResults: Record<string, RowResult | null>;
  scores: Record<PatternKey, number>;
  measuredCount: number;
  bestPattern: SpectrumPatternDef | null;
  bestScore: number;
  summaryText: string;
}

/**
 * Evaluate all 12 SOP rows and compute pattern scores A–F and the best match.
 */
export function evaluateSpectrum(tests: SpectrumTestsMap): SpectrumEvaluation {
  const rowResults: Record<string, RowResult | null> = {};
  const scores: Record<PatternKey, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  let measuredCount = 0;

  for (const row of SPECTRUM_ROWS) {
    const res = classifyRow(row, tests[row.id]);
    rowResults[row.id] = res;
    if (res !== null) {
      measuredCount += 1;
      for (const pat of SPECTRUM_PATTERNS) {
        scores[pat.key] += scoreCellMatch(res, row.expected[pat.key]);
      }
    }
  }

  if (measuredCount === 0) {
    return {
      rowResults,
      scores,
      measuredCount: 0,
      bestPattern: null,
      bestScore: 0,
      summaryText: 'No tests entered yet'
    };
  }

  let bestPattern = SPECTRUM_PATTERNS[0];
  let bestScore = scores[bestPattern.key];
  for (const pat of SPECTRUM_PATTERNS) {
    if (scores[pat.key] > bestScore) {
      bestScore = scores[pat.key];
      bestPattern = pat;
    }
  }

  const scoreStr = Number.isInteger(bestScore) ? String(bestScore) : bestScore.toFixed(1);
  return {
    rowResults,
    scores,
    measuredCount,
    bestPattern,
    bestScore,
    summaryText: `${scoreStr} / ${measuredCount} tests matched — Best match: ${bestPattern.label}`
  };
}
