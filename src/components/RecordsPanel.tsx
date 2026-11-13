import React, { useMemo, useState } from 'react';
import { Trophy, Plus, Trash2, X } from 'lucide-react';
import { ClientProfile, ManualRecord } from '../types';
import { personalRecords } from '../lib/records';
import { WEIGHT_UNIT, formatWeight, lbToKg } from '../lib/units';
import { formatDate } from '../lib/workouts';
import { useExerciseLibrary } from '../state/ExerciseLibrary';

/** All-time bests: automatic from logged workouts + hand-entered (client or coach). */
export const RecordsPanel: React.FC<{
  client: ClientProfile;
  onUpdateClient?: (c: ClientProfile) => void;
  by: 'client' | 'coach';
}> = ({ client, onUpdateClient, by }) => {
  const { exercises } = useExerciseLibrary();
  const records = useMemo(() => personalRecords(client), [client]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kg, setKg] = useState('');
  const [reps, setReps] = useState('1');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const lbVal = Number(kg);
    const r = Math.round(Number(reps));
    if (!name.trim()) return setError('Which exercise?');
    if (!(lbVal > 0) || lbVal > 2200) return setError(`Enter the weight in ${WEIGHT_UNIT}.`);
    if (!(r >= 1) || r > 100) return setError('Enter the reps (1 for a one-rep max).');
    const match = exercises.find((e) => e.name.toLowerCase() === name.trim().toLowerCase());
    const rec: ManualRecord = {
      id: `pr-${Date.now().toString(36)}`,
      exerciseId: match?.id,
      name: match?.name ?? name.trim(),
      kg: lbToKg(lbVal),
      reps: r,
      date: date || undefined,
      addedBy: by
    };
    onUpdateClient?.({ ...client, manualRecords: [...(client.manualRecords ?? []), rec] });
    setAdding(false);
    setName('');
    setKg('');
    setReps('1');
    setDate('');
    setError(null);
  };

  const remove = (id: string) =>
    onUpdateClient?.({ ...client, manualRecords: (client.manualRecords ?? []).filter((m) => m.id !== id) });

  const field =
    'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-sm text-[#111827] focus:outline-none focus:border-[#111827]';

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6 mb-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#B45309]" /> All-time records
        </h2>
        {onUpdateClient && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#111827] bg-[#F3F4F6] px-3 py-2 rounded-xl cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add record
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Updated automatically from logged workouts. Add older bests by hand (e.g. before joining).
      </p>

      {adding && (
        <div className="mb-4 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#111827]">New record</span>
            <button onClick={() => setAdding(false)} aria-label="Cancel" className="p-1 text-gray-400 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            list="pf-exercise-names"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Exercise (e.g. Biceps Curl)"
            aria-label="Exercise"
            className={`${field} mb-2`}
          />
          <datalist id="pf-exercise-names">
            {exercises.map((e) => (
              <option key={e.id} value={e.name} />
            ))}
          </datalist>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input type="number" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder={WEIGHT_UNIT} aria-label={`Weight in ${WEIGHT_UNIT}`} className={field} />
            <input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="reps" aria-label="Reps" className={field} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date (optional)" className={field} />
          </div>
          {error && <p className="text-sm text-red-700 mb-2" role="alert">{error}</p>}
          <button onClick={save} className="w-full bg-[#111827] text-white text-sm font-semibold py-2.5 rounded-xl cursor-pointer">
            Save record
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <p className="text-sm text-gray-500">No records yet — they appear as soon as weighted sets are logged.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {records.map((r) => (
            <li key={r.key} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#111827] truncate">{r.name}</div>
                <div className="text-xs text-gray-500">
                  {r.date ? formatDate(r.date) : 'Date not set'} ·{' '}
                  {r.source === 'manual' ? 'added by hand' : 'logged'}
                  {r.heaviestKg > r.kg ? ` · heaviest ${formatWeight(r.heaviestKg)}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-bold text-[#111827] tabular-nums">
                    {formatWeight(r.kg)} × {r.reps}
                  </div>
                  <div className="text-[11px] text-gray-500 tabular-nums">est. 1RM {formatWeight(r.best1RM)}</div>
                </div>
                {onUpdateClient && r.manualId && (
                  <button onClick={() => remove(r.manualId!)} aria-label={`Remove record ${r.name}`} className="p-1.5 text-gray-300 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
