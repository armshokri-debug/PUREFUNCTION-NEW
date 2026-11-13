import React from 'react';
import { Target, Trophy, Trash2 } from 'lucide-react';
import { AssessmentSnapshot, Goal } from '../../types';
import { goalStatus } from '../../lib/assessments';
import { formatDate } from '../../lib/workouts';
import { WEIGHT_UNIT, formatWeight } from '../../lib/units';

const fmt = (v: number | null, unit: string) => {
  if (v == null) return '—';
  if (unit === WEIGHT_UNIT || unit === 'kg') return formatWeight(v);
  return `${Number(v.toFixed(1))}${unit === '%' || unit === '°' ? unit : unit ? ` ${unit}` : ''}`;
};

/** Goals with live progress from the latest assessment. Read-only when onDelete is not given. */
export const GoalsPanel: React.FC<{
  goals: Goal[];
  assessments: AssessmentSnapshot[];
  onDelete?: (id: string) => void;
  emptyText?: string;
}> = ({ goals, assessments, onDelete, emptyText }) => {
  if (!goals.length && !emptyText) return null;
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6 mb-6">
      <h2 className="text-lg font-bold text-[#111827] mb-1 flex items-center gap-2">
        <Target className="w-5 h-5 text-[#B45309]" /> Goals
      </h2>
      {!goals.length ? (
        <p className="text-sm text-gray-500">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {goals.map((g) => {
            const st = goalStatus(g, assessments);
            return (
              <li key={g.id} className="py-3.5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#111827]">
                      {g.label}: {fmt(g.start, g.unit)} → {fmt(g.target, g.unit)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Now {fmt(st.current, g.unit)}
                      {st.asOf ? ` (${formatDate(st.asOf)})` : ''}
                      {g.dueDate ? ` · by ${formatDate(g.dueDate)}` : ''}
                    </div>
                    {g.note && <div className="text-xs text-gray-600 mt-1">{g.note}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {st.achieved ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#166534] bg-[#DCFCE7] px-2.5 py-1 rounded-full">
                        <Trophy className="w-3.5 h-3.5" /> Achieved
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-[#111827] tabular-nums">{st.percent}%</span>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(g.id)}
                        aria-label={`Remove goal ${g.label}`}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden" role="progressbar" aria-valuenow={st.percent} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className={`h-full rounded-full ${st.achieved ? 'bg-[#16A34A]' : 'bg-[#FFC809]'}`}
                    style={{ width: `${st.percent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
