import { useCallback, useEffect, useState } from 'react';
import { ProgramTemplate } from '../lib/programTemplates';
import { supabase } from './supabase';

const DEMO_KEY = 'pf.programTemplates.v1';

/** Cloud templates require the optional program_templates migration. No fallback to
 * browser storage in cloud mode: templates must remain shared across coach devices. */
export function useProgramTemplates() {
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (!supabase) {
      try {
        const saved = JSON.parse(localStorage.getItem(DEMO_KEY) ?? '[]') as ProgramTemplate[];
        if (live) setTemplates(Array.isArray(saved) ? saved : []);
      } catch { if (live) setTemplates([]); }
      if (live) setReady(true);
      return () => { live = false; };
    }
    supabase.from('program_templates').select('data').order('created_at', { ascending: false }).then(({ data, error: loadError }) => {
      if (!live) return;
      if (loadError) {
        // Feature stays hidden until migration has been approved and applied.
        setReady(false);
        setError(loadError.message);
      } else {
        setTemplates((data ?? []).map((row: { data: ProgramTemplate }) => row.data));
        setReady(true);
      }
    });
    return () => { live = false; };
  }, []);

  const save = useCallback(async (template: ProgramTemplate) => {
    if (!ready) throw new Error('Program templates are not enabled.');
    if (supabase) {
      const { error: writeError } = await supabase.from('program_templates').insert({ id: template.id, data: template });
      if (writeError) { setError(writeError.message); throw writeError; }
    } else {
      const next = [template, ...templates];
      localStorage.setItem(DEMO_KEY, JSON.stringify(next));
    }
    setTemplates((prev) => [template, ...prev]);
  }, [ready, templates]);

  const remove = useCallback(async (id: string) => {
    if (!ready) return;
    if (supabase) {
      const { error: writeError } = await supabase.from('program_templates').delete().eq('id', id);
      if (writeError) { setError(writeError.message); throw writeError; }
    } else {
      localStorage.setItem(DEMO_KEY, JSON.stringify(templates.filter((t) => t.id !== id)));
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, [ready, templates]);

  return { templates, ready, error, save, remove };
}
