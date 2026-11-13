import React, { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, Trophy } from 'lucide-react';
import { ClientProfile } from '../../types';
import { measuresOf } from '../../lib/assessments';
import { Point, loggedExercises, measureSeries } from '../../lib/trends';
import { WEIGHT_UNIT, roundLb } from '../../lib/units';
import { estimated1RM, formatDate, parseISODate } from '../../lib/workouts';

type MeasureCategory = 'Range of Motion' | 'Symmetry' | 'Body measurements';

interface ClientMeasureOption {
  key: string;
  label: string;
  unit: string;
  better: 'up' | 'down';
  category: MeasureCategory;
  points: Point[];
}

interface StrengthSetEntry {
  weight: number;
  reps: number;
  e1rm: number;
}

interface StrengthSessionEntry {
  date: string;
  sets: StrengthSetEntry[];
  /** Best set in this session ranked fairly by Epley 1RM (weight × (1 + reps/30)) */
  bestSet: StrengthSetEntry;
}

const CATEGORY_ORDER: MeasureCategory[] = ['Range of Motion', 'Symmetry', 'Body measurements'];

/**
 * Formats a measurement value with its unit.
 * Never appends ° to non-angle values.
 */
function formatMeasureValue(value: number, unit: string, signed = false): string {
  const rounded = Number(value.toFixed(1));
  const prefix = signed && rounded > 0 ? '+' : '';
  if (!unit) return `${prefix}${rounded}`;
  if (unit === '°' || unit === '%') return `${prefix}${rounded}${unit}`;
  return `${prefix}${rounded} ${unit}`;
}

function formatWeightSet(weight: number, reps: number): string {
  const w = Number(weight.toFixed(1));
  return `${w} ${WEIGHT_UNIT} × ${reps}`;
}

function formatWeightOnly(weight: number, signed = false): string {
  const w = Number(weight.toFixed(1));
  const prefix = signed && w > 0 ? '+' : '';
  return `${prefix}${w} ${WEIGHT_UNIT}`;
}

/**
 * Collects all individual ROM (L/R), Symmetry, and Body measurements from
 * existing client assessments, skipping any measurement with 0 data points.
 */
function getClientMeasures(client: ClientProfile): ClientMeasureOption[] {
  const seen = new Map<string, Omit<ClientMeasureOption, 'points'>>();

  for (const a of client.assessments ?? []) {
    for (const m of measuresOf(a)) {
      if (m.group === 'Strength') continue;
      if (seen.has(m.key)) continue;

      let category: MeasureCategory = 'Body measurements';
      let unit = m.unit;

      if (m.key.startsWith('rom:')) {
        if (m.key.endsWith(':asym')) {
          category = 'Symmetry';
          unit = '%';
        } else {
          category = 'Range of Motion';
          unit = '°';
        }
      } else {
        category = 'Body measurements';
        if (unit === '°') unit = '';
        if (unit === 'kg') unit = WEIGHT_UNIT;
      }

      seen.set(m.key, {
        key: m.key,
        label: m.label,
        unit,
        better: m.better,
        category
      });
    }
  }

  const options: ClientMeasureOption[] = [];
  for (const meta of seen.values()) {
    const rawPoints = measureSeries(client, meta.key);
    const points =
      meta.unit === WEIGHT_UNIT
        ? rawPoints.map((p) => ({ ...p, value: roundLb(p.value) }))
        : rawPoints;
    if (points.length > 0) {
      options.push({ ...meta, points });
    }
  }

  return options.sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  );
}

/**
 * Collects chronological training sessions for a given exercise,
 * picking the best set per session ranked by Epley 1RM (or filtered to a specific rep count).
 */
