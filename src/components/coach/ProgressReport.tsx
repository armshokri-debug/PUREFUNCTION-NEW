import React, { useMemo, useState } from 'react';
import { Printer, Trophy, ArrowUpRight, ArrowDownRight, Minus, CheckCircle2 } from 'lucide-react';
import { AssessmentSnapshot, ClientProfile } from '../../types';
import { buildReport } from '../../lib/report';
import { verdict } from '../../lib/assessments';
import { formatDate } from '../../lib/workouts';
import { WEIGHT_UNIT, formatWeight, roundLb } from '../../lib/units';
import { ClientAvatar, PureFunctionLogo } from '../VisualAssets';
import { ExerciseVideoPlayer } from '../ExerciseMedia';

const isWeightUnit = (unit: string) => unit === WEIGHT_UNIT || unit === 'kg';

const fmt = (v: number | null, unit: string) => {
  if (v == null) return '—';
  if (isWeightUnit(unit)) return formatWeight(v);
  return `${Number(v.toFixed(1))}${unit === '%' || unit === '°' ? unit : unit ? ` ${unit}` : ''}`;
};

/**
 * Progress report between two real assessments (default: first → latest):
 * highlights, goals, training adherence, new records, every measure, before/after
 * video and the coach's summary. Printable / save as PDF.
 */
