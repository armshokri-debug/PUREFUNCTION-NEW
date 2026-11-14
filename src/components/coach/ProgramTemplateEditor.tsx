import React, { useState } from 'react';
import { ProgramTemplate } from '../../lib/programTemplates';
import { WEIGHT_UNIT } from '../../lib/units';
import { orderLabels } from '../../lib/workouts';
import { WorkoutBlock } from '../../types';
import { WeightInput } from '../WeightInput';

const TEMPLATE_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function formatOffsetDay(offset: number): string {
  const safeOffset = Number.isFinite(offset) ? Math.trunc(offset) : 0;
  const dayIndex = ((safeOffset % 7) + 7) % 7;
  const prefix = safeOffset >= 0 ? `+${safeOffset}` : `${safeOffset}`;
  return `${TEMPLATE_WEEKDAYS[dayIndex]} · Day ${prefix}`;
}

function cloneTemplate(template: ProgramTemplate): ProgramTemplate {
  return JSON.parse(JSON.stringify(template)) as ProgramTemplate;
}

interface NumberPrescriptionInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  fieldId: string;
  label: string;
  value: number | undefined;
  integer?: boolean;
  error?: string;
  onCommit: (next: number | undefined) => void;
  onValidityChange: (error: string | null) => void;
}

function validateNumericInput(
  raw: string,
  opts: { label: string; integer: boolean; allowEmpty: boolean }
): { valid: true; value: number | undefined } | { valid: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === '') {
    if (opts.allowEmpty) {
      return { valid: true, value: undefined };
    }
    return { valid: false, error: `${opts.label} is required (enter 0 or greater).` };
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    return { valid: false, error: `${opts.label} must be a valid number.` };
  }
  if (trimmed.startsWith('-')) {
    return { valid: false, error: `${opts.label} cannot be negative.` };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { valid: false, error: `${opts.label} must be a finite number 0 or greater.` };
  }
  if (opts.integer && (!Number.isInteger(parsed) || trimmed.endsWith('.'))) {
    return { valid: false, error: `${opts.label} must be a whole number (0 or greater).` };
  }
  return { valid: true, value: parsed };
}

