import React from 'react';
import { ClientProfile, NutritionLogDay, NutritionPlan } from '../types';
import { addDays, dayShort, formatDate, todayISO } from '../lib/workouts';

const card = 'bg-white rounded-[28px] border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6';
const TARGETS: { key: keyof NutritionPlan; label: string; unit: string; step?: number }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'waterL', label: 'Water', unit: 'L', step: 0.1 }
];

const num = (v: string) => (v === '' ? undefined : Number(v));

export function upsertLog(plan: NutritionPlan, day: NutritionLogDay): NutritionPlan {
  const log = (plan.log ?? []).filter((d) => d.date !== day.date);
  return { ...plan, log: [...log, day].sort((a, b) => a.date.localeCompare(b.date)).slice(-120) };
}

/** Coach: targets, meal plan and the client's last 7 days. */
export const NutritionPanel: React.FC<{ client: ClientProfile; onUpdateClient: (c: ClientProfile) => void }> = ({ client, onUpdateClient }) => {
  const plan = client.nutrition ?? {};
  const set = (patch: Partial<NutritionPlan>) => onUpdateClient({ ...client, nutrition: { ...plan, ...patch } });
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const logOf = (d: string) => plan.log?.find((x) => x.date === d);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={card}>
        <h3 className="text-sm font-bold text-[#111827] mb-3">Daily targets</h3>
        <div className="grid grid-cols-2 gap-3">
          {TARGETS.map((t) => (
            <label key={t.key} className="block">
              <span className="text-xs text-gray-500">{t.label}</span>
              <div className="flex items-center border border-gray-200 rounded-full px-4 py-2 mt-1 bg-white">
                <input
                  type="number"
                  step={t.step ?? 1}
                  inputMode="decimal"
                  value={(plan[t.key] as number | undefined) ?? ''}
                  onChange={(e) => set({ [t.key]: num(e.target.value) } as Partial<NutritionPlan>)}
                  className="w-full text-sm font-semibold focus:outline-none bg-transparent"
                />
                <span className="text-xs text-gray-400">{t.unit}</span>
              </div>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">{client.name.split(' ')[0]} sees protein and water on the Today screen and can log them each day.</p>
      </section>

      <section className={card}>
        <h3 className="text-sm font-bold text-[#111827] mb-3">Last 7 days · logged by client</h3>
        <div className="divide-y divide-gray-100">
          {days.map((d) => {
            const l = logOf(d);
            const lowP = plan.protein && l?.protein != null && l.protein < plan.protein * 0.8;
            const lowW = plan.waterL && l?.waterL != null && l.waterL < plan.waterL * 0.8;
            return (
              <div key={d} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="w-24 text-gray-500">
                  {dayShort(d)} · {formatDate(d)}
                </span>
                {l ? (
                  <span className="flex items-center gap-2 flex-wrap justify-end">
                    {l.protein != null && <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${lowP ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-700'}`}>Protein {l.protein} g</span>}
                    {l.waterL != null && <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${lowW ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-700'}`}>Water {l.waterL} L</span>}
                    {l.note && <span className="text-xs text-gray-500 truncate max-w-[160px]">“{l.note}”</span>}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Not logged</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className={`${card} lg:col-span-2`}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-[#111827]">Meal plan</span>
            <textarea
              value={plan.mealPlan ?? ''}
              onChange={(e) => set({ mealPlan: e.target.value })}
              rows={6}
              placeholder={'Breakfast: Greek yogurt + oats + berries\nLunch: chicken, rice, vegetables\nPost-workout: protein shake\nDinner: fish, potatoes, salad'}
              className="mt-2 w-full border border-gray-200 rounded-[20px] px-4 py-3 text-sm focus:outline-none focus:border-[#111827] resize-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[#111827]">Coach note</span>
            <textarea
              value={plan.coachNote ?? ''}
              onChange={(e) => set({ coachNote: e.target.value })}
              rows={6}
              placeholder="e.g. Add 20 g protein on training days."
              className="mt-2 w-full border border-gray-200 rounded-[20px] px-4 py-3 text-sm focus:outline-none focus:border-[#111827] resize-none"
            />
          </label>
        </div>
      </section>
    </div>
  );
};

/** Client: today's protein and water, logged in one tap. */
export const NutritionTodayCard: React.FC<{ client: ClientProfile; onUpdateClient: (c: ClientProfile) => void }> = ({ client, onUpdateClient }) => {
  const plan = client.nutrition;
  if (!plan || (!plan.protein && !plan.waterL && !plan.mealPlan)) return null;
  const today = todayISO();
  const l: NutritionLogDay = plan.log?.find((x) => x.date === today) ?? { date: today };
  const save = (patch: Partial<NutritionLogDay>) => onUpdateClient({ ...client, nutrition: upsertLog(plan, { ...l, ...patch }) });
  const bump = (key: 'protein' | 'waterL', by: number) => save({ [key]: Math.max(0, Math.round(((l[key] ?? 0) + by) * 10) / 10) });
  const row = (key: 'protein' | 'waterL', label: string, unit: string, target: number | undefined, step: number) =>
    target ? (
      <div className="py-2.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-[#111827]">{label}</span>
          <span className="tabular-nums text-gray-600">
            <b className="text-[#111827]">{l[key] ?? 0}</b> / {target} {unit}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-2 bg-[#FFC809] rounded-full" style={{ width: `${Math.min(100, ((l[key] ?? 0) / target) * 100)}%` }} />
          </div>
          <button onClick={() => bump(key, -step)} aria-label={`Less ${label}`} className="w-8 h-8 rounded-full border border-gray-200 text-sm font-bold cursor-pointer">−</button>
          <button onClick={() => bump(key, step)} aria-label={`More ${label}`} className="w-8 h-8 rounded-full bg-[#111827] text-white text-sm font-bold cursor-pointer">+</button>
        </div>
      </div>
    ) : null;
  return (
    <section className="bg-white rounded-[28px] border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-5 mb-4">
      <h2 className="text-sm font-bold text-[#111827]">Nutrition today</h2>
      {row('protein', 'Protein', 'g', plan.protein, 10)}
      {row('waterL', 'Water', 'L', plan.waterL, 0.25)}
      {(plan.mealPlan || plan.coachNote) && (
        <details className="mt-1">
          <summary className="text-xs font-semibold text-gray-600 cursor-pointer">Meal plan & coach note</summary>
          {plan.mealPlan && <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{plan.mealPlan}</p>}
          {plan.coachNote && <p className="text-xs text-gray-500 mt-2">Coach: {plan.coachNote}</p>}
        </details>
      )}
    </section>
  );
};
