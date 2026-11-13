import React from 'react';
import { ClientProfile } from '../../types';
import { effectiveStatus, formatDate, todayISO } from '../../lib/workouts';
import { formatWeight } from '../../lib/units';

const STATUS: Record<string, string> = {
  completed: 'bg-green-50 text-green-700',
  missed: 'bg-red-50 text-red-700',
  skipped: 'bg-gray-100 text-gray-500',
  planned: 'bg-gray-100 text-gray-500',
  'in-progress': 'bg-amber-50 text-amber-800'
};

/** Past sessions with what the client actually logged. */
export const WorkoutHistory: React.FC<{ client: ClientProfile }> = ({ client }) => {
  const today = todayISO();
  const past = (client.workouts ?? []).filter((w) => w.date <= today && w.blocks.length).sort((a, b) => b.date.localeCompare(a.date));
  if (!past.length) {
    return <div className="bg-white rounded-[28px] border border-gray-100 p-6 text-sm text-gray-500">No sessions yet.</div>;
  }
  return (
    <div className="space-y-3">
      {past.slice(0, 30).map((w) => {
        const st = effectiveStatus(w, today);
        return (
          <section key={w.id} className="bg-white rounded-[28px] border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <div className="text-sm font-bold text-[#111827]">{formatDate(w.date, { weekday: true })}</div>
                <div className="text-xs text-gray-500">{w.title || w.focus}</div>
              </div>
              <div className="flex items-center gap-2">
                {w.sessionRpe != null && <span className="text-xs text-gray-500">RPE {w.sessionRpe}</span>}
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize ${STATUS[st] ?? STATUS.planned}`}>{st.replace('-', ' ')}</span>
              </div>
            </div>
            <ul className="divide-y divide-gray-100">
              {w.blocks.map((b) => {
                const done = b.loggedSets.filter((s) => s.completed || s.reps != null);
                return (
                  <li key={b.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-[#111827] truncate">{b.name}</span>
                    <span className="text-xs text-gray-500 tabular-nums text-right">
                      {done.length
                        ? done.map((s) => `${s.kg ? formatWeight(s.kg) : 'BW'} × ${s.reps ?? '—'}`).join(' · ')
                        : `${b.sets} × ${b.reps} planned`}
                    </span>
                  </li>
                );
              })}
            </ul>
            {w.clientFeedback && <p className="text-xs text-gray-500 mt-2">Client: “{w.clientFeedback}”</p>}
          </section>
        );
      })}
    </div>
  );
};
