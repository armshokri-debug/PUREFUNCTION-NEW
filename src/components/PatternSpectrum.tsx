import React, { useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { ClientProfile } from '../types';
import { SPECTRUM, patternSpectrum } from '../lib/patterns';
import { addDays, todayISO } from '../lib/workouts';
import { useExerciseLibrary } from '../state/ExerciseLibrary';

const RANGES = {
  last4: { label: 'Last 4 weeks', from: -27, to: 0 },
  last8: { label: 'Last 8 weeks', from: -55, to: 0 },
  next4: { label: 'Next 4 weeks (plan)', from: 0, to: 27 }
} as const;

/** Spectrum of movement patterns: radar of sets per family + planes + balance tips. */
export const PatternSpectrum: React.FC<{ client: ClientProfile }> = ({ client }) => {
  const { getExercise } = useExerciseLibrary();
  const [range, setRange] = useState<keyof typeof RANGES>('last4');
  const [mode, setMode] = useState<'planned' | 'done'>('planned');
  const today = todayISO();
  const r = RANGES[range];
  const spec = useMemo(
    () => patternSpectrum(client, getExercise, addDays(today, r.from), addDays(today, r.to), mode),
    [client, getExercise, today, r.from, r.to, mode]
  );

  // radar geometry
  const S = 300;
  const c = S / 2;
  const R = 105;
  const max = Math.max(1, ...SPECTRUM.map((k) => spec.sets[k]));
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / SPECTRUM.length;
    return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v] as const;
  };
  const poly = SPECTRUM.map((k, i) => pt(i, spec.sets[k] / max).join(',')).join(' ');
  const planeTotal = Object.values(spec.planes).reduce((a, b) => a + b, 0);

  const select = 'border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-sm text-[#111827]';

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold text-[#111827]">Spectrum of patterns</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select value={range} onChange={(e) => setRange(e.target.value as keyof typeof RANGES)} aria-label="Period" className={select}>
            {Object.entries(RANGES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <div className="bg-gray-100 p-0.5 rounded-xl inline-flex" role="tablist" aria-label="Count">
            {(['planned', 'done'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${mode === m ? 'bg-[#111827] text-white' : 'text-gray-600'}`}
              >
                {m === 'planned' ? 'Programmed' : 'Completed'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {mode === 'planned' ? 'Programmed' : 'Completed'} sets per movement family — gaps show what the program is missing.
      </p>

      {spec.total === 0 ? (
        <p className="text-sm text-gray-500 py-6">No {mode === 'planned' ? 'programmed' : 'completed'} sets in this period.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <svg viewBox={`-36 0 ${S + 72} ${S}`} className="w-full max-w-[380px] mx-auto h-auto" role="img" aria-label="Movement pattern radar">
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <polygon
                key={f}
                points={SPECTRUM.map((_, i) => pt(i, f).join(',')).join(' ')}
                fill="none"
                stroke="#E5E7EB"
              />
            ))}
            {SPECTRUM.map((_, i) => {
              const [x, y] = pt(i, 1);
              return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#F3F4F6" />;
            })}
            <polygon points={poly} fill="#FFC809" fillOpacity="0.35" stroke="#F5B800" strokeWidth="2" />
            {SPECTRUM.map((k, i) => {
              const [x, y] = pt(i, 1.24);
              const zero = spec.sets[k] === 0;
              return (
                <g key={k}>
                  <text x={x} y={y - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={zero ? '#DC2626' : '#111827'}>
                    {k === 'Mobility & breathing' ? 'Mobility' : k}
                  </text>
                  <text x={x} y={y + 9} textAnchor="middle" fontSize="10" fill={zero ? '#DC2626' : '#6B7280'}>
                    {spec.sets[k]} sets
                  </text>
                </g>
              );
            })}
          </svg>

          <div>
            {planeTotal > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-[#111827] mb-2">Planes of motion</div>
                {(Object.entries(spec.planes) as [string, number][]).map(([p, n]) => (
                  <div key={p} className="flex items-center gap-2 mb-1.5">
                    <span className="w-24 text-xs text-gray-600">{p}</span>
                    <div className="flex-1 h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                      <div className="h-full bg-[#111827] rounded-full" style={{ width: `${(n / planeTotal) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums text-gray-500">{Math.round((n / planeTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
            {spec.insights.length > 0 && (
              <ul className="space-y-1.5">
                {spec.insights.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-gray-700">
                    <Lightbulb className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
            {spec.unclassified > 0 && (
              <p className="text-[11px] text-gray-400 mt-2">{spec.unclassified} sets couldn’t be classified (set a pattern on those exercises in the Library).</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