const NumberPrescriptionInput: React.FC<NumberPrescriptionInputProps> = ({
  fieldId,
  label,
  value,
  integer = false,
  error,
  onCommit,
  onValidityChange,
  className = '',
  ...rest
}) => {
  const [allowEmpty] = useState(() => value === undefined);
  const [text, setText] = useState(() => (value === undefined ? '' : String(value)));
  const errorId = `${fieldId}-error`;

  return (
    <>
      <input
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        {...rest}
        value={text}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${className}${error ? ' border-red-400 focus:border-red-600' : ''}`}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const result = validateNumericInput(raw, { label, integer, allowEmpty });
          if (result.valid) {
            onValidityChange(null);
            onCommit(result.value);
          } else {
            onValidityChange(result.error);
          }
        }}
      />
      {error && (
        <span id={errorId} className="mt-1 block text-xs font-normal text-red-700 [overflow-wrap:anywhere]">
          {error}
        </span>
      )}
    </>
  );
};

const fieldCls =
  'mt-1 block w-full min-w-0 min-h-[44px] bg-white border border-gray-200 rounded-xl px-3 py-2 text-base text-[#111827] tabular-nums focus:outline-none focus:border-[#111827] disabled:bg-gray-50 disabled:text-gray-500';

export const ProgramTemplateEditor: React.FC<{
  snapshot: ProgramTemplate;
  saving: boolean;
  error: string | null;
  onSave: (draft: ProgramTemplate) => Promise<void> | void;
  onCancel: () => void;
}> = ({ snapshot, saving, error, onSave, onCancel }) => {
  const [draft, setDraft] = useState<ProgramTemplate>(() => cloneTemplate(snapshot));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [prevSaving, setPrevSaving] = useState(saving);
  const [hideServerError, setHideServerError] = useState(false);

  if (saving !== prevSaving) {
    setPrevSaving(saving);
    if (saving) {
      setHideServerError(false);
    }
  }

  const sortedDays = (Array.isArray(draft.days) ? draft.days : [])
    .map((day, dayIdx) => ({ day, dayIdx }))
    .sort(
      (a, b) =>
        (Number.isFinite(a.day?.offset) ? a.day.offset : 0) -
        (Number.isFinite(b.day?.offset) ? b.day.offset : 0)
    );

  const updateBlock = (dayIdx: number, blockIdx: number, patch: Partial<WorkoutBlock>) => {
    setHideServerError(true);
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((day, dIdx) =>
        dIdx !== dayIdx
          ? day
          : {
              ...day,
              workout: {
                ...day.workout,
                blocks: day.workout.blocks.map((block, bIdx) =>
                  bIdx !== blockIdx ? block : { ...block, ...patch }
                )
              }
            }
      )
    }));
  };

  const handleFieldValidityChange = (key: string, errMsg: string | null) => {
    setValidationError(null);
    setHideServerError(true);
    setFieldErrors((prev) => {
      if (errMsg === null) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key] === errMsg) return prev;
      return { ...prev, [key]: errMsg };
    });
  };

  const firstFieldError = Object.values(fieldErrors)[0] ?? null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (firstFieldError) {
      setValidationError(firstFieldError);
      return;
    }
    if (!draft.name.trim()) {
      setValidationError('Enter a template name.');
      return;
    }
    setValidationError(null);
    setHideServerError(false);
    void onSave({ ...draft, name: draft.name.trim() });
  };

  const visibleServerError = hideServerError ? null : error;
  const displayError = firstFieldError || validationError || visibleServerError;
  const scopeLabel = draft.scope === 'program' ? '12 weeks' : 'One week';

  return (
    <form
      id="program-template-editor"
      role="region"
      aria-label="Edit program template"
      noValidate
      onSubmit={handleSubmit}
      className="border-t border-gray-100 pt-4 space-y-4 min-w-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 min-w-0">
        <h3 className="text-sm font-bold text-[#111827] min-w-0 max-w-full [overflow-wrap:anywhere]">
          Edit program template
        </h3>
        <span className="text-xs text-gray-500 shrink-0">
          {scopeLabel} · {sortedDays.length} {sortedDays.length === 1 ? 'workout' : 'workouts'}
        </span>
      </div>

      <label className="block min-w-0 text-xs font-semibold text-gray-600">
        Edit template name
        <input
          type="text"
          aria-label="Edit template name"
          value={draft.name}
          disabled={saving}
          onChange={(e) => {
            setValidationError(null);
            setHideServerError(true);
            setDraft((prev) => ({ ...prev, name: e.target.value }));
          }}
          placeholder="e.g. Foundation phase"
          className={fieldCls}
        />
      </label>

      {sortedDays.length === 0 ? (
        <p className="text-sm text-gray-500">This template has no workouts.</p>
      ) : (
        <div className="space-y-3 min-w-0">
          {sortedDays.map(({ day, dayIdx }) => {
            const workout = day.workout;
            const blocks = Array.isArray(workout?.blocks) ? workout.blocks : [];
            const labels = orderLabels(blocks.map((b) => ({ supersetWithPrevious: b?.supersetWithPrevious })));
            const workoutTitle =
              typeof workout?.title === 'string' && workout.title.trim()
                ? workout.title.trim()
                : 'Untitled workout';

            return (
              <div
                key={`${day.offset}-${workout?.id ?? dayIdx}`}
                className="rounded-xl border border-gray-100 bg-[#F7F8FA] p-3 space-y-3 min-w-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 min-w-0">
                  <span className="text-sm font-semibold text-[#111827] min-w-0 max-w-full [overflow-wrap:anywhere]">
                    {workoutTitle}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">{formatOffsetDay(day.offset)}</span>
                </div>

                {blocks.length === 0 ? (
                  <p className="text-xs text-gray-500">No exercises in this workout.</p>
                ) : (
                  <div className="space-y-3 min-w-0">
                    {blocks.map((block, blockIdx) => {
                      const exName =
                        typeof block.name === 'string' && block.name.trim()
                          ? block.name.trim()
                          : 'Unnamed exercise';
                      const inputPrefix = `${workoutTitle} · ${exName}`;
                      const setsKey = `day-${dayIdx}-block-${blockIdx}-sets`;
                      const restKey = `day-${dayIdx}-block-${blockIdx}-rest`;
                      return (
                        <div
                          key={block.id ?? blockIdx}
                          className="rounded-xl bg-white border border-gray-100 p-3 space-y-2.5 min-w-0"
                        >
                          <div className="text-xs font-semibold text-[#111827] min-w-0 max-w-full [overflow-wrap:anywhere]">
                            {labels[blockIdx] ? `${labels[blockIdx]}. ` : ''}
                            {exName}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 min-w-0">
                            <label className="block min-w-0 text-xs font-medium text-gray-600">
                              Sets
                              <NumberPrescriptionInput
                                fieldId={setsKey}
                                label="Sets"
                                aria-label={`${inputPrefix} sets`}
                                integer
                                value={block.sets}
                                error={fieldErrors[setsKey]}
                                disabled={saving}
                                onCommit={(val) => updateBlock(dayIdx, blockIdx, { sets: val })}
                                onValidityChange={(err) => handleFieldValidityChange(setsKey, err)}
                                className={fieldCls}
                              />
                            </label>

                            <label className="block min-w-0 text-xs font-medium text-gray-600">
                              Reps
                              <input
                                type="text"
                                aria-label={`${inputPrefix} reps`}
                                value={block.reps ?? ''}
                                disabled={saving}
                                onChange={(e) => updateBlock(dayIdx, blockIdx, { reps: e.target.value })}
                                placeholder="8-10"
                                className={fieldCls}
                              />
                            </label>

                            <label className="block min-w-0 text-xs font-medium text-gray-600">
                              Load ({WEIGHT_UNIT})
                              <WeightInput
                                aria-label={`${inputPrefix} load (${WEIGHT_UNIT})`}
                                min={0}
                                step="any"
                                kg={block.loadKg}
                                disabled={saving}
                                onChangeKg={(kg) => updateBlock(dayIdx, blockIdx, { loadKg: kg ?? 0 })}
                                className={fieldCls}
                              />
                            </label>

                            <label className="block min-w-0 text-xs font-medium text-gray-600">
                              Rest (s)
                              <NumberPrescriptionInput
                                fieldId={restKey}
                                label="Rest (s)"
                                aria-label={`${inputPrefix} rest (s)`}
                                integer
                                value={block.restSec}
                                error={fieldErrors[restKey]}
                                disabled={saving}
                                onCommit={(val) => updateBlock(dayIdx, blockIdx, { restSec: val })}
                                onValidityChange={(err) => handleFieldValidityChange(restKey, err)}
                                className={fieldCls}
                              />
                            </label>
                          </div>

                          <label className="block min-w-0 text-xs font-medium text-gray-600">
                            Coach note
                            <input
                              type="text"
                              aria-label={`${inputPrefix} coach note`}
                              value={block.notes ?? ''}
                              disabled={saving}
                              onChange={(e) => updateBlock(dayIdx, blockIdx, { notes: e.target.value })}
                              placeholder="Coaching note for this exercise"
                              className="mt-1 block w-full min-w-0 min-h-[44px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-base text-gray-700 focus:outline-none focus:border-[#111827] disabled:opacity-60"
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {displayError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 min-w-0 [overflow-wrap:anywhere]">
          {displayError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] bg-[#111827] text-white px-5 rounded-xl font-semibold text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="min-h-[44px] border border-gray-200 rounded-xl px-4 text-sm font-medium text-[#111827] hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
