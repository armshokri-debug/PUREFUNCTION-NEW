import { useCallback, useEffect, useRef, useState } from 'react';
import { ProgramTemplate } from '../lib/programTemplates';
import { supabase } from './supabase';

const DEMO_KEY = 'pf.programTemplates.v1';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneTemplate(template: ProgramTemplate): ProgramTemplate {
  return JSON.parse(JSON.stringify(template)) as ProgramTemplate;
}

function deepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, idx) => deepEqualJson(item, b[idx]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj).filter((k) => aObj[k] !== undefined);
    const bKeys = Object.keys(bObj).filter((k) => bObj[k] !== undefined);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => bKeys.includes(k) && deepEqualJson(aObj[k], bObj[k]));
  }
  return false;
}

function isValidProgramTemplateObject(value: unknown, expectedId: string): value is ProgramTemplate {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string' || !value.id.trim() || value.id !== expectedId) return false;
  if (typeof value.name !== 'string' || !value.name.trim()) return false;
  if (value.scope !== 'week' && value.scope !== 'program') return false;
  if (typeof value.createdAt !== 'string' || !value.createdAt.trim()) return false;
  if (!Array.isArray(value.days)) return false;

  const maxDays = value.scope === 'week' ? 7 : 84;
  for (const day of value.days) {
    if (!isPlainObject(day)) return false;
    if (
      typeof day.offset !== 'number' ||
      !Number.isInteger(day.offset) ||
      day.offset < 0 ||
      day.offset >= maxDays
    ) {
      return false;
    }
    const workout = day.workout;
    if (!isPlainObject(workout)) return false;
    if (typeof workout.id !== 'string' || !workout.id.trim()) return false;
    if (typeof workout.date !== 'string' || !workout.date.trim()) return false;
    if (typeof workout.title !== 'string') return false;
    if (workout.status !== 'planned' && workout.status !== 'completed' && workout.status !== 'missed') {
      return false;
    }
    if (!Array.isArray(workout.blocks)) return false;
    for (const block of workout.blocks) {
      if (!isPlainObject(block)) return false;
      if (typeof block.id !== 'string' || !block.id.trim()) return false;
      if (typeof block.name !== 'string' || !block.name.trim()) return false;
      if (
        'sets' in block &&
        block.sets !== undefined &&
        (typeof block.sets !== 'number' || !Number.isInteger(block.sets) || block.sets < 0)
      ) {
        return false;
      }
      if (
        'loadKg' in block &&
        block.loadKg !== undefined &&
        (typeof block.loadKg !== 'number' || !Number.isFinite(block.loadKg) || block.loadKg < 0)
      ) {
        return false;
      }
      if (
        'restSec' in block &&
        block.restSec !== undefined &&
        (typeof block.restSec !== 'number' || !Number.isFinite(block.restSec) || block.restSec < 0)
      ) {
        return false;
      }
      if (!Array.isArray(block.loggedSets)) return false;
    }
  }
  return true;
}

function extractRpcUpdatedTemplate(rpcData: unknown, expectedId: string): ProgramTemplate {
  const row = Array.isArray(rpcData) ? (rpcData.length === 1 ? rpcData[0] : null) : rpcData;
  if (!isPlainObject(row) || row.id !== expectedId || !isValidProgramTemplateObject(row.data, expectedId)) {
    throw new Error('Received an invalid response while saving the program template.');
  }
  return cloneTemplate(row.data);
}

function mapTemplateUpdateError(err: unknown): Error {
  const rec = isPlainObject(err) ? err : {};
  const code = typeof rec.code === 'string' ? rec.code : '';
  const status = typeof rec.status === 'number' ? rec.status : 0;
  const message =
    err instanceof Error
      ? err.message
      : typeof rec.message === 'string'
      ? rec.message
      : '';

  if (code === '40001' || /modified elsewhere|version_conflict/i.test(message)) {
    return new Error('This template was modified elsewhere. Reload templates before saving your changes.');
  }
  if (code === '42501' || /permission denied|access denied|verified coach/i.test(message)) {
    return new Error('You do not have permission to edit this program template.');
  }
  if (
    code === 'PGRST202' ||
    code === '42883' ||
    status === 404 ||
    /could not find the function|does not exist|schema cache|unmocked/i.test(message)
  ) {
    return new Error('Template editing is not enabled yet.');
  }
  if (code === '22023') {
    return new Error(message || 'Program template changes are invalid.');
  }
  return new Error(message || 'Could not save program template changes.');
}

/** Cloud templates require the optional program_templates migration. No fallback to
 * browser storage in cloud mode: templates must remain shared across coach devices. */
