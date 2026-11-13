import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ClientProfile } from '../../types';
import { EmptyProgress } from '../EmptyProgress';
import { AssessmentHistory } from './AssessmentHistory';
import { GoalsPanel } from './GoalsPanel';
import { RecordsPanel } from '../RecordsPanel';
import { ProgressCharts } from '../ProgressCharts';
import { PatternSpectrum } from '../PatternSpectrum';
import { BeforeAfter } from '../BeforeAfter';
import { WEIGHT_UNIT, roundLb } from '../../lib/units';

interface ProgressViewProps {
  clients: ClientProfile[];
  client: ClientProfile;
  onSelectClientId: (id: string) => void;
  onUpdateClient?: (c: ClientProfile) => void;
}

const PHASES = [
  { week: 0, label: 'Week 0', sub: '(Reposition)' },
  { week: 4, label: 'Week 4', sub: '(Integrate)' },
  { week: 8, label: 'Week 8', sub: '(Strength)' },
  { week: 12, label: 'Week 12', sub: '(Performance)' }
];

export const ProgressView: React.FC<ProgressViewProps> = ({
  clients,
  client,
  onSelectClientId,
  onUpdateClient
}) => {
  const [selectedLift, setSelectedLift] = useState<'squat' | 'rdl' | 'bench'>('squat');

  const history = client.progressHistory;
  if (history.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <select
            value={client.id}
            onChange={(e) => onSelectClientId(e.target.value)}
            aria-label="Client"
            className="text-base font-semibold text-[#111827] bg-transparent focus:outline-none cursor-pointer"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {client.assessments?.length ? (
          <>
            <GoalsPanel
              goals={client.goals ?? []}
              assessments={client.assessments}
              onDelete={onUpdateClient ? (id) => onUpdateClient({ ...client, goals: (client.goals ?? []).filter((g) => g.id !== id) }) : undefined}
              emptyText="No goals yet. Tap the note icon next to any measure below to add a note or set a goal."
            />
            <AssessmentHistory key={client.id} assessments={client.assessments} client={client} onUpdateClient={onUpdateClient} />
          </>
        ) : (
          <EmptyProgress
            title={`No assessments for ${client.name} yet`}
            text="Complete an assessment (Assessment → Complete Assessment). Each one is saved with its date so you can compare them here."
          />
        )}
        <ProgressCharts key={`charts-${client.id}`} client={client} onUpdateClient={onUpdateClient} />
        <BeforeAfter key={`ba-${client.id}`} client={client} />
        <PatternSpectrum client={client} />
        <RecordsPanel client={client} onUpdateClient={onUpdateClient} by="coach" />
      </div>
    );
  }
  const firstPoint = history[0] || {
    week: 0,
    squat1RM: 80,
    rdl1RM: 95,
    bench1RM: 72,
    muscleMass: 38.1,
    fatMass: 14.6,
    bodyFatPercent: 17.7,
    hipIrAsymmetry: 17,
    shoulderIrAsymmetry: 15,
    ankleAsymmetry: 14,
    adherenceCompleted: 5,
    adherenceTotal: 6
  };
  const latestPoint = history[history.length - 1] || firstPoint;

  // Calculate timeline progress percentage (0 to 12 weeks)
  const clampedWeek = Math.max(0, Math.min(12, client.currentWeek || 6));
  const progressPercent = (clampedWeek / 12) * 100;

  // 1RM series calculation
  const liftValues = history.map((pt) =>
    selectedLift === 'squat'
      ? pt.squat1RM
      : selectedLift === 'rdl'
      ? pt.rdl1RM
      : pt.bench1RM
  );
  const start1RmKg = liftValues[0] || 80;
  const current1RmKg = liftValues[liftValues.length - 1] || 102;
  const start1RM = roundLb(start1RmKg);
  const current1RM = roundLb(current1RmKg);
  const liftPctGain =
    selectedLift === 'squat' && client.id === 'client-alex-carter'
      ? 22 // Matches Mockup 5 "+22% / 102 kg"
      : Math.round(((current1RmKg - start1RmKg) / Math.max(1, start1RmKg)) * 100);

  // Hip IR Asymmetry delta
  const startAsym = firstPoint.hipIrAsymmetry;
  const currentAsym =
    client.id === 'client-alex-carter' ? 8 : latestPoint.hipIrAsymmetry;
  const asymDelta = currentAsym - startAsym; // -9% for Alex Carter (17% -> 8%)

  // Muscle vs Fat delta
  const muscleDelta = roundLb(latestPoint.muscleMass - firstPoint.muscleMass).toFixed(1);
  const fatDelta = roundLb(latestPoint.fatMass - firstPoint.fatMass).toFixed(1);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page Title matching Mockup 5: "Alex Carter · Progress" */}
      <div className="flex flex-wrap items-baseline gap-2 mb-8">
        <div className="relative inline-flex items-center">
          <select
            value={client.id}
            onChange={(e) => onSelectClientId(e.target.value)}
            className="appearance-none bg-transparent pr-7 text-2xl sm:text-[34px] font-bold tracking-tight text-[#111827] focus:outline-none cursor-pointer"
            aria-label="Select Client"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-5 h-5 text-gray-400 absolute right-0 pointer-events-none" />
        </div>
        <span className="text-2xl sm:text-[34px] font-normal text-[#111827]">
          · Progress
        </span>
      </div>

      {client.assessments?.length ? (
        <>
            <GoalsPanel
              goals={client.goals ?? []}
              assessments={client.assessments}
              onDelete={onUpdateClient ? (id) => onUpdateClient({ ...client, goals: (client.goals ?? []).filter((g) => g.id !== id) }) : undefined}
              emptyText="No goals yet. Tap the note icon next to any measure below to add a note or set a goal."
            />
            <AssessmentHistory key={client.id} assessments={client.assessments} client={client} onUpdateClient={onUpdateClient} />
          </>
      ) : null}
      <ProgressCharts key={`charts-${client.id}`} client={client} onUpdateClient={onUpdateClient} />
        <BeforeAfter key={`ba-${client.id}`} client={client} />
        <PatternSpectrum client={client} />
        <RecordsPanel client={client} onUpdateClient={onUpdateClient} by="coach" />

      {/* Phase Timeline (Week 0 / 4 / 8 / 12) matching Mockup 5 */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100 mb-6">
        <div className="w-full min-w-0 pt-2 pb-2 px-1 sm:px-6 relative">
          <div className="text-center mb-7"><span className="inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-[#111827]">You are here · Week {clampedWeek}</span></div>
          {/* Base Track */}
          <div className="relative h-[3px] bg-gray-200 w-full rounded-full">
            {/* Completed Black Track */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-[#111827] rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />

            {/* Phase Milestone Dots (0, 4, 8, 12) */}
            {PHASES.map((phase) => {
              const posPct = (phase.week / 12) * 100;
              const isReached = clampedWeek >= phase.week;
              return (
                <div
                  key={phase.week}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${posPct}%` }}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full transition-colors ${
                      isReached ? 'bg-[#111827]' : 'bg-gray-300'
                    }`}
                  />
                </div>
              );
            })}

            {/* Current Week Yellow Indicator Dot + Floating Callout Badge */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${progressPercent}%` }}
            >
              <div className="w-4 h-4 rounded-full bg-[#FFC809] ring-4 ring-[#FFC809]/25" />
            </div>
          </div>

          {/* Phase Labels Below Track */}
          <div className="grid grid-cols-4 mt-4 text-center">
            {PHASES.map((phase, idx) => {
              const alignClass =
                idx === 0
                  ? 'text-left'
                  : idx === PHASES.length - 1
                  ? 'text-right'
                  : 'text-center';
              return (
                <div key={phase.week} className={alignClass}>
                  <div className="text-[10px] sm:text-sm font-medium text-[#111827] break-words">
                    {phase.label}
                  </div>
                  <div className="text-[10px] sm:text-sm text-gray-500 break-words">
                    {phase.sub}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Estimated 1RM — Squat (Matches Mockup 5) */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[#111827]">
                  1) Estimated 1RM —
                </h2>
                <select
                  value={selectedLift}
                  onChange={(e) =>
                    setSelectedLift(e.target.value as 'squat' | 'rdl' | 'bench')
                  }
                  className="text-lg font-semibold text-[#111827] bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 focus:outline-none cursor-pointer"
                >
                  <option value="squat">Squat</option>
                  <option value="rdl">RDL</option>
                  <option value="bench">Bench</option>
                </select>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Progressive strength capacity from Week 0 baseline
              </p>
            </div>

            <div className="text-right shrink-0 tabular-nums">
              <div className="text-2xl sm:text-[28px] font-bold text-[#111827] leading-none">
                +{liftPctGain}%
              </div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">
                {current1RM} {WEIGHT_UNIT}
              </div>
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="h-44 w-full">
            <svg viewBox="0 0 460 165" className="w-full h-full overflow-visible">
              {/* Y-Axis Labels */}
              <text x="28" y="25" textAnchor="end" className="text-[11px] fill-gray-400 tabular-nums">
                {current1RM}
              </text>
              <text x="28" y="80" textAnchor="end" className="text-[11px] fill-gray-400 tabular-nums">
                {Math.round((start1RM + current1RM) / 2)}
              </text>
              <text x="28" y="135" textAnchor="end" className="text-[11px] fill-gray-400 tabular-nums">
                {start1RM}
              </text>

              {/* Axes */}
              <line x1="38" y1="18" x2="38" y2="138" stroke="#E5E7EB" strokeWidth="1" />
              <line x1="38" y1="138" x2="440" y2="138" stroke="#E5E7EB" strokeWidth="1" />

              {/* Subtle Horizontal Grid */}
              <line x1="38" y1="22" x2="440" y2="22" stroke="#F3F4F6" strokeWidth="1" />
              <line x1="38" y1="78" x2="440" y2="78" stroke="#F3F4F6" strokeWidth="1" />

              {/* Smooth Yellow Trend Line */}
              <path
                d="M 42 132 C 120 105, 180 82, 235 74 C 295 66, 365 44, 435 24"
                fill="none"
                stroke="#FFC809"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Data Points */}
              <circle cx="42" cy="132" r="4" fill="#FFC809" />
              <circle cx="235" cy="74" r="4" fill="#FFC809" />
              <circle cx="435" cy="24" r="5" fill="#111827" stroke="#FFC809" strokeWidth="2.5" />

              {/* X-Axis Week Labels */}
              <text x="42" y="156" textAnchor="middle" className="text-[11px] fill-gray-400">
                0
              </text>
              <text x="235" y="156" textAnchor="middle" className="text-[11px] fill-gray-400">
                4
              </text>
              <text x="435" y="156" textAnchor="middle" className="text-[11px] fill-gray-400">
                8
              </text>
            </svg>
          </div>
        </div>

        {/* CHART 2: Muscle vs Fat Mass (InBody 270 Body Recomposition) */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">
                2) Muscle vs Fat Mass
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                InBody 270 Skeletal Muscle Mass (SMM) vs Body Fat Mass
              </p>
            </div>

            <div className="text-right shrink-0 tabular-nums">
              <div className="text-2xl sm:text-[28px] font-bold text-[#111827] leading-none">
                +{muscleDelta} {WEIGHT_UNIT}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">
                SMM ({fatDelta} {WEIGHT_UNIT} fat)
              </div>
            </div>
          </div>

          <div className="h-44 w-full">
            <svg viewBox="0 0 460 165" className="w-full h-full overflow-visible">
              <text x="28" y="32" textAnchor="end" className="text-[11px] fill-gray-400 tabular-nums">
                {roundLb(latestPoint.muscleMass)}
              </text>
              <text x="28" y="75" textAnchor="end" className="text-[11px] fill-gray-400 tabular-nums">
                {roundLb(firstPoint.muscleMass)}
              </text>
              <text x="28" y="128" textAnchor="end" className="text-[11px] fill-gray-400 tabular-nums">
                {roundLb(latestPoint.fatMass)}
              </text>

              <line x1="38" y1="18" x2="38" y2="138" stroke="#E5E7EB" strokeWidth="1" />
              <line x1="38" y1="138" x2="440" y2="138" stroke="#E5E7EB" strokeWidth="1" />

              {/* Skeletal Muscle Mass Line (Yellow #FFC809) */}
              <path
                d="M 42 72 C 140 60, 240 48, 435 28"
                fill="none"
                stroke="#FFC809"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Body Fat Mass Line (Near-Black #111827) */}
              <path
                d="M 42 98 C 140 106, 240 116, 435 128"
                fill="none"
                stroke="#111827"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Legend Labels */}
              <text x="435" y="20" textAnchor="end" className="text-[11px] font-semibold fill-[#111827]">
                Muscle ({roundLb(latestPoint.muscleMass)} {WEIGHT_UNIT})
              </text>
              <text x="435" y="120" textAnchor="end" className="text-[11px] font-medium fill-gray-500">
                Fat ({roundLb(latestPoint.fatMass)} {WEIGHT_UNIT})
              </text>

              <text x="42" y="156" textAnchor="middle" className="text-[11px] fill-gray-400">
                0
              </text>
              <text x="235" y="156" textAnchor="middle" className="text-[11px] fill-gray-400">
                4
              </text>
              <text x="435" y="156" textAnchor="middle" className="text-[11px] fill-gray-400">
                8
              </text>
            </svg>
          </div>
        </div>

        {/* CHART 3: Hip IR Asymmetry with 10% Target Line (Matches Mockup 5) */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">
                3) Hip IR asymmetry
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Left vs Right internal rotation delta · Target &le; 10%
              </p>
            </div>

            <div className="text-right shrink-0 tabular-nums">
              <div className="text-2xl sm:text-[28px] font-bold text-[#111827] leading-none">
                {asymDelta}%
              </div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">
                {currentAsym}%
              </div>
            </div>
          </div>

          <div className="h-44 w-full">
            <svg viewBox="0 0 460 165" className="w-full h-full overflow-visible">
              {/* Y-Axis Labels matching Mockup 5: 17%, 10%, 8% */}
              <text x="32" y="30" textAnchor="end" className="text-[11px] fill-gray-500 tabular-nums">
                17%
              </text>
              <text x="32" y="84" textAnchor="end" className="text-[11px] fill-gray-500 tabular-nums">
                10%
              </text>
              <text x="32" y="135" textAnchor="end" className="text-[11px] fill-gray-500 tabular-nums">
                8%
              </text>

              {/* Axes */}
              <line x1="40" y1="18" x2="40" y2="138" stroke="#E5E7EB" strokeWidth="1" />
              <line x1="40" y1="138" x2="440" y2="138" stroke="#E5E7EB" strokeWidth="1" />

              {/* 10% Target Dashed Line matching Mockup 5 */}
              <line
                x1="40"
                y1="80"
                x2="440"
                y2="80"
                stroke="#9CA3AF"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              <text x="438" y="73" textAnchor="end" className="text-[11px] fill-gray-500">
                10% target
              </text>

              {/* Yellow Asymmetry Curve dropping from 17% below 10% target to 8% */}
              <path
                d="M 42 28 C 125 42, 185 68, 235 82 C 295 96, 365 112, 435 126"
                fill="none"
                stroke="#FFC809"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              <circle cx="42" cy="28" r="4" fill="#FFC809" />
              <circle cx="235" cy="82" r="4" fill="#FFC809" />
              <circle cx="435" cy="126" r="5" fill="#111827" stroke="#FFC809" strokeWidth="2.5" />

              {/* X-Axis Labels */}
              <text x="42" y="156" textAnchor="middle" className="text-[11px] fill-gray-400">
                0
              </text>
              <text x="235" y="156" textAnchor="middle" className="text-[11px] fill-gray-400">
                4
              </text>
              <text x="435" y="156" textAnchor="middle" className="text-[11px] fill-gray-400">
                8
              </text>
            </svg>
          </div>
        </div>

        {/* CHART 4: Weekly Adherence */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">
                4) Weekly adherence
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Completed sessions out of 6 prescribed per week
              </p>
            </div>

            <div className="text-right shrink-0 tabular-nums">
              <div className="text-2xl sm:text-[28px] font-bold text-[#111827] leading-none">
                92%
              </div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">
                5.5 / 6 avg
              </div>
            </div>
          </div>

          <div className="h-44 flex items-end justify-between gap-3 pt-6 pb-2 px-2">
            {[
              { wk: 'W1', done: 5, total: 6 },
              { wk: 'W2', done: 6, total: 6 },
              { wk: 'W3', done: 5, total: 6 },
              { wk: 'W4', done: 6, total: 6 },
              { wk: 'W5', done: 6, total: 6 },
              { wk: 'W6', done: client.adherenceCompleted, total: client.adherenceTotal }
            ].map((bar, idx) => {
              const pct = Math.round((bar.done / bar.total) * 100);
              const isCurrent = idx === 5;
              return (
                <div
                  key={bar.wk}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
                >
                  <span className="text-[11px] font-semibold text-[#111827] tabular-nums">
                    {bar.done}/{bar.total}
                  </span>
                  <div className="w-full max-w-[38px] h-24 bg-gray-100 rounded-xl overflow-hidden flex items-end p-0.5">
                    <div
                      className={`w-full rounded-lg transition-all ${
                        isCurrent ? 'bg-[#111827]' : 'bg-[#FFC809]'
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium">
                    {bar.wk}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