function getExerciseSessions(
  client: ClientProfile,
  exerciseId: string,
  repFilter: number | 'all' = 'all'
): StrengthSessionEntry[] {
  const byDate = new Map<string, StrengthSetEntry[]>();

  for (const w of client.workouts ?? []) {
    for (const b of w.blocks) {
      if (b.exerciseId !== exerciseId) continue;
      for (const s of b.loggedSets) {
        if (!s.completed || !s.kg || !s.reps || s.kg <= 0 || s.reps <= 0) continue;
        if (repFilter !== 'all' && s.reps !== repFilter) continue;
        const weight = roundLb(s.kg);
        const e1rm = roundLb(estimated1RM(s.kg, s.reps));
        const list = byDate.get(w.date) ?? [];
        list.push({ weight, reps: s.reps, e1rm });
        byDate.set(w.date, list);
      }
    }
  }

  const sessions: StrengthSessionEntry[] = [];
  for (const [date, sets] of byDate.entries()) {
    if (sets.length === 0) continue;
    const bestSet = sets.reduce((best, cur) =>
      cur.e1rm > best.e1rm || (cur.e1rm === best.e1rm && cur.weight > best.weight) ? cur : best
    );
    sessions.push({ date, sets, bestSet });
  }

  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Movement & ROM line chart showing each point's value and date.
 * When there are more than 4 points, only draws SVG value/date labels on first and last points.
 */
const MeasureLineChart: React.FC<{
  points: Point[];
  unit: string;
  goal?: number;
  label: string;
}> = ({ points, unit, goal, label }) => {
  const W = 640;
  const H = 250;
  const pad = { l: 48, r: 36, t: 28, b: 44 };
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;

  const t = (d: string) => parseISODate(d).getTime();
  let x0 = t(sorted[0].date);
  let x1 = t(sorted[sorted.length - 1].date);
  if (x1 === x0) {
    x0 -= 3 * 86400000;
    x1 += 3 * 86400000;
  }

  const values = sorted.map((p) => p.value).concat(goal != null ? [goal] : []);
  let y0 = Math.min(...values);
  let y1 = Math.max(...values);
  const span = y1 - y0 || Math.max(1, Math.abs(y1) * 0.1);
  y0 -= span * 0.2;
  y1 += span * 0.2;

  const X = (d: string) => pad.l + ((t(d) - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const ticks = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15];

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${label} chart`}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="#F3F4F6" />
            <text x={pad.l - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#9CA3AF">
              {formatMeasureValue(v, unit)}
            </text>
          </g>
        ))}

        {goal != null && (
          <g>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={Y(goal)}
              y2={Y(goal)}
              stroke="#F59E0B"
              strokeWidth="1.5"
              strokeDasharray="6 5"
            />
            <text x={W - pad.r} y={Y(goal) - 5} fontSize="11" fontWeight="600" textAnchor="end" fill="#B45309">
              Goal {formatMeasureValue(goal, unit)}
            </text>
          </g>
        )}

        <polyline
          points={sorted.map((p) => `${X(p.date)},${Y(p.value)}`).join(' ')}
          fill="none"
          stroke="#111827"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {sorted.map((p, i) => {
          const cx = X(p.date);
          const cy = Y(p.value);
          const isFirst = i === 0;
          const isLast = i === sorted.length - 1;
          const showLabel = sorted.length <= 4 || isFirst || isLast;
          const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
          const dx = isFirst ? 4 : isLast ? -4 : 0;

          return (
            <g key={p.date + i}>
              <circle
                cx={cx}
                cy={cy}
                r={isFirst || isLast ? 5.5 : 4.5}
                fill={isFirst ? '#FFC809' : '#111827'}
                stroke="#fff"
                strokeWidth="2"
              >
                <title>
                  {formatDate(p.date)}: {formatMeasureValue(p.value, unit)}
                </title>
              </circle>
              {showLabel && (
                <>
                  <text
                    x={cx + dx}
                    y={cy - 10}
                    textAnchor={anchor}
                    fontSize="11"
                    fontWeight="700"
                    fill="#111827"
                  >
                    {formatMeasureValue(p.value, unit)}
                  </text>
                  <text
                    x={cx + dx}
                    y={H - 12}
                    textAnchor={anchor}
                    fontSize="10"
                    fill="#6B7280"
                  >
                    {formatDate(p.date)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Mobile-friendly dated points list so dates never collide on many assessments */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sorted.map((p, i) => (
          <span
            key={p.date + i}
            className="inline-flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-1 text-xs tabular-nums text-[#111827]"
          >
            <span className="text-gray-500">{formatDate(p.date)}:</span>
            <span className="font-semibold">{formatMeasureValue(p.value, unit)}</span>
          </span>
        ))}
      </div>
    </figure>
  );
};

/**
 * Strength line chart of weight over time with reps shown next to weight (e.g. "30 lb × 8").
 * When there are more than 4 points, only draws SVG labels on first and last points.
 */
const StrengthWeightChart: React.FC<{
  sessions: StrengthSessionEntry[];
  pbDate?: string;
  label: string;
}> = ({ sessions, pbDate, label }) => {
  const W = 640;
  const H = 250;
  const pad = { l: 52, r: 44, t: 28, b: 44 };
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;

  const t = (d: string) => parseISODate(d).getTime();
  let x0 = t(sorted[0].date);
  let x1 = t(sorted[sorted.length - 1].date);
  if (x1 === x0) {
    x0 -= 3 * 86400000;
    x1 += 3 * 86400000;
  }

  const values = sorted.map((s) => s.bestSet.weight);
  let y0 = Math.min(...values);
  let y1 = Math.max(...values);
  const span = y1 - y0 || Math.max(1, Math.abs(y1) * 0.1);
  y0 -= span * 0.2;
  y1 += span * 0.2;

  const X = (d: string) => pad.l + ((t(d) - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const ticks = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15];

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${label} weight chart`}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="#F3F4F6" />
            <text x={pad.l - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#9CA3AF">
              {formatWeightOnly(v)}
            </text>
          </g>
        ))}

        <polyline
          points={sorted.map((s) => `${X(s.date)},${Y(s.bestSet.weight)}`).join(' ')}
          fill="none"
          stroke="#111827"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {sorted.map((s, i) => {
          const cx = X(s.date);
          const cy = Y(s.bestSet.weight);
          const isFirst = i === 0;
          const isLast = i === sorted.length - 1;
          const isPb = pbDate === s.date;
          const showLabel = sorted.length <= 4 || isFirst || isLast;
          const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
          const dx = isFirst ? 4 : isLast ? -4 : 0;

          return (
            <g key={s.date + i}>
              <circle
                cx={cx}
                cy={cy}
                r={isPb ? 6 : isFirst || isLast ? 5.5 : 4.5}
                fill={isPb ? '#FFC809' : isFirst ? '#FFC809' : '#111827'}
                stroke="#111827"
                strokeWidth={isPb ? '2' : '1.5'}
              >
                <title>
                  {formatDate(s.date)}: {formatWeightSet(s.bestSet.weight, s.bestSet.reps)} (est. 1RM{' '}
                  {formatWeightOnly(s.bestSet.e1rm)})
                </title>
              </circle>
              {showLabel && (
                <>
                  <text
                    x={cx + dx}
                    y={cy - 10}
                    textAnchor={anchor}
                    fontSize="11"
                    fontWeight="700"
                    fill="#111827"
                  >
                    {formatWeightSet(s.bestSet.weight, s.bestSet.reps)}
                  </text>
                  <text
                    x={cx + dx}
                    y={H - 12}
                    textAnchor={anchor}
                    fontSize="10"
                    fill="#6B7280"
                  >
                    {formatDate(s.date)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Dated set chips below chart */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sorted.map((s, i) => (
          <span
            key={s.date + i}
            className="inline-flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-1 text-xs tabular-nums text-[#111827]"
          >
            <span className="text-gray-500">{formatDate(s.date)}:</span>
            <span className="font-semibold">{formatWeightSet(s.bestSet.weight, s.bestSet.reps)}</span>
          </span>
        ))}
      </div>
    </figure>
  );
};

export const ClientProgressCharts: React.FC<{
  client: ClientProfile;
}> = ({ client }) => {
  const measures = useMemo(() => getClientMeasures(client), [client]);
  const lifts = useMemo(() => loggedExercises(client), [client]);
  const [tab, setTab] = useState<'rom' | 'strength'>(measures.length ? 'rom' : 'strength');
  const [measureKey, setMeasureKey] = useState<string>(
    () =>
      measures.find((m) => m.category === 'Range of Motion')?.key ??
      measures[0]?.key ??
      ''
  );
  const [liftId, setLiftId] = useState(lifts[0]?.id);
  const [repFilter, setRepFilter] = useState<number | 'all'>('all');

  const measure = measures.find((m) => m.key === measureKey) ?? measures[0];
  const lift = lifts.find((l) => l.id === liftId) ?? lifts[0];

  // Strength derived stats (all hooks must run unconditionally before any early return)
  const allLiftSessions = useMemo(
    () => (lift ? getExerciseSessions(client, lift.id, 'all') : []),
    [client, lift]
  );

  // Distinct rep counts logged for this exercise so client can compare at same reps
  const availableReps = useMemo(() => {
    const set = new Set<number>();
    for (const sess of allLiftSessions) {
      for (const s of sess.sets) set.add(s.reps);
    }
    return [...set].sort((a, b) => a - b);
  }, [allLiftSessions]);

  const activeRepFilter =
    repFilter !== 'all' && availableReps.includes(repFilter) ? repFilter : 'all';

  const filteredSessions = useMemo(
    () => (lift ? getExerciseSessions(client, lift.id, activeRepFilter) : []),
    [client, lift, activeRepFilter]
  );

  // Personal Best across filtered sessions (ranked fairly by Epley 1RM, or top weight when at same reps)
  const personalBest = useMemo(() => {
    if (filteredSessions.length === 0) return null;
    return filteredSessions.reduce((best, cur) =>
      cur.bestSet.e1rm > best.bestSet.e1rm ||
      (cur.bestSet.e1rm === best.bestSet.e1rm && cur.bestSet.weight > best.bestSet.weight)
        ? cur
        : best
    );
  }, [filteredSessions]);

  if (!measures.length && !lifts.length) return null;

  const groupedMeasures = CATEGORY_ORDER.map((category) => ({
    category,
    items: measures.filter((m) => m.category === category)
  })).filter((g) => g.items.length > 0);

  const select =
    'border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-sm text-[#111827] w-full sm:w-auto max-w-full';

  // Movement & ROM derived stats
  const romPoints = measure?.points ?? [];
  const firstRom = romPoints[0];
  const latestRom = romPoints[romPoints.length - 1];
  const romDelta = firstRom && latestRom ? latestRom.value - firstRom.value : 0;
  const romImproved =
    measure && romPoints.length >= 2 && Math.abs(romDelta) > 1e-6
      ? (romDelta > 0) === (measure.better === 'up')
      : null;
  const rawRomGoal = measure
    ? client.goals?.find((g) => g.metricKey === measure.key)?.target
    : undefined;
  const romGoal =
    rawRomGoal != null && measure?.unit === WEIGHT_UNIT ? roundLb(rawRomGoal) : rawRomGoal;

  const firstSession = filteredSessions[0];
  const latestSession = filteredSessions[filteredSessions.length - 1];

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-[#111827]">Progress charts</h2>
        <div className="bg-gray-100 p-0.5 rounded-xl inline-flex" role="tablist">
          {(['rom', 'strength'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              disabled={t === 'rom' ? !measures.length : !lifts.length}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 ${
                tab === t ? 'bg-[#111827] text-white' : 'text-gray-600'
              }`}
            >
              {t === 'rom' ? 'Movement & ROM' : 'Strength'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'rom' ? (
        <div>
          <div className="mb-3">
            <select
              value={measure?.key ?? ''}
              onChange={(e) => setMeasureKey(e.target.value)}
              aria-label="Measurement"
              className={select}
            >
              {groupedMeasures.map((group) => (
                <optgroup key={group.category} label={group.category}>
                  {group.items.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {measure && romPoints.length === 1 && firstRom && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <div className="text-xs font-medium text-gray-500 mb-1">
                {measure.label} · {formatDate(firstRom.date)}
              </div>
              <div className="text-2xl font-bold text-[#111827] tabular-nums">
                {formatMeasureValue(firstRom.value, measure.unit)}
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                More data after your next assessment
              </p>
            </div>
          )}

          {measure && romPoints.length >= 2 && firstRom && latestRom && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-sm">
                <span className="font-semibold text-[#111827]">{measure.label}</span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
                    romImproved === null
                      ? 'text-gray-600'
                      : romImproved
                      ? 'text-[#16A34A]'
                      : 'text-[#DC2626]'
                  }`}
                >
                  {Math.abs(romDelta) < 1e-6 ? (
                    <Minus className="w-4 h-4" />
                  ) : romDelta > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {formatMeasureValue(firstRom.value, measure.unit)} →{' '}
                  {formatMeasureValue(latestRom.value, measure.unit)},{' '}
                  {formatMeasureValue(romDelta, measure.unit, true)}
                </span>
              </div>

              <MeasureLineChart
                points={romPoints}
                unit={measure.unit}
                goal={romGoal}
                label={measure.label}
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Exercise selector + Fair comparison filter (All reps via Epley 1RM vs Same reps) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              value={lift?.id ?? ''}
              onChange={(e) => {
                setLiftId(e.target.value);
                setRepFilter('all');
              }}
              aria-label="Exercise"
              className={select}
            >
              {lifts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.sessions} sessions)
                </option>
              ))}
            </select>

            {availableReps.length > 1 && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRepFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    activeRepFilter === 'all'
                      ? 'bg-[#111827] text-white'
                      : 'bg-gray-100 text-gray-600 hover:text-[#111827]'
                  }`}
                >
                  All reps (est. 1RM)
                </button>
                {availableReps.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRepFilter(r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer tabular-nums ${
                      activeRepFilter === r
                        ? 'bg-[#111827] text-white'
                        : 'bg-gray-100 text-gray-600 hover:text-[#111827]'
                    }`}
                  >
                    Same reps (×{r})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Personal Best Badge + Fair Comparison explanation */}
          {personalBest && (
            <div className="rounded-xl bg-[#FEF3C7]/60 border border-[#FFC809]/60 p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FFC809] text-[#111827] flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center bg-[#111827] text-[#FFC809] text-[11px] font-bold px-2 py-0.5 rounded-full">
                      Personal Best
                    </span>
                    <span className="text-xs font-medium text-gray-600">
                      Achieved {formatDate(personalBest.date)}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-[#111827] mt-0.5 tabular-nums">
                    {formatWeightSet(personalBest.bestSet.weight, personalBest.bestSet.reps)}
                    <span className="text-xs font-semibold text-[#92400E] ml-2">
                      · est. 1RM {formatWeightOnly(personalBest.bestSet.e1rm)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-gray-600">
                {activeRepFilter === 'all'
                  ? 'Ranked fairly by Estimated 1RM (Epley: weight × (1 + reps/30))'
                  : `Comparing sets at ${activeRepFilter} reps`}
              </div>
            </div>
          )}

          {/* Chart or 1-session card */}
          {filteredSessions.length === 1 && firstSession && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <div className="text-xs font-medium text-gray-500 mb-1">
                {lift?.name} · {formatDate(firstSession.date)}
              </div>
              <div className="text-xl font-bold text-[#111827] tabular-nums">
                {formatWeightSet(firstSession.bestSet.weight, firstSession.bestSet.reps)}
                <span className="text-xs font-semibold text-gray-500 ml-2">
                  (est. 1RM {formatWeightOnly(firstSession.bestSet.e1rm)})
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                More data after your next logged session
              </p>
            </div>
          )}

          {filteredSessions.length >= 2 && firstSession && latestSession && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-sm">
                <span className="font-semibold text-[#111827]">
                  {lift?.name} — top set weight ({WEIGHT_UNIT} × reps)
                </span>
                <span className="text-xs font-semibold text-[#111827] tabular-nums">
                  {formatWeightSet(firstSession.bestSet.weight, firstSession.bestSet.reps)} →{' '}
                  {formatWeightSet(latestSession.bestSet.weight, latestSession.bestSet.reps)} (est. 1RM{' '}
                  {formatWeightOnly(latestSession.bestSet.e1rm - firstSession.bestSet.e1rm, true)})
                </span>
              </div>

              <StrengthWeightChart
                sessions={filteredSessions}
                pbDate={personalBest?.date}
                label={lift?.name ?? 'Exercise'}
              />
            </div>
          )}

          {/* Training History List */}
          {filteredSessions.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Training History
                </h3>
                <span className="text-[11px] text-gray-400">
                  Epley 1RM = weight × (1 + reps/30)
                </span>
              </div>
              <ul className="divide-y divide-gray-100">
                {[...filteredSessions].reverse().map((sess) => {
                  const isPbSession = personalBest?.date === sess.date;
                  return (
                    <li
                      key={sess.date}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#111827] tabular-nums">
                          {formatDate(sess.date)}
                        </span>
                        {isPbSession && (
                          <span className="inline-flex items-center gap-1 bg-[#FFC809] text-[#111827] text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Personal Best
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                        {sess.sets.map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[#111827] font-medium"
                          >
                            {formatWeightSet(s.weight, s.reps)}
                          </span>
                        ))}
                        <span className="text-gray-500 font-semibold ml-1">
                          est. 1RM {formatWeightOnly(sess.bestSet.e1rm)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
