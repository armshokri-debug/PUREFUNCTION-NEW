import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AssessmentSnapshot, ClientProfile, Goal } from '../../types';
import { ComparisonRow } from '../../lib/assessments';
import { addDays, formatDate, todayISO } from '../../lib/workouts';
import { WEIGHT_UNIT, lbToKg, roundLb } from '../../lib/units';

/**
 * One measure from an assessment: write the coach's note for that assessment,
 * and set / change the goal for this measure (assessment → note → goal).
 */
export const MeasureSheet: React.FC<{
  row: ComparisonRow;
  assessment: AssessmentSnapshot;
  client: ClientProfile;
  onSave: (c: ClientProfile) => void;
  onClose: () => void;
}> = ({ row, assessment, client, onSave, onClose }) => {
  const existing = client.goals?.find((g) => g.metricKey === row.key);
  const current = row.after;
  const isWeight = row.unit === WEIGHT_UNIT || row.unit === 'kg';
  const displayCurrent = current != null ? (isWeight ? roundLb(current) : Number(current.toFixed(1))) : null;
  const [note, setNote] = useState(assessment.notes?.[row.key] ?? '');
  const [target, setTarget] = useState(
    existing ? String(isWeight ? roundLb(existing.target) : existing.target) : ''
  );
  const [due, setDue] = useState(existing?.dueDate ?? addDays(todayISO(), 28));
  const [goalNote, setGoalNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const displayUnit = isWeight ? WEIGHT_UNIT : row.unit;
  const unit = displayUnit === '%' || displayUnit === '°' ? displayUnit : displayUnit ? ` ${displayUnit}` : '';

  const save = () => {
    const tInput = target.trim() === '' ? null : Number(target);
    if (tInput != null && !isFinite(tInput)) return setError('Target must be a number.');
    if (tInput != null && displayCurrent != null && tInput === displayCurrent) {
      return setError('Pick a target different from the current value.');
    }
    const t = tInput == null ? null : isWeight ? lbToKg(tInput) : tInput;

    const notes = { ...(assessment.notes ?? {}) };
    if (note.trim()) notes[row.key] = note.trim();
    else delete notes[row.key];
    const assessments = (client.assessments ?? []).map((a) => (a.id === assessment.id ? { ...a, notes } : a));

    let goals = (client.goals ?? []).filter((g) => g.metricKey !== row.key);
    if (t != null) {
      const start = existing?.start ?? current ?? t;
      const goal: Goal = {
        id: existing?.id ?? `goal-${Date.now().toString(36)}`,
        metricKey: row.key,
        label: row.label.replace(' (est. 1RM)', ' 1RM'),
        unit: displayUnit,
        // the target decides the direction (e.g. asymmetry down, muscle up)
        direction: t >= start ? 'up' : 'down',
        start,
        target: t,
        dueDate: due || undefined,
        note: goalNote.trim() || undefined,
        createdAt: existing?.createdAt ?? todayISO()
      };
      goals = [...goals, goal];
    }
    onSave({ ...client, assessments, goals });
    onClose();
  };

  const field =
    'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-[#111827] focus:outline-none focus:border-[#111827]';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-xl max-h-[92dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${row.label} note and goal`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">{row.label}</h2>
            <p className="text-sm text-gray-500">
              {displayCurrent != null ? `${displayCurrent}${unit}` : 'Not measured'} on {formatDate(assessment.date)} (week{' '}
              {assessment.week})
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-[#111827] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block text-xs font-medium text-gray-600 mb-1.5">Note for this assessment</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What you saw, how it felt, compensations…"
          className={`${field} mb-5`}
        />

        <div className="p-3.5 rounded-xl bg-[#FFFDF5] border border-[#FEF3C7]">
          <div className="text-sm font-semibold text-[#111827] mb-2">Goal</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">Target ({displayUnit || 'value'})</span>
              <input
                type="number"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={row.better === 'down' ? 'e.g. lower' : 'e.g. higher'}
                className={field}
              />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">By</span>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
            </label>
          </div>
          <input
            value={goalNote}
            onChange={(e) => setGoalNote(e.target.value)}
            placeholder="Why this goal (optional)"
            className={field}
          />
          <p className="text-[11px] text-gray-500 mt-2">
            Progress updates automatically with each new assessment. Leave the target empty to remove the goal.
          </p>
        </div>

        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-500 cursor-pointer">
            Cancel
          </button>
          <button onClick={save} className="bg-[#111827] text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
