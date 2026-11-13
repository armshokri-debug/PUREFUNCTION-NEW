import React, { useMemo, useState } from 'react';
import { ClientProfile } from '../types';
import { ExerciseVideoPlayer } from './ExerciseMedia';
import { formatDate } from '../lib/workouts';

/** Same movement + angle from two assessments, side by side. */
export const BeforeAfter: React.FC<{ client: ClientProfile }> = ({ client }) => {
  const withClips = (client.assessments ?? []).filter((a) => a.clips?.length);
  const combos = useMemo(() => {
    const m = new Map<string, { movement: string; angle: string }>();
    for (const a of withClips) for (const c of a.clips!) m.set(`${c.movement}|${c.angle}`, { movement: c.movement, angle: c.angle });
    return [...m.entries()];
  }, [withClips]);
  const [combo, setCombo] = useState(combos[0]?.[0]);
  if (!combos.length) return null;
  const key = combos.some(([k]) => k === combo) ? combo! : combos[0][0];
  const [movement, angle] = key.split('|');
  const matches = withClips
    .map((a) => ({ a, clip: a.clips!.find((c) => c.movement === movement && c.angle === angle) }))
    .filter((x) => x.clip);
  const before = matches[0];
  const after = matches.length > 1 ? matches[matches.length - 1] : undefined;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-[#111827]">Before / after</h2>
        <select
          value={key}
          onChange={(e) => setCombo(e.target.value)}
          aria-label="Movement"
          className="border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-sm text-[#111827]"
        >
          {combos.map(([k, v]) => (
            <option key={k} value={k}>
              {v.movement} · {v.angle}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[before, after].map((x, i) =>
          x ? (
            <div key={i}>
              <div className="text-xs font-semibold text-gray-500 mb-1.5">
                {i === 0 ? 'Before' : 'After'} · Week {x.a.week} · {formatDate(x.a.date)}
              </div>
              <ExerciseVideoPlayer video={x.clip!.video} title={`${movement} ${angle} week ${x.a.week}`} />
            </div>
          ) : (
            <div key={i} className="rounded-xl border border-dashed border-gray-300 aspect-video flex items-center justify-center text-sm text-gray-400 text-center px-4">
              Film the same movement and angle in the next assessment to compare.
            </div>
          )
        )}
      </div>
    </section>
  );
};