export function useProgramTemplates() {
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const mutatingRef = useRef(false);

  const load = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    inFlightRef.current = true;
    setLoading(true);

    if (!supabase) {
      try {
        const saved = JSON.parse(localStorage.getItem(DEMO_KEY) ?? '[]') as ProgramTemplate[];
        if (mountedRef.current && reqId === requestIdRef.current) {
          setTemplates(Array.isArray(saved) ? saved : []);
          setError(null);
          setReady(true);
        }
      } catch {
        if (mountedRef.current && reqId === requestIdRef.current) {
          setTemplates([]);
          setError(null);
          setReady(true);
        }
      } finally {
        if (mountedRef.current && reqId === requestIdRef.current) {
          inFlightRef.current = false;
          setLoading(false);
        }
      }
      return;
    }

    try {
      const { data, error: loadError } = await supabase
        .from('program_templates')
        .select('data')
        .order('created_at', { ascending: false });
      if (!mountedRef.current || reqId !== requestIdRef.current) return;
      if (loadError) {
        // Feature stays hidden until migration has been approved and applied.
        setReady(false);
        setError(loadError.message);
      } else {
        setTemplates((data ?? []).map((row: { data: ProgramTemplate }) => row.data));
        setError(null);
        setReady(true);
      }
    } catch (err) {
      if (!mountedRef.current || reqId !== requestIdRef.current) return;
      setReady(false);
      setError(err instanceof Error ? err.message : 'Program templates could not load.');
    } finally {
      if (mountedRef.current && reqId === requestIdRef.current) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
      inFlightRef.current = false;
      mutatingRef.current = false;
      requestIdRef.current += 1;
    };
  }, [load]);

  const reload = useCallback(async () => {
    if (inFlightRef.current || mutatingRef.current) return;
    await load();
  }, [load]);

  const save = useCallback(async (template: ProgramTemplate) => {
    if (!ready) throw new Error('Program templates are not enabled.');
    if (mutatingRef.current) throw new Error('Another template operation is already in progress.');
    mutatingRef.current = true;
    try {
      if (supabase) {
        const { error: writeError } = await supabase.from('program_templates').insert({ id: template.id, data: template });
        if (writeError) { setError(writeError.message); throw writeError; }
      } else {
        const next = [template, ...templates];
        localStorage.setItem(DEMO_KEY, JSON.stringify(next));
      }
      setTemplates((prev) => [template, ...prev]);
    } finally {
      mutatingRef.current = false;
    }
  }, [ready, templates]);

  const update = useCallback(async (updated: ProgramTemplate, expectedOriginal: ProgramTemplate): Promise<ProgramTemplate> => {
    if (!ready) throw new Error('Program templates are not enabled.');
    if (mutatingRef.current) throw new Error('Another template operation is already in progress.');
    if (!isValidProgramTemplateObject(expectedOriginal, expectedOriginal?.id)) {
      throw new Error('Original template snapshot is invalid.');
    }

    const candidate: ProgramTemplate = {
      ...cloneTemplate(updated),
      name: typeof updated?.name === 'string' ? updated.name.trim() : ''
    };
    if (!isValidProgramTemplateObject(candidate, expectedOriginal.id)) {
      throw new Error('Enter a valid template name and exercise prescriptions.');
    }

    mutatingRef.current = true;
    try {
      if (supabase) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('pf_update_program_template', {
          p_id: expectedOriginal.id,
          p_data: candidate,
          p_expected_data: expectedOriginal
        });
        if (rpcError) {
          throw mapTemplateUpdateError(rpcError);
        }
        const confirmed = extractRpcUpdatedTemplate(rpcData, expectedOriginal.id);
        if (mountedRef.current) {
          setTemplates((prev) => prev.map((t) => (t.id === expectedOriginal.id ? confirmed : t)));
        }
        return confirmed;
      }

      let stored: ProgramTemplate[];
      try {
        const parsed = JSON.parse(localStorage.getItem(DEMO_KEY) ?? '[]');
        if (!Array.isArray(parsed)) throw new Error('Invalid local template storage.');
        stored = parsed as ProgramTemplate[];
      } catch {
        throw new Error('Could not read local template storage.');
      }

      const idx = stored.findIndex((t) => t && t.id === expectedOriginal.id);
      if (idx < 0) {
        throw new Error('This template no longer exists. Reload templates before saving.');
      }
      if (!deepEqualJson(stored[idx], expectedOriginal)) {
        throw new Error('This template was modified elsewhere. Reload templates before saving your changes.');
      }

      const next = stored.map((t, i) => (i === idx ? candidate : t));
      try {
        localStorage.setItem(DEMO_KEY, JSON.stringify(next));
      } catch {
        throw new Error('Could not save template changes to local storage.');
      }

      if (mountedRef.current) {
        setTemplates(next);
      }
      return candidate;
    } finally {
      mutatingRef.current = false;
    }
  }, [ready]);

  const remove = useCallback(async (id: string) => {
    if (!ready) return;
    if (mutatingRef.current) throw new Error('Another template operation is already in progress.');
    mutatingRef.current = true;
    try {
      if (supabase) {
        const { error: writeError } = await supabase.from('program_templates').delete().eq('id', id);
        if (writeError) { setError(writeError.message); throw writeError; }
      } else {
        localStorage.setItem(DEMO_KEY, JSON.stringify(templates.filter((t) => t.id !== id)));
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } finally {
      mutatingRef.current = false;
    }
  }, [ready, templates]);

  return { templates, ready, loading, error, reload, save, update, remove };
}
