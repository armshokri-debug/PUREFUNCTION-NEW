import React, { useEffect, useState } from 'react';
import { supabase } from '../cloud/supabase';
import { todayISO } from '../lib/workouts';

interface Entry { id: string; date: string; description: string; status: string }
interface Item { entry_id: string; name: string; kcal: number | null; protein: number | null }

/** Adapter for the existing normalized diary. Legacy nutrition targets stay unchanged. */
export function FoodDiary({ clientId, readOnly = false }: { clientId: string; readOnly?: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = React.useRef<string | null>(null);
  const load = async () => {
    const [a, b] = await Promise.all([
      supabase!.from('food_entries').select('id,date,description,status').eq('client_id', clientId).order('date', { ascending: false }),
      supabase!.from('food_items').select('entry_id,name,kcal,protein').eq('client_id', clientId)
    ]);
    if (a.error || b.error) throw a.error ?? b.error;
    return { entries: a.data as Entry[], items: b.data as Item[] };
  };
  useEffect(() => {
    let active = true;
    setReady(false); setEntries([]); setItems([]); setError(null);
    if (supabase) void load().then((data) => { if (active) { setEntries(data.entries); setItems(data.items); setReady(true); } })
      .catch(() => { if (active) setError('Food diary could not load. Reload to retry.'); });
    return () => { active = false; };
  }, [clientId]);
  if (!supabase) return null;
  return <section className="bg-white border border-gray-100 rounded-[28px] p-4 sm:p-6 my-4 min-w-0">
    <h2 className="text-sm font-bold mb-3">Food diary</h2>
    {error && <p role="alert" className="text-sm text-red-700 mb-3">{error}</p>}
    {!readOnly && <form className="grid gap-3 min-w-0" onSubmit={async (event) => {
      event.preventDefault();
      if (!ready || busy) return;
      setBusy(true); setError(null);
      key.current ??= crypto.randomUUID();
      try {
        const { error: err } = await supabase!.rpc('pf_save_food_entry', {
          p_client_id: clientId, p_existing_id: null, p_date: date,
          p_description: description.trim(), p_key: key.current,
          p_status: kcal === '' || protein === '' ? 'incomplete' : 'confirmed',
          p_items: [{ name: description.trim().slice(0, 200), quantity: 1, unit: 'serving', state: 'unknown',
            kcal: kcal === '' ? null : Number(kcal), protein: protein === '' ? null : Number(protein),
            source: 'manual', assumptions: 'Entered by client', version: 'food-v1' }]
        });
        if (err) throw err;
        const data = await load(); setEntries(data.entries); setItems(data.items);
        setDescription(''); setKcal(''); setProtein(''); key.current = null;
      } catch { setError('Meal was not confirmed saved. Retry to check the same entry safely.'); }
      finally { setBusy(false); }
    }}>
      <label className="text-sm">Date<input type="date" required value={date} max={todayISO()} onChange={(e) => { setDate(e.target.value); key.current = null; }} className="block w-full min-w-0 border rounded-xl px-3 py-3 text-base" /></label>
      <label className="text-sm">Food and portion<textarea required maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className="block w-full border rounded-xl p-3 text-base" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">Calories (kcal)<input type="number" min="0" step="any" value={kcal} onChange={(e) => setKcal(e.target.value)} className="block w-full min-w-0 border rounded-xl p-3 text-base" /></label>
        <label className="text-sm">Protein (g)<input type="number" min="0" step="any" value={protein} onChange={(e) => setProtein(e.target.value)} className="block w-full min-w-0 border rounded-xl p-3 text-base" /></label>
      </div>
      <p className="text-xs text-gray-500">Use your label or known values. Leave unknown amounts blank.</p>
      <button disabled={!ready || busy || !description.trim()} className="min-h-[44px] rounded-full bg-[#111827] text-white disabled:opacity-40">{busy ? 'Saving meal…' : 'Save meal'}</button>
    </form>}
    {!ready && !error && <p role="status" className="text-sm text-gray-500">Loading diary…</p>}
    {ready && entries.length === 0 && <p className="text-sm text-gray-500 mt-3">No meals recorded yet.</p>}
    <ul className="divide-y mt-3">{entries.map((entry) => <li key={entry.id} className="py-3 text-sm break-words">
      <p className="font-semibold">{entry.date} · {entry.description}</p>
      {items.filter((item) => item.entry_id === entry.id).map((item, i) => <p key={i} className="text-gray-600">{item.name} · {item.kcal ?? 'Unknown'} kcal · {item.protein ?? 'Unknown'} g protein</p>)}
    </li>)}</ul>
  </section>;
}
