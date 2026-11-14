import React, { useRef, useState } from 'react';
import { ClientProfile, WorkoutBlock } from '../../types';
import { useProgramTemplates } from '../../cloud/programTemplates';
import { applyProgramTemplate, createProgramTemplate, ProgramTemplate } from '../../lib/programTemplates';
import { formatWeight } from '../../lib/units';
import { orderLabels, todayISO } from '../../lib/workouts';
import { ProgramTemplateEditor } from './ProgramTemplateEditor';

const TEMPLATE_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function formatOffsetDay(offset: number): string {
  const safeOffset = Number.isFinite(offset) ? Math.trunc(offset) : 0;
  const dayIndex = ((safeOffset % 7) + 7) % 7;
  const prefix = safeOffset >= 0 ? `+${safeOffset}` : `${safeOffset}`;
  return `${TEMPLATE_WEEKDAYS[dayIndex]} · Day ${prefix}`;
}

function formatBlockPrescription(block: Partial<WorkoutBlock> | null | undefined): string {
  const hasSets = typeof block?.sets === 'number' && Number.isFinite(block.sets);
  const rawReps =
    typeof block?.reps === 'string'
      ? block.reps.trim()
      : typeof block?.reps === 'number' && Number.isFinite(block.reps)
      ? String(block.reps)
      : '';
  const hasReps = rawReps.length > 0;
  const hasLoad = typeof block?.loadKg === 'number' && Number.isFinite(block.loadKg);

  const parts: string[] = [];
  if (hasSets && hasReps) {
    parts.push(`${block!.sets} × ${rawReps}`);
  } else if (hasSets) {
    parts.push(`${block!.sets} ${block!.sets === 1 ? 'set' : 'sets'}`);
  } else if (hasReps) {
    parts.push(`${rawReps} reps`);
  }
  if (hasLoad) {
    parts.push(formatWeight(block!.loadKg!));
  }
  return parts.join(' · ');
}

function groupTemplateDaysByWeek(template: ProgramTemplate) {
  const days = Array.isArray(template.days)
    ? [...template.days].sort(
        (a, b) =>
          (Number.isFinite(a?.offset) ? a.offset : 0) -
          (Number.isFinite(b?.offset) ? b.offset : 0)
      )
    : [];
  const weeks = new Map<number, typeof days>();
  for (const day of days) {
    const safeOffset = Number.isFinite(day?.offset) ? Math.trunc(day.offset) : 0;
    const weekIndex = Math.floor(safeOffset / 7);
    const list = weeks.get(weekIndex);
    if (list) list.push(day);
    else weeks.set(weekIndex, [day]);
  }
  return {
    totalWorkouts: days.length,
    weeks: [...weeks.entries()].sort((a, b) => a[0] - b[0])
  };
}

