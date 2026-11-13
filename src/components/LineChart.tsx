import React from 'react';
import { Point, linearTrend } from '../lib/trends';
import { formatDate, parseISODate } from '../lib/workouts';

/**
 * Time chart: real points, the start point, a dashed least-squares trend,
 * an optional goal line, and numbered life events on the timeline.
 */
export const LineChart: React.FC<{
  points: Point[];
  unit: string;
  goal?: number;
  events?: { date: string; text: string }[];
  color?: string;
  label: string;
}> = ({ points, unit, goal, events = [], color = '#111827', label }) => {
  const W = 640;
  const H = 240;
  const pad = { l: 44, r: 16, t: 18, b: 30 };
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return null;

  const t = (d: string) => parseISODate(d).getTime();
  const evs = events.filter((e) => e.date >= sorted[0].date && e.date <= sorted[sorted.length - 1].date);
  let x0 = t(sorted[0].date);
  let x1 = t(sorted[sorted.length - 1].date);
  if (x1 === x0) {
    x0 -= 3 * 86400000;
    x1 += 3 * 86400000;
  }
  const values = sorted.map((p) => p.value).concat(goal != null ? [goal] : []);
  let y0 = Math.min(...values);
  let y1 = Math.max(...values);
  const span = y1 - y0 || Math.max(1, Math.abs(y1) * 0.1);
  y0 -= span * 0.15;
  y1 += span * 0.15;

  const X = (d: string) => pad.l + ((t(d) - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const fmt = (v: number) => `${Number(v.toFixed(1))}${unit === '%' || unit === '°' ? unit : ''}`;
  const trend = linearTrend(sorted);
  const ticks = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15];
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${label} chart`}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="#F3F4F6" />
            <text x={pad.l - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#9CA3AF">
              {fmt(v)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 8} fontSize="11" fill="#9CA3AF">
          {formatDate(first.date)}
        </text>
        {last.date !== first.date && (
          <text x={W - pad.r} y={H - 8} fontSize="11" fill="#9CA3AF" textAnchor="end">
            {formatDate(last.date)}
          </text>
        )}

        {/* events */}
        {evs.map((e, i) => (
          <g key={e.date + i}>
            <line x1={X(e.date)} x2={X(e.date)} y1={pad.t} y2={H - pad.b} stroke="#D1D5DB" strokeDasharray="3 4" />
            <circle cx={X(e.date)} cy={pad.t + 2} r="8" fill="#FEF3C7" stroke="#F59E0B" />
            <text x={X(e.date)} y={pad.t + 6} fontSize="10" fontWeight="700" textAnchor="middle" fill="#92400E">
              {i + 1}
            </text>
          </g>
        ))}

        {/* goal */}
        {goal != null && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={Y(goal)} y2={Y(goal)} stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="6 5" />
            <text x={W - pad.r} y={Y(goal) - 5} fontSize="11" fontWeight="600" textAnchor="end" fill="#B45309">
              Goal {fmt(goal)}
            </text>
          </g>
        )}

        {/* trend */}
        {trend && (
          <line
            x1={X(first.date)}
            x2={X(last.date)}
            y1={Y(trend.startFit)}
            y2={Y(trend.endFit)}
            stroke="#9CA3AF"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}

        {/* data */}
        {sorted.length > 1 && (
          <polyline
            points={sorted.map((p) => `${X(p.date)},${Y(p.value)}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {sorted.map((p, i) => (
          <circle key={p.date + i} cx={X(p.date)} cy={Y(p.value)} r={i === 0 ? 5.5 : 4} fill={i === 0 ? '#FFC809' : color} stroke="#fff" strokeWidth="2">
            <title>
              {formatDate(p.date)}: {fmt(p.value)} {unit !== '%' && unit !== '°' ? unit : ''}
            </title>
          </circle>
        ))}
        <text x={X(first.date) + 8} y={Y(first.value) - 9} fontSize="11" fontWeight="600" fill="#B45309">
          Start {fmt(first.value)}
        </text>
        {sorted.length > 1 && (
          <text x={X(last.date) - 6} y={Y(last.value) - 9} fontSize="12" fontWeight="700" textAnchor="end" fill={color}>
            {fmt(last.value)}
          </text>
        )}
      </svg>
      {evs.length > 0 && (
        <ol className="mt-1 space-y-0.5">
          {evs.map((e, i) => (
            <li key={e.date + i} className="text-xs text-gray-600">
              <span className="font-bold text-[#92400E]">{i + 1}.</span> {formatDate(e.date)} — {e.text}
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
};
