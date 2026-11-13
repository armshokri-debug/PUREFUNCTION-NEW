import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Target, MessageSquare } from 'lucide-react';
import { AssessmentSnapshot, ClientProfile } from '../../types';
import { ComparisonRow, compareAssessments, verdict } from '../../lib/assessments';
import { MeasureSheet } from './MeasureSheet';
import { formatDate } from '../../lib/workouts';
import { WEIGHT_UNIT, roundLb } from '../../lib/units';

const isWeightUnit = (unit: string) => unit === WEIGHT_UNIT || unit === 'kg';

const fmt = (v: number | null, unit: string) => {
  if (v == null) return '—';
  const val = isWeightUnit(unit) ? roundLb(v) : Number(v.toFixed(1));
  const u = isWeightUnit(unit) ? WEIGHT_UNIT : unit;
  return `${val}${u && u !== '%' && u !== '°' ? ' ' : ''}${u}`;
};

/** Pick any two saved assessments and see every number side by side. */
export const AssessmentHistory: React.FC<{
  assessments: AssessmentSnapshot[];
  /** with these the coach can add notes and goals per measure */
  client?: ClientProfile;
  onUpdateClient?: (c: ClientProfile) => void;
}> = ({ assessments, client, onUpdateClient }) => {
  const [editing, setEditing] = useState<ComparisonRow | null>(null);
  const canEdit = !!client && !!onUpdateClient;
  const [fromId, setFromId] = useState(assessments[0]?.id);
  const [toId, setToId] = useState(assessments[assessments.length - 1]?.id);
  const from = assessments.find((a) => a.id === fromId) ?? assessments[0];
  const to = assessments.find((a) => a.id === toId) ?? assessments[assessments.length - 1];
  if (!from || !to) return null;

  const label = (a: AssessmentSnapshot) => `Week ${a.week} · ${formatDate(a.date)}`;
  const rows = compareAssessments(from, to).filter((r) => r.before != null || r.after != null);
  const groups = [...new Set(rows.map((r) => r.group))];
  const single = assessments.length === 1;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-[#111827]">Assessments</h2>
          <p className="text-xs text-gray-500">
            {single
              ? 'First assessment saved. The next one will be compared with it here.'
              : `${assessments.length} saved · pick two to compare`}
          </p>
        </div>
        {!single && (
          <div className="flex items-center gap-2 text-sm">
            <select
              value={from.id}
              onChange={(e) => setFromId(e.target.value)}
              aria-label="Compare from"
              className="border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-[#111827]"
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {label(a)}
                </option>
              ))}
            </select>
            <span className="text-gray-400">→</span>
            <select
              value={to.id}
              onChange={(e) => setToId(e.target.value)}
              aria-label="Compare to"
              className="border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-[#111827]"
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {label(a)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No measurements entered in this assessment yet.</p>
      ) : (
        <div className="w-full min-w-0">
          <table className="pf-responsive-table pf-stack-table w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-400">
                <th className="text-left font-semibold py-2 px-4 sm:px-0">Measure</th>
                {!single && <th className="text-right font-semibold py-2 px-2">{label(from)}</th>}
                <th className="text-right font-semibold py-2 px-2">{label(to)}</th>
                {!single && <th className="text-right font-semibold py-2 pl-2 pr-4 sm:pr-0">Change</th>}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g}>
                <tr>
                  <td colSpan={4} className="pt-4 pb-1 px-4 sm:px-0 text-xs font-bold text-[#111827]">
                    {g}
                  </td>
                </tr>
                {rows
                  .filter((r) => r.group === g)
                  .map((r) => {
                    const v = verdict(r);
                    const rawD = r.before != null && r.after != null ? r.after - r.before : null;
                    const d = rawD != null && isWeightUnit(r.unit) ? roundLb(rawD) : rawD;
                    return (
                      <tr key={r.label} className="border-t border-gray-100">
                        <td data-label="Measure" className="py-2 px-4 sm:px-0 text-gray-700">
                          <div className="flex items-start gap-1.5">
                            <span className="flex-1">
                              {r.label}
                              {client?.goals?.some((g) => g.metricKey === r.key) && (
                                <Target className="inline w-3.5 h-3.5 ml-1 text-[#B45309] -mt-0.5" aria-label="has a goal" />
                              )}
                              {to.notes?.[r.key] && (
                                <span className="block text-xs text-gray-500 mt-0.5">“{to.notes[r.key]}”</span>
                              )}
                            </span>
                            {canEdit && (
                              <button
                                onClick={() => setEditing(r)}
                                aria-label={`Note or goal for ${r.label}`}
                                title="Note / goal"
                                className="p-1 -my-0.5 rounded-md text-gray-300 hover:text-[#111827] hover:bg-gray-100 cursor-pointer shrink-0"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        {!single && <td data-label="Before" className="py-2 px-2 text-right tabular-nums text-gray-500">{fmt(r.before, r.unit)}</td>}
                        <td data-label="After" className="py-2 px-2 text-right tabular-nums font-semibold text-[#111827]">{fmt(r.after, r.unit)}</td>
                        {!single && (
                          <td data-label="Change" className="py-2 pl-2 pr-4 sm:pr-0 text-right tabular-nums">
                            {d == null ? (
                              <span className="text-gray-300">—</span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-0.5 font-semibold ${
                                  v === 'better' ? 'text-[#16A34A]' : v === 'worse' ? 'text-[#DC2626]' : 'text-gray-400'
                                }`}
                              >
                                {v === 'same' ? (
                                  <Minus className="w-3.5 h-3.5" />
                                ) : d > 0 ? (
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                ) : (
                                  <ArrowDownRight className="w-3.5 h-3.5" />
                                )}
                                {d > 0 ? '+' : ''}
                                {Number(d.toFixed(1))}
                                {r.unit === '%' || r.unit === '°' ? r.unit : ''}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {canEdit && editing && (
        <MeasureSheet
          row={editing}
          assessment={to}
          client={client!}
          onSave={onUpdateClient!}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
};