export const ProgramTemplates: React.FC<{
  clients: ClientProfile[];
  client: ClientProfile;
  onApply: (template: ProgramTemplate, ids: string[], start: string) => void;
}> = ({ clients, client, onApply }) => {
  const { templates, ready, loading, error, reload, save, update, remove } = useProgramTemplates();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'week' | 'program'>('week');
  const [sourceDate, setSourceDate] = useState(todayISO());
  const [startDate, setStartDate] = useState(todayISO());
  const [selectedId, setSelectedId] = useState('');
  const [targets, setTargets] = useState<string[]>([client.id]);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<ProgramTemplate | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const savingEditRef = useRef(false);
  if (!ready) {
    if (!error) {
      return <p role="status" className="text-sm text-gray-500 mb-4">Loading program templates…</p>;
    }
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 mb-6 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-gray-600 min-w-0">
          {loading ? 'Loading program templates…' : 'Program templates could not load.'}
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => void reload()}
          className="min-h-[44px] border border-gray-200 rounded-xl px-4 text-sm font-medium text-[#111827] hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];
  const previewData = selected ? groupTemplateDaysByWeek(selected) : null;
  const previewScopeLabel =
    selected?.scope === 'program'
      ? '12 weeks'
      : selected?.scope === 'week'
      ? 'One week'
      : selected?.scope ?? '';
  const operationLocked = busy || savingEdit || !!editingSnapshot;
  const saveNew = async () => {
    if (operationLocked) return;
    try {
      const template = createProgramTemplate(client, name, scope, sourceDate);
      setBusy(true);
      await save(template);
      setSelectedId(template.id);
      setName('');
      setFeedback(`Saved ${template.days.length} workouts as ${template.name}.`);
    } catch (e) { setFeedback(e instanceof Error ? e.message : 'Could not save template.'); }
    finally { setBusy(false); }
  };
  const apply = () => {
    if (operationLocked) return;
    if (!selected || !targets.length) { setFeedback('Choose a template and at least one client.'); return; }
    try {
      const preview = applyProgramTemplate(clients, selected, targets, startDate);
      onApply(selected, targets, startDate);
      setFeedback(`Applied ${preview.copied} workouts to ${targets.length} clients. ${preview.skipped} days with results were protected.`);
    } catch (e) { setFeedback(e instanceof Error ? e.message : 'Unable to apply template.'); }
  };
  const startEditing = () => {
    if (!selected || operationLocked || savingEditRef.current) return;
    setEditingSnapshot(JSON.parse(JSON.stringify(selected)) as ProgramTemplate);
    setEditError(null);
    setFeedback('');
  };
  const handleSaveEdit = async (draft: ProgramTemplate) => {
    if (savingEditRef.current || !editingSnapshot) return;
    savingEditRef.current = true;
    setSavingEdit(true);
    setEditError(null);
    setFeedback('');
    try {
      const savedTemplate = await update(draft, editingSnapshot);
      setEditingSnapshot(null);
      setSelectedId(savedTemplate.id);
      setFeedback(`Updated template ${savedTemplate.name}.`);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Could not save template changes.');
    } finally {
      savingEditRef.current = false;
      setSavingEdit(false);
    }
  };
  const handleCancelEdit = () => {
    if (savingEditRef.current || savingEdit) return;
    setEditingSnapshot(null);
    setEditError(null);
  };
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-4 mb-6">
      <div>
        <h2 className="text-lg font-bold text-[#111827]">Program templates</h2>
        <p className="text-sm text-gray-500">Save a week or 12 weeks. Apply to multiple clients without overwriting logged workouts.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="min-w-0 text-xs font-semibold text-gray-600">Template name
          <input aria-label="Template name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Foundation phase" className="mt-1 block w-full min-h-[44px] border rounded-xl px-3 text-base" />
        </label>
        <label className="min-w-0 text-xs font-semibold text-gray-600">Length
          <select aria-label="Template length" value={scope} onChange={(e) => setScope(e.target.value as 'week' | 'program')} className="mt-1 block w-full min-h-[44px] border rounded-xl px-3 text-base"><option value="week">One week</option><option value="program">12 weeks</option></select>
        </label>
        <label className="min-w-0 text-xs font-semibold text-gray-600">Source week
          <input aria-label="Source week" type="date" value={sourceDate} onChange={(e) => setSourceDate(e.target.value)} className="mt-1 block w-full min-h-[44px] border rounded-xl px-3 text-base" />
        </label>
        <div className="flex items-end"><button type="button" disabled={operationLocked} onClick={() => void saveNew()} className="w-full min-h-[44px] bg-[#111827] text-white px-4 rounded-xl font-semibold text-sm disabled:opacity-50">Save as template</button></div>
      </div>
      {templates.length > 0 && selected && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="min-w-0 text-xs font-semibold text-gray-600">Saved template
              <select aria-label="Saved template" disabled={operationLocked} value={selected.id} onChange={(e) => setSelectedId(e.target.value)} className="mt-1 w-full min-h-[44px] border rounded-xl px-3 text-base disabled:opacity-60">{templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.days.length} workouts)</option>)}</select>
            </label>
            <label className="min-w-0 text-xs font-semibold text-gray-600">Destination week
              <input aria-label="Destination week" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block w-full min-h-[44px] border rounded-xl px-3 text-base" />
            </label>
          </div>
          <fieldset className="min-w-0"><legend className="text-xs font-semibold text-gray-600 mb-2">Apply to clients</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {clients.map((c) => <label key={c.id} className="flex items-center gap-2 min-h-[44px] min-w-0 text-sm"><input type="checkbox" checked={targets.includes(c.id)} onChange={(e) => setTargets((prev) => e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id))} /><span className="truncate">{c.name}</span></label>)}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={operationLocked} onClick={apply} className="min-h-[44px] bg-[#FFC809] text-[#111827] font-bold text-sm px-5 rounded-xl disabled:opacity-50">Apply template</button>
            <button
              type="button"
              aria-expanded={showPreview}
              aria-controls="program-template-preview"
              onClick={() => setShowPreview((prev) => !prev)}
              className="min-h-[44px] border border-gray-200 rounded-xl px-4 text-sm font-medium text-[#111827] hover:bg-gray-50"
            >
              {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
            <button
              type="button"
              disabled={operationLocked}
              onClick={startEditing}
              className="min-h-[44px] border border-gray-200 rounded-xl px-4 text-sm font-medium text-[#111827] hover:bg-gray-50 disabled:opacity-50"
            >
              Edit template
            </button>
            <button type="button" disabled={operationLocked} onClick={async () => { if (!selected || !window.confirm(`Delete template ${selected.name}?`)) return; try { setBusy(true); await remove(selected.id); setSelectedId(''); setFeedback('Template deleted.'); } catch { setFeedback('Could not delete template.'); } finally { setBusy(false); } }} className="min-h-[44px] border rounded-xl px-4 text-sm disabled:opacity-50">Delete template</button>
          </div>
          {editingSnapshot && (
            <ProgramTemplateEditor
              key={`editor-${editingSnapshot.id}`}
              snapshot={editingSnapshot}
              saving={savingEdit}
              error={editError}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
            />
          )}
          {showPreview && previewData && (
            <div
              key={`preview-${selected.id}`}
              id="program-template-preview"
              role="region"
              aria-label="Template preview"
              className="border-t border-gray-100 pt-4 space-y-3 min-w-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 min-w-0">
                <h3 className="text-sm font-bold text-[#111827] min-w-0 max-w-full [overflow-wrap:anywhere]">
                  {selected.name?.trim() ? selected.name : 'Untitled template'}
                </h3>
                <p className="text-xs text-gray-500">
                  {previewScopeLabel ? `${previewScopeLabel} · ` : ''}
                  {previewData.totalWorkouts} {previewData.totalWorkouts === 1 ? 'workout' : 'workouts'}
                </p>
              </div>
              {previewData.totalWorkouts === 0 ? (
                <p className="text-sm text-gray-500">This template has no workouts.</p>
              ) : (
                <div className="space-y-3 min-w-0">
                  {previewData.weeks.map(([weekIndex, weekDays]) => (
                    <div key={weekIndex} className="rounded-xl border border-gray-100 bg-[#F7F8FA] p-3 space-y-2 min-w-0">
                      <div className="text-xs font-semibold text-gray-600">
                        Week {weekIndex >= 0 ? weekIndex + 1 : weekIndex}
                      </div>
                      <ul className="space-y-2 min-w-0">
                        {weekDays.map((day, dayIdx) => {
                          const workout = day?.workout;
                          const blocks = Array.isArray(workout?.blocks) ? workout.blocks : [];
                          const labels = orderLabels(
                            blocks.map((b) => ({ supersetWithPrevious: b?.supersetWithPrevious }))
                          );
                          const title =
                            typeof workout?.title === 'string' && workout.title.trim()
                              ? workout.title.trim()
                              : 'Untitled workout';
                          const focus =
                            typeof workout?.focus === 'string' && workout.focus.trim()
                              ? workout.focus.trim()
                              : '';
                          return (
                            <li
                              key={`${day?.offset ?? 0}-${workout?.id ?? dayIdx}`}
                              className="rounded-xl bg-white border border-gray-100 p-3 space-y-1.5 min-w-0"
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 min-w-0">
                                <span className="text-sm font-semibold text-[#111827] min-w-0 max-w-full [overflow-wrap:anywhere]">
                                  {title}
                                </span>
                                <span className="text-xs text-gray-500 shrink-0">
                                  {formatOffsetDay(day?.offset ?? 0)}
                                </span>
                              </div>
                              {focus && (
                                <p className="text-xs text-gray-500 min-w-0 max-w-full [overflow-wrap:anywhere]">{focus}</p>
                              )}
                              {blocks.length === 0 ? (
                                <p className="text-xs text-gray-400">No exercises in this workout.</p>
                              ) : (
                                <ul className="space-y-1 pt-1 min-w-0">
                                  {blocks.map((block, blockIdx) => {
                                    const exName =
                                      typeof block?.name === 'string' && block.name.trim()
                                        ? block.name.trim()
                                        : 'Unnamed exercise';
                                    const prescription = formatBlockPrescription(block);
                                    return (
                                      <li
                                        key={block?.id ?? blockIdx}
                                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-gray-700 min-w-0"
                                      >
                                        <span className="font-medium text-[#111827] min-w-0 max-w-full [overflow-wrap:anywhere]">
                                          {labels[blockIdx] ? `${labels[blockIdx]}. ` : ''}
                                          {exName}
                                        </span>
                                        {prescription && (
                                          <span className="text-gray-600 tabular-nums min-w-0 max-w-full [overflow-wrap:anywhere]">
                                            {prescription}
                                          </span>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {feedback && <p role="status" className="text-sm text-gray-700">{feedback}</p>}
    </section>
  );
};
