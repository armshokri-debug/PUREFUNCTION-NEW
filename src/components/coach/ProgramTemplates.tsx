import React, { useState } from 'react';
import { ClientProfile } from '../../types';
import { useProgramTemplates } from '../../cloud/programTemplates';
import { applyProgramTemplate, createProgramTemplate, ProgramTemplate } from '../../lib/programTemplates';
import { todayISO } from '../../lib/workouts';

export const ProgramTemplates: React.FC<{
  clients: ClientProfile[];
  client: ClientProfile;
  onApply: (template: ProgramTemplate, ids: string[], start: string) => void;
}> = ({ clients, client, onApply }) => {
  const { templates, ready, save, remove } = useProgramTemplates();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'week' | 'program'>('week');
  const [sourceDate, setSourceDate] = useState(todayISO());
  const [startDate, setStartDate] = useState(todayISO());
  const [selectedId, setSelectedId] = useState('');
  const [targets, setTargets] = useState<string[]>([client.id]);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  if (!ready) return null; // Cloud migration not applied: hide feature completely.
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];
  const saveNew = async () => {
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
    if (!selected || !targets.length) { setFeedback('Choose a template and at least one client.'); return; }
    try {
      const preview = applyProgramTemplate(clients, selected, targets, startDate);
      onApply(selected, targets, startDate);
      setFeedback(`Applied ${preview.copied} workouts to ${targets.length} clients. ${preview.skipped} days with results were protected.`);
    } catch (e) { setFeedback(e instanceof Error ? e.message : 'Unable to apply template.'); }
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
        <div className="flex items-end"><button type="button" disabled={busy} onClick={() => void saveNew()} className="w-full min-h-[44px] bg-[#111827] text-white px-4 rounded-xl font-semibold text-sm disabled:opacity-50">Save as template</button></div>
      </div>
      {templates.length > 0 && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="min-w-0 text-xs font-semibold text-gray-600">Saved template
              <select aria-label="Saved template" value={selected?.id ?? ''} onChange={(e) => setSelectedId(e.target.value)} className="mt-1 w-full min-h-[44px] border rounded-xl px-3 text-base">{templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.days.length} workouts)</option>)}</select>
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
            <button type="button" onClick={apply} className="min-h-[44px] bg-[#FFC809] text-[#111827] font-bold text-sm px-5 rounded-xl">Apply template</button>
            <button type="button" disabled={busy} onClick={async () => { if (!selected || !window.confirm(`Delete template ${selected.name}?`)) return; try { setBusy(true); await remove(selected.id); setSelectedId(''); setFeedback('Template deleted.'); } catch { setFeedback('Could not delete template.'); } finally { setBusy(false); } }} className="min-h-[44px] border rounded-xl px-4 text-sm">Delete template</button>
          </div>
        </div>
      )}
      {feedback && <p role="status" className="text-sm text-gray-700">{feedback}</p>}
    </section>
  );
};