export const ProgressReport: React.FC<{
  clients: ClientProfile[];
  client: ClientProfile;
  onSelectClientId: (id: string) => void;
  onUpdateClient?: (c: ClientProfile) => void;
}> = ({ clients, client, onSelectClientId, onUpdateClient }) => {
  const list = client.assessments ?? [];
  const [fromId, setFromId] = useState(list[0]?.id);
  const [toId, setToId] = useState(list[list.length - 1]?.id);
  const from = list.find((a) => a.id === fromId) ?? list[0];
  const to = list.find((a) => a.id === toId) ?? list[list.length - 1];
  const report = useMemo(() => buildReport(client, from, to), [client, from, to]);

  const notes = to.notes ?? {};
  const setNote = (key: string, text: string) => {
    if (!onUpdateClient) return;
    const assessments = list.map((a) => (a.id === to.id ? { ...a, notes: { ...(a.notes ?? {}), [key]: text } } : a));
    onUpdateClient({ ...client, assessments });
  };

  const label = (a: AssessmentSnapshot) => `Week ${a.week} · ${formatDate(a.date)}`;
  const pairs = (to.clips ?? [])
    .map((c) => ({ after: c, before: (from.clips ?? []).find((b) => b.movement === c.movement && b.angle === c.angle) }))
    .filter((p) => p.before && from.id !== to.id);
  const groups = [...new Set(report.rows.map((r) => r.group))];
  const card = 'bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 break-inside-avoid';
  const select = 'border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-sm text-[#111827]';

  return (
    <div className="max-w-4xl mx-auto">
      {/* controls (not printed) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-5">
        <select value={client.id} onChange={(e) => onSelectClientId(e.target.value)} aria-label="Client" className={`${select} font-semibold`}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <select value={from.id} onChange={(e) => setFromId(e.target.value)} aria-label="Report from" className={select}>
            {list.map((a) => (
              <option key={a.id} value={a.id}>
                {label(a)}
              </option>
            ))}
          </select>
          <span className="text-gray-400">→</span>
          <select value={to.id} onChange={(e) => setToId(e.target.value)} aria-label="Report to" className={select}>
            {list.map((a) => (
              <option key={a.id} value={a.id}>
                {label(a)}
              </option>
            ))}
          </select>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 bg-[#111827] text-white text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer">
            <Printer className="w-4 h-4" /> Print / PDF
          </button>
        </div>
      </div>

      <article className="space-y-4" aria-label="Progress report">
        {/* header */}
        <header className={`${card} flex flex-wrap items-center justify-between gap-4`}>
          <div className="flex items-center gap-3">
            <ClientAvatar name={client.name} photoUrl={client.photoUrl} size="lg" />
            <div>
              <div className="text-xs font-semibold text-gray-500">
                {from.id === to.id ? 'Baseline report' : `Month ${report.month} progress report`}
              </div>
              <h1 className="text-2xl font-bold text-[#111827]">{client.name}</h1>
              <div className="text-sm text-gray-500">
                {formatDate(from.date)} → {formatDate(to.date)} · Week {from.week} → {to.week}
              </div>
            </div>
          </div>
          <PureFunctionLogo />
        </header>

        {/* highlights */}
        {report.highlights.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {report.highlights.map((h) => (
              <div key={h.key} className={card}>
                <div className="text-xs text-gray-500 mb-1">{h.label}</div>
                <div className="text-xl font-bold text-[#111827] tabular-nums">
                  {fmt(h.before, h.unit)} → {fmt(h.after, h.unit)}
                </div>
                <div className="text-xs font-semibold text-[#16A34A] mt-0.5">Improved</div>
              </div>
            ))}
          </div>
        )}

        {/* goals + training */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className={card}>
            <h2 className="text-sm font-bold text-[#111827] mb-2">Goals</h2>
            {report.goals.length === 0 ? (
              <p className="text-sm text-gray-500">No goals set.</p>
            ) : (
              <ul className="space-y-2">
                {report.goals.map(({ goal, status }) => (
                  <li key={goal.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#111827]">
                        {goal.label}: {fmt(goal.start, goal.unit)} → {fmt(goal.target, goal.unit)}
                      </span>
                      {status.achieved ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#166534]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Achieved
                        </span>
                      ) : (
                        <span className="text-xs font-semibold tabular-nums">{status.percent}%</span>
                      )}
                    </div>
                    <div className="h-1.5 bg-[#E5E7EB] rounded-full mt-1 overflow-hidden">
                      <div className={`h-full ${status.achieved ? 'bg-[#16A34A]' : 'bg-[#FFC809]'}`} style={{ width: `${status.percent}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold text-[#111827] mb-2">Training</h2>
            <div className="text-sm text-gray-700 mb-2">
              Sessions completed:{' '}
              <b className="text-[#111827]">
                {report.sessions.completed} / {report.sessions.scheduled}
              </b>
              {report.sessions.percent != null && ` (${report.sessions.percent}%)`}
            </div>
            {report.newRecords.length > 0 ? (
              <ul className="space-y-1">
                {report.newRecords.map(({ record, previous }) => (
                  <li key={record.key} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <Trophy className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                    <span>
                      {record.name}: <b className="text-[#111827]">{formatWeight(record.kg)} × {record.reps}</b>
                      {previous ? ` (was ${formatWeight(previous.kg)} × ${previous.reps})` : ' (first record)'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No new records in this period.</p>
            )}
          </section>
        </div>

        {/* every measure */}
        {report.rows.length > 0 && (
          <section className={card}>
            <h2 className="text-sm font-bold text-[#111827] mb-1">Measurements</h2>
            <div className="w-full min-w-0">
              <table className="pf-responsive-table pf-stack-table w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-gray-400">
                    <th className="text-left font-semibold py-2 px-4 sm:px-0">Measure</th>
                    <th className="text-right font-semibold py-2 px-2">Week {from.week}</th>
                    <th className="text-right font-semibold py-2 px-2">Week {to.week}</th>
                    <th className="text-right font-semibold py-2 pl-2 pr-4 sm:pr-0">Change</th>
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g}>
                    <tr>
                      <td colSpan={4} className="pt-3 pb-1 px-4 sm:px-0 text-xs font-bold text-[#111827]">
                        {g}
                      </td>
                    </tr>
                    {report.rows
                      .filter((r) => r.group === g)
                      .map((r) => {
                        const v = verdict(r);
                        const rawD = r.before != null && r.after != null ? r.after - r.before : null;
                        const d = rawD != null && isWeightUnit(r.unit) ? roundLb(rawD) : rawD;
                        return (
                          <tr key={r.key} className="border-t border-gray-100">
                            <td data-label="Measure" className="py-1.5 px-4 sm:px-0 text-gray-700">{r.label}</td>
                            <td data-label="Before" className="py-1.5 px-2 text-right tabular-nums text-gray-500">{fmt(r.before, r.unit)}</td>
                            <td data-label="After" className="py-1.5 px-2 text-right tabular-nums font-semibold text-[#111827]">{fmt(r.after, r.unit)}</td>
                            <td data-label="Change" className="py-1.5 pl-2 pr-4 sm:pr-0 text-right tabular-nums">
                              {d == null ? (
                                <span className="text-gray-300">—</span>
                              ) : (
                                <span className={`inline-flex items-center gap-0.5 font-semibold ${v === 'better' ? 'text-[#16A34A]' : v === 'worse' ? 'text-[#DC2626]' : 'text-gray-400'}`}>
                                  {v === 'same' ? <Minus className="w-3.5 h-3.5" /> : d > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                  {d > 0 ? '+' : ''}
                                  {Number(d.toFixed(1))}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                ))}
              </table>
            </div>
          </section>
        )}

        {/* before / after */}
        {pairs.length > 0 && (
          <section className={card}>
            <h2 className="text-sm font-bold text-[#111827] mb-2">Before / after</h2>
            {pairs.map(({ before, after }) => (
              <div key={after.id} className="mb-3 last:mb-0">
                <div className="text-xs font-semibold text-gray-500 mb-1.5">
                  {after.movement} · {after.angle} — week {from.week} vs week {to.week}
                </div>
                <div className="grid grid-cols-2 gap-3 no-print">
                  <ExerciseVideoPlayer video={before!.video} title={`${after.movement} before`} />
                  <ExerciseVideoPlayer video={after.video} title={`${after.movement} after`} />
                </div>
                <p className="hidden print:block text-xs text-gray-500">Videos: open the app to play them side by side.</p>
              </div>
            ))}
          </section>
        )}

        {/* coach summary */}
        <section className={card}>
          <h2 className="text-sm font-bold text-[#111827] mb-2">Coach summary</h2>
          {onUpdateClient ? (
            <>
              <textarea
                value={notes['report:summary'] ?? ''}
                onChange={(e) => setNote('report:summary', e.target.value)}
                rows={4}
                placeholder="What changed, what it means, how the client did…"
                className="no-print w-full border border-gray-200 rounded-xl px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-[#111827] mb-2"
              />
              <input
                value={notes['report:next'] ?? ''}
                onChange={(e) => setNote('report:next', e.target.value)}
                placeholder="Next phase focus (e.g. load the left side, add single-leg work)"
                className="no-print w-full border border-gray-200 rounded-xl px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-[#111827]"
              />
            </>
          ) : null}
          <div className={onUpdateClient ? 'hidden print:block' : ''}>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes['report:summary'] || '—'}</p>
            {notes['report:next'] && (
              <p className="text-sm text-[#111827] mt-2">
                <b>Next:</b> {notes['report:next']}
              </p>
            )}
          </div>
        </section>
      </article>
    </div>
  );
};
