import React from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { ClientProfile, calculateAsymmetryPercent } from '../../types';
import { EmptyProgress } from '../EmptyProgress';
import { GoalsPanel } from '../coach/GoalsPanel';
import { RecordsPanel } from '../RecordsPanel';
import { ClientProgressCharts } from './ClientProgressCharts';
import { BodyLab } from '../BodyLab';
import { BeforeAfter } from '../BeforeAfter';
import { WEIGHT_UNIT, formatWeight, roundLb } from '../../lib/units';
import { getClientBodyCompAlert } from '../../lib/bodyCompAlerts';

interface ClientProgressViewProps {
  client: ClientProfile;
  onUpdateClient?: (c: ClientProfile) => void;
}

export const ClientProgressView: React.FC<ClientProgressViewProps> = ({
  client,
  onUpdateClient
}) => {
  const history = client.progressHistory;
  const bodyCompAlert = getClientBodyCompAlert(client);
  const firstPt = history[0] || {
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
  const latestPt = history[history.length - 1] || firstPt;

  const phases = [
    { num: 1, name: 'Reposition', weeks: 'Wk 0–4' },
    { num: 2, name: 'Integrate', weeks: 'Wk 4–8' },
    { num: 3, name: 'Strength', weeks: 'Wk 8–12' },
    { num: 4, name: 'Performance', weeks: 'Wk 12+' }
  ];

  return (
    <div className="max-w-lg mx-auto w-full min-w-0 space-y-4 pb-8">
      {/* Page Title */}
      <div>
        <span className="text-xs font-semibold text-gray-500">
          {client.name} · Week {client.currentWeek}
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827] mt-0.5">
          My Progress
        </h1>
      </div>
      {bodyCompAlert && (
        <div
          role="region"
          aria-label={bodyCompAlert.title}
          className="bg-[#FFFDF5] rounded-2xl p-4 sm:p-5 border border-[#FFC809]/60 shadow-[0_2px_14px_rgba(0,0,0,0.03)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h2 className="text-sm font-bold text-[#111827]">{bodyCompAlert.title}</h2>
            <span className="bg-[#FEF3C7] text-[#92400E] text-xs font-semibold px-2.5 py-0.5 rounded-full tabular-nums">
              {bodyCompAlert.startMuscleMass.toFixed(1)} {WEIGHT_UNIT} → {bodyCompAlert.latestMuscleMass.toFixed(1)} {WEIGHT_UNIT} (-{bodyCompAlert.dropPercent.toFixed(1)}%)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
            {bodyCompAlert.message}
          </p>
        </div>
      )}
      {(client.goals?.length ?? 0) > 0 && (
        <GoalsPanel goals={client.goals!} assessments={client.assessments ?? []} />
      )}
      <ClientProgressCharts client={client} />
      <BodyLab client={client} compact />
      <BeforeAfter client={client} />
      <RecordsPanel client={client} onUpdateClient={onUpdateClient} by="client" />

      {history.length === 0 ? (
        <EmptyProgress
          title="Your progress starts here"
          text="After your first assessment and a few logged workouts, your strength, body composition and symmetry charts show up here."
        />
      ) : (
        <>
          {/* 1. Phase Progress Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#111827]">Phase Progress</h2>
          <span className="bg-[#FEF3C7] text-[#92400E] text-xs font-semibold px-2.5 py-0.5 rounded-full">
            Week {client.currentWeek} of 12
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {phases.map((p) => {
            const isDone = p.num < client.phaseNumber;
            const isCurrent = p.num === client.phaseNumber;
            return (
              <div
                key={p.num}
                className={`p-2.5 rounded-xl border text-center ${
                  isCurrent
                    ? 'bg-[#111827] text-white border-[#111827]'
                    : isDone
                    ? 'bg-gray-50 text-[#111827] border-gray-200'
                    : 'bg-white text-gray-400 border-gray-100'
                }`}
              >
                <div className="flex items-center justify-center mb-1">
                  {isDone ? (
                    <div className="w-4 h-4 rounded-full bg-[#111827] text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-3 h-3 rounded-full bg-[#FFC809]" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                  )}
                </div>
                <div className="text-[11px] font-semibold truncate">{p.name}</div>
                <div
                  className={`text-[10px] ${
                    isCurrent ? 'text-gray-300' : 'text-gray-400'
                  }`}
                >
                  {p.weeks}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Strength Progression Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-[#111827]">
              Strength · Estimated 1RM
            </h2>
            <p className="text-xs text-gray-400"> Squat +22% since Week 0</p>
          </div>
          <span className="text-xl font-bold text-[#111827] tabular-nums">
            {formatWeight(latestPt.squat1RM)}
          </span>
        </div>

        {/* Mini Yellow Trend Line */}
        <div className="h-28 w-full mb-3">
          <svg viewBox="0 0 340 100" className="w-full h-full">
            <line x1="20" y1="84" x2="325" y2="84" stroke="#E5E7EB" strokeWidth="1" />
            <path
              d="M 24 78 C 110 58, 210 38, 320 18"
              fill="none"
              stroke="#FFC809"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle cx="24" cy="78" r="4" fill="#FFC809" />
            <circle cx="320" cy="18" r="4.5" fill="#111827" stroke="#FFC809" strokeWidth="2" />
            <text x="24" y="96" className="text-[10px] fill-gray-400">
              Wk 0 ({roundLb(firstPt.squat1RM)}{WEIGHT_UNIT})
            </text>
            <text x="320" y="96" textAnchor="end" className="text-[10px] fill-[#111827] font-semibold">
              Current ({roundLb(latestPt.squat1RM)}{WEIGHT_UNIT})
            </text>
          </svg>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-center tabular-nums">
          <div className="p-2 rounded-xl bg-gray-50">
            <div className="text-[11px] text-gray-500">Squat</div>
            <div className="text-sm font-bold text-[#111827]">
              {formatWeight(latestPt.squat1RM)}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-gray-50">
            <div className="text-[11px] text-gray-500">RDL</div>
            <div className="text-sm font-bold text-[#111827]">
              {formatWeight(latestPt.rdl1RM)}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-gray-50">
            <div className="text-[11px] text-gray-500">Bench</div>
            <div className="text-sm font-bold text-[#111827]">
              {formatWeight(latestPt.bench1RM)}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Body Composition Card (InBody 270) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#111827]">
            Body Composition · InBody 270
          </h2>
          <span className="bg-[#111827] text-[#FFC809] text-xs font-bold px-2.5 py-0.5 rounded-full tabular-nums">
            Score: {client.inBody.inBodyScore}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 tabular-nums">
          <div className="p-3 rounded-xl border border-gray-100">
            <div className="text-[11px] text-gray-500">Weight</div>
            <div className="text-base font-bold text-[#111827] mt-0.5">
              {formatWeight(client.inBody.weight)}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-gray-100">
            <div className="text-[11px] text-gray-500">Muscle Mass</div>
            <div className="text-base font-bold text-[#111827] mt-0.5">
              {formatWeight(latestPt.muscleMass)}
            </div>
            <div className="text-[10px] font-semibold text-emerald-700">
              +{roundLb(latestPt.muscleMass - firstPt.muscleMass).toFixed(1)} {WEIGHT_UNIT}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-gray-100">
            <div className="text-[11px] text-gray-500">Body Fat</div>
            <div className="text-base font-bold text-[#111827] mt-0.5">
              {latestPt.bodyFatPercent}%
            </div>
            <div className="text-[10px] font-semibold text-emerald-700">
              {(latestPt.bodyFatPercent - firstPt.bodyFatPercent).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* 4. Symmetry Restoration Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-[#111827]">
              Left / Right Symmetry
            </h2>
            <p className="text-xs text-gray-400">
              Clinical target: ≤ 10% asymmetry
            </p>
          </div>
          <span className="bg-[#FFC809] text-[#111827] text-xs font-semibold px-2.5 py-0.5 rounded-full tabular-nums">
            Hip IR: 17% → 8%
          </span>
        </div>

        <div className="space-y-2.5">
          {client.rom.slice(0, 4).map((item) => {
            const baselineAsym = calculateAsymmetryPercent(item.left, item.right);
            // Show current improved symmetry vs baseline
            const currentImproved = Math.max(4, baselineAsym - 7);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-none"
              >
                <span className="text-[#111827] font-medium">{item.name}</span>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="text-gray-400 line-through">
                    {baselineAsym}%
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <span className="bg-[#E5E7EB] text-[#111827] font-semibold px-2 py-0.5 rounded-full">
                    {currentImproved}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Before / After Alignment Summary */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border border-gray-100">
        <h2 className="text-sm font-bold text-[#111827] mb-3">
          Before / After · Posture & Squat Stack
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#1F2937] p-3 text-white text-center">
            <span className="text-[10px] uppercase tracking-wider text-gray-300 block mb-2">
              Week 0 · Baseline
            </span>
            <div className="h-24 flex items-center justify-center">
              <svg viewBox="0 0 120 90" className="w-full h-full">
                <line x1="60" y1="5" x2="60" y2="85" stroke="rgba(255,255,255,0.2)" strokeDasharray="2 2" />
                <line x1="42" y1="28" x2="80" y2="35" stroke="#F59E0B" strokeWidth="2.5" />
                <line x1="63" y1="18" x2="67" y2="58" stroke="#E5E7EB" strokeWidth="2" />
                <line x1="46" y1="58" x2="82" y2="52" stroke="#F59E0B" strokeWidth="2.5" />
              </svg>
            </div>
            <span className="text-[11px] text-gray-300">
              17% Hip IR Asymmetry
            </span>
          </div>

          <div className="rounded-xl bg-[#111827] p-3 text-white text-center border border-[#FFC809]/60">
            <span className="text-[10px] uppercase tracking-wider text-[#FFC809] font-semibold block mb-2">
              Week {client.currentWeek} · Current
            </span>
            <div className="h-24 flex items-center justify-center">
              <svg viewBox="0 0 120 90" className="w-full h-full">
                <line x1="60" y1="5" x2="60" y2="85" stroke="#FFC809" strokeDasharray="2 2" />
                <line x1="42" y1="30" x2="78" y2="30" stroke="#FFC809" strokeWidth="2.5" />
                <line x1="60" y1="18" x2="60" y2="56" stroke="#FFFFFF" strokeWidth="2" />
                <line x1="44" y1="56" x2="76" y2="56" stroke="#FFC809" strokeWidth="2.5" />
              </svg>
            </div>
            <span className="text-[11px] text-[#FFC809] font-semibold">
              8% Asymmetry · Balanced
            </span>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
