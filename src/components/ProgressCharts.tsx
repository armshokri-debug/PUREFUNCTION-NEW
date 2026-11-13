import React, { useMemo, useState } from 'react';
import { CalendarPlus, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { ClientProfile } from '../types';
import { LineChart } from './LineChart';
import { chartableMeasures, linearTrend, loggedExercises, measureSeries, strengthSeries } from '../lib/trends';
import { WEIGHT_UNIT, roundLb } from '../lib/units';
import { formatDate, todayISO } from '../lib/workouts';

/**
 * Real progress charts: body test / assessment measures over time and
 * progressive overload per exercise, each with start, trend, goal and events.
 */
export const ProgressCharts: React.FC<{
  client: ClientProfile;
  /** coach can add/remove life events */
  onUpdateClient?: (c: ClientProfile) => void;
}> = ({ client, onUpdateClient }) => {
  const measures = useMemo(() => chartableMeasures(client), [client]);
  const lifts = useMemo(() => loggedExercises(client), [client]);
  const [tab, setTab] = useState<'body' | 'strength'>(measures.length ? 'body' : 'strength');
  const [measureKey, setMeasureKey] = useState(measures.find((m) => m.key === 'body:weight')?.key ?? measures[0]?.key);
  const [liftId, setLiftId] = useState(lifts[0]?.id);
  const [eventText, setEventText] = useState('');
  const [eventDate, setEventDate] = useState(todayISO());

  if (!measures.length && !lifts.length) return null;

  const events = client.events ?? [];
  const measure = measures.find((m) => m.key === measureKey) ?? measures[0];
  const lift = lifts.find((l) => l.id === liftId) ?? lifts[0];

  let rawPoints = tab === 'body' && measure ? measureSeries(client, measure.key) : [];
  let unit = measure?.unit ?? '';
  let better: 'up' | 'down' = measure?.better ?? 'up';
  let title = measure?.label ?? '';
  const rawGoal = tab === 'body' && measure ? client.goals?.find((g) => g.metricKey === measure.key)?.target : undefined;
  if (tab === 'strength' && lift) {
    rawPoints = strengthSeries(client, lift.id).e1rm;
    unit = WEIGHT_UNIT;
    better = 'up';
    title = `${lift.name} — estimated 1RM per session`;
  }
  const isWeight = unit === WEIGHT_UNIT || unit === 'kg';
  if (isWeight) unit = WEIGHT_UNIT;
  const points = isWeight ? rawPoints.map((p) => ({ date: p.date, value: roundLb(p.value) })) : rawPoints;
  const goal = rawGoal != null && isWeight ? roundLb(rawGoal) : rawGoal;
  const trend = linearTrend(points);
  const good = trend ? (trend.perWeek > 0) === (better === 'up') : null;
  const fmt = (v: number) => `${v > 0 ? '+' : ''}${Number(v.toFixed(2))}${unit === '%' || unit === '°' ? unit : ` ${unit}`}`;

  const addEvent = () => {
    if (!eventText.trim() || !onUpdateClient) return;
    onUpdateClient({
      ...client,
      events: [...events, { id: `ev-${Date.now().toString(36)}`, date: eventDate, text: eventText.trim() }].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
    });
    setEventText('');
  };

  const select = 'border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-sm text-[#111827] max-w-full';

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-[#111827]">Progress charts</h2>
        <div className="bg-gray-100 p-0.5 rounded-xl inline-flex" role="tablist">
          {(['body', 'strength'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              disabled={t === 'body' ? !measures.length : !lifts.length}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 ${tab === t ? 'bg-[#111827] text-white' : 'text-gray-600'}`}
            >
              {t === 'body' ? 'Body & assessment' : 'Strength (overload)'}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        {tab === 'body' ? (
          <select value={measure?.key} onChange={(e) => setMeasureKey(e.target.value)} aria-label="Measure" className={select}>
            {measures.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        ) : (
          <select value={lift?.id} onChange={(e) => setLiftId(e.target.value)} aria-label="Exercise" className={select}>
            {lifts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.sessions} sessions)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* analysis line */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-sm">
        <span className="font-semibold text-[#111827]">{title}</span>
        {trend ? (
          <span className={`inline-flex items-center gap-1 font-semibold ${good ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
            {Math.abs(trend.perWeek) < 1e-6 ? <Minus className="w-4 h-4" /> : trend.perWeek > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {fmt(trend.perWeek)} / week · {fmt(trend.total)} since start
          </span>
        ) : (
          <span className="text-gray-500 text-xs">{points.length === 1 ? 'One measurement so far — the trend appears after the next one.' : ''}</span>
        )}
      </div>

      {points.length > 0 ? (
        <LineChart points={points} unit={unit} goal={goal} events={events} label={title} />
      ) : (
        <p className="text-sm text-gray-500 py-6">No data for this yet.</p>
      )}

      {/* life events */}
      {onUpdateClient && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-xs font-semibold text-[#111827] mb-2">Client events on the timeline (injury, travel, illness…)</div>
          <div className="flex flex-wrap gap-2 mb-2">
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} aria-label="Event date" className={select} />
            <input
              value={eventText}
              onChange={(e) => setEventText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEvent()}
              placeholder="e.g. Left knee pain, 1 week off"
              aria-label="Event"
              className={`${select} flex-1 min-w-[180px] text-base sm:text-sm`}
            />
            <button onClick={addEvent} className="inline-flex items-center gap-1.5 bg-[#111827] text-white text-sm font-semibold px-3.5 py-2 rounded-lg cursor-pointer">
              <CalendarPlus className="w-4 h-4" /> Add
            </button>
          </div>
          {events.length > 0 && (
            <ul className="space-y-1">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-xs text-gray-600">
                  <span>
                    {formatDate(e.date)} — {e.text}
                  </span>
                  <button
                    onClick={() => onUpdateClient({ ...client, events: events.filter((x) => x.id !== e.id) })}
                    aria-label={`Remove event ${e.text}`}
                    className="p-1 text-gray-300 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
