import React, { useState } from 'react';
import { EmptyProgress } from '../EmptyProgress';
import { ProgressReport } from './ProgressReport';
import {
  Printer,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Play
} from 'lucide-react';
import { ClientProfile } from '../../types';
import { WEIGHT_UNIT, formatWeight, roundLb } from '../../lib/units';
import { ClientAvatar, PureFunctionLogo } from '../VisualAssets';

interface MonthlyReportViewProps {
  clients: ClientProfile[];
  client: ClientProfile;
  onSelectClientId: (id: string) => void;
  onUpdateClient: (updated: ClientProfile) => void;
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  clients,
  client,
  onSelectClientId,
  onUpdateClient
}) => {
  const [selectedMonth, setSelectedMonth] = useState<1 | 2 | 3>(2);
  const [savedNotice, setSavedNotice] = useState(false);

  const report = client.monthlyReports[selectedMonth];
  // Real report from saved assessments (all real clients); sample clients keep the demo report.
  if ((client.assessments?.length ?? 0) > 0) {
    return (
      <ProgressReport
        key={client.id}
        clients={clients}
        client={client}
        onSelectClientId={onSelectClientId}
        onUpdateClient={onUpdateClient}
      />
    );
  }
  if (client.progressHistory.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <select
          value={client.id}
          onChange={(e) => onSelectClientId(e.target.value)}
          aria-label="Client"
          className="text-base font-semibold text-[#111827] bg-transparent focus:outline-none cursor-pointer mb-2"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <EmptyProgress
          title={`No report for ${client.name} yet`}
          text="Complete an assessment first. The report compares any two assessments (week 0 → week 4, 8, 12) with goals, records, sessions and before/after videos."
        />
      </div>
    );
  }

  const handleUpdateCoachNotes = (newSummary: string) => {
    onUpdateClient({
      ...client,
      monthlyReports: {
        ...client.monthlyReports,
        [selectedMonth]: {
          ...report,
          coachSummary: newSummary
        }
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const metricCards = [
    {
      label: 'Estimated Squat 1RM',
      week0: formatWeight(report.metrics.squat1RmKg.week0),
      current: formatWeight(report.metrics.squat1RmKg.current),
      delta: `+${roundLb(
        report.metrics.squat1RmKg.current - report.metrics.squat1RmKg.week0
      )} ${WEIGHT_UNIT} (+${Math.round(
        ((report.metrics.squat1RmKg.current - report.metrics.squat1RmKg.week0) /
          report.metrics.squat1RmKg.week0) *
          100
      )}%)`,
      highlight: true
    },
    {
      label: 'Hip IR Asymmetry',
      week0: `${report.metrics.hipIrAsymmetryPct.week0}%`,
      current: `${report.metrics.hipIrAsymmetryPct.current}%`,
      delta: `${report.metrics.hipIrAsymmetryPct.current - report.metrics.hipIrAsymmetryPct.week0}% (Target ≤10%)`,
      highlight: true
    },
    {
      label: 'Skeletal Muscle Mass',
      week0: formatWeight(report.metrics.muscleMassKg.week0),
      current: formatWeight(report.metrics.muscleMassKg.current),
      delta: `+${roundLb(
        report.metrics.muscleMassKg.current - report.metrics.muscleMassKg.week0
      ).toFixed(1)} ${WEIGHT_UNIT}`,
      highlight: false
    },
    {
      label: 'Body Fat Percentage',
      week0: `${report.metrics.bodyFatPct.week0}%`,
      current: `${report.metrics.bodyFatPct.current}%`,
      delta: `${(
        report.metrics.bodyFatPct.current - report.metrics.bodyFatPct.week0
      ).toFixed(1)}%`,
      highlight: false
    },
    {
      label: 'Body Weight (InBody 270)',
      week0: formatWeight(report.metrics.weightKg.week0),
      current: formatWeight(report.metrics.weightKg.current),
      delta: `${roundLb(
        report.metrics.weightKg.current - report.metrics.weightKg.week0
      ).toFixed(1)} ${WEIGHT_UNIT}`,
      highlight: false
    },
    {
      label: 'Session Adherence',
      week0: `${report.metrics.adherencePct.week0}%`,
      current: `${report.metrics.adherencePct.current}%`,
      delta: `+${report.metrics.adherencePct.current - report.metrics.adherencePct.week0}%`,
      highlight: false
    }
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Top Controls (Hidden when printing) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-[34px] font-bold tracking-tight text-[#111827] leading-tight">
            Monthly Report
          </h1>
          <div className="flex items-center gap-2 mt-1 text-sm sm:text-base text-gray-500">
            <div className="relative inline-flex items-center">
              <select
                value={client.id}
                onChange={(e) => onSelectClientId(e.target.value)}
                aria-label="Client"
                className="appearance-none bg-transparent pr-5 font-medium text-[#111827] focus:outline-none cursor-pointer"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-0 pointer-events-none" />
            </div>
            <span>·</span>
            <span>Compared to Week 0 Baseline</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month 1 / 2 / 3 Tabs */}
          <div className="inline-flex items-center bg-white border border-gray-200 rounded-xl p-1">
            {([1, 2, 3] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  selectedMonth === m
                    ? 'bg-[#111827] text-white'
                    : 'text-gray-600 hover:text-[#111827]'
                }`}
              >
                Month {m}
              </button>
            ))}
          </div>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-[#111827] hover:bg-[#1F2937] text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4 text-[#FFC809]" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-gray-100 print-card space-y-8">
        {/* Report Banner Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <ClientAvatar name={client.name} photoUrl={client.photoUrl} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-[#111827]">
                  {client.name}
                </h2>
                <span className="bg-[#FEF3C7] text-[#92400E] text-xs font-semibold px-3 py-0.5 rounded-full">
                  {report.weeksLabel}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Completed: <strong className="text-[#111827]">{report.phaseCompleted}</strong> · Next:{' '}
                <strong className="text-[#111827]">{report.nextPhase}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:items-end">
            <PureFunctionLogo />
            <span className="text-[11px] text-gray-400 mt-1">
              Clinical Biomechanics & Strength Report
            </span>
          </div>
        </div>

        {/* Section 1: Key Results Compared to Week 0 */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3.5">
            Key Results Compared to Week 0 Baseline
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {metricCards.map((item) => (
              <div
                key={item.label}
                className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-500">
                    {item.label}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full tabular-nums ${
                      item.highlight
                        ? 'bg-[#FFC809] text-[#111827]'
                        : 'bg-gray-200/70 text-[#111827]'
                    }`}
                  >
                    {item.delta}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-sm text-gray-400 line-through">
                    {item.week0}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xl font-bold text-[#111827]">
                    {item.current}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Before / After Video & Kinematic Comparison */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3.5">
            Before / After Biomechanical Video Comparison (Week 0 vs Month {selectedMonth})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Week 0 Before Frame */}
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-[#1F2937] p-4 text-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-full">
                  Week 0 · Baseline Assessment
                </span>
                <span className="text-xs text-gray-300 font-mono">
                  Hip IR Asymmetry: {report.metrics.hipIrAsymmetryPct.week0}%
                </span>
              </div>

              <div className="h-44 rounded-lg bg-[#111827] flex items-center justify-center relative overflow-hidden">
                <svg viewBox="0 0 320 170" className="w-full h-full">
                  <line
                    x1="160"
                    y1="10"
                    x2="160"
                    y2="160"
                    stroke="rgba(255,255,255,0.2)"
                    strokeDasharray="3 3"
                  />
                  {/* Slightly shifted pelvis & tilted shoulders at Week 0 */}
                  <circle cx="166" cy="36" r="9" stroke="#9CA3AF" strokeWidth="2" fill="none" />
                  <line x1="142" y1="58" x2="188" y2="66" stroke="#F59E0B" strokeWidth="2.5" />
                  <line x1="165" y1="45" x2="170" y2="104" stroke="#E5E7EB" strokeWidth="2.5" />
                  <line x1="150" y1="106" x2="188" y2="98" stroke="#F59E0B" strokeWidth="2.5" />
                  <line x1="152" y1="106" x2="148" y2="152" stroke="#E5E7EB" strokeWidth="2.5" />
                  <line x1="186" y1="98" x2="184" y2="152" stroke="#E5E7EB" strokeWidth="2.5" />
                </svg>
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] text-gray-300">
                  <span className="inline-flex items-center gap-1">
                    <Play className="w-3 h-3 text-[#FFC809] fill-[#FFC809]" /> Right pelvic shift (+4.2°)
                  </span>
                  <span>Left AIC Pattern</span>
                </div>
              </div>
            </div>

            {/* Month N After Frame */}
            <div className="rounded-xl border border-[#111827] overflow-hidden bg-[#1F2937] p-4 text-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold bg-[#FFC809] text-[#111827] px-2.5 py-1 rounded-full">
                  Month {selectedMonth} · Re-Assessment
                </span>
                <span className="text-xs text-[#FFC809] font-mono font-semibold">
                  Hip IR Asymmetry: {report.metrics.hipIrAsymmetryPct.current}%
                </span>
              </div>

              <div className="h-44 rounded-lg bg-[#111827] flex items-center justify-center relative overflow-hidden">
                <svg viewBox="0 0 320 170" className="w-full h-full">
                  <line
                    x1="160"
                    y1="10"
                    x2="160"
                    y2="160"
                    stroke="#FFC809"
                    strokeDasharray="3 3"
                  />
                  {/* Symmetrical aligned pelvis & shoulders */}
                  <circle cx="160" cy="36" r="9" stroke="#FFFFFF" strokeWidth="2" fill="none" />
                  <line x1="138" y1="60" x2="182" y2="60" stroke="#FFC809" strokeWidth="2.5" />
                  <line x1="160" y1="45" x2="160" y2="102" stroke="#FFFFFF" strokeWidth="2.5" />
                  <line x1="142" y1="102" x2="178" y2="102" stroke="#FFC809" strokeWidth="2.5" />
                  <line x1="144" y1="102" x2="142" y2="152" stroke="#FFFFFF" strokeWidth="2.5" />
                  <line x1="176" y1="102" x2="178" y2="152" stroke="#FFFFFF" strokeWidth="2.5" />
                </svg>
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] text-gray-200">
                  <span className="inline-flex items-center gap-1">
                    <Play className="w-3 h-3 text-[#FFC809] fill-[#FFC809]" /> Neutral pelvis stack (&lt;1.0°)
                  </span>
                  <span className="text-[#FFC809] font-medium">ZOA Restored</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Summary Charts (Strength & Symmetry Progression) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#111827]">
                Squat 1RM Progression
              </span>
              <span className="text-xs font-bold text-[#111827] tabular-nums">
                {formatWeight(report.metrics.squat1RmKg.week0)} → {formatWeight(report.metrics.squat1RmKg.current)}
              </span>
            </div>
            <svg viewBox="0 0 320 90" className="w-full h-24">
              <line x1="10" y1="75" x2="310" y2="75" stroke="#E5E7EB" strokeWidth="1" />
              <path
                d="M 16 70 C 110 52, 200 34, 304 16"
                fill="none"
                stroke="#FFC809"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="16" cy="70" r="3.5" fill="#FFC809" />
              <circle cx="304" cy="16" r="4" fill="#111827" stroke="#FFC809" strokeWidth="2" />
            </svg>
          </div>

          <div className="p-4 rounded-xl border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#111827]">
                Hip IR Asymmetry Reduction (10% Target)
              </span>
              <span className="text-xs font-bold text-[#111827] tabular-nums">
                {report.metrics.hipIrAsymmetryPct.week0}% → {report.metrics.hipIrAsymmetryPct.current}%
              </span>
            </div>
            <svg viewBox="0 0 320 90" className="w-full h-24">
              <line x1="10" y1="75" x2="310" y2="75" stroke="#E5E7EB" strokeWidth="1" />
              <line
                x1="10"
                y1="46"
                x2="310"
                y2="46"
                stroke="#9CA3AF"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <path
                d="M 16 18 C 110 34, 200 52, 304 66"
                fill="none"
                stroke="#FFC809"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="16" cy="18" r="3.5" fill="#FFC809" />
              <circle cx="304" cy="66" r="4" fill="#111827" stroke="#FFC809" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Section 4: Coach Notes & Next Phase Prescription */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
          <div className="md:col-span-7">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Coach Clinical Summary & Notes
              </label>
              {savedNotice && (
                <span className="text-[11px] text-emerald-700 font-medium">
                  Saved
                </span>
              )}
            </div>
            <textarea
              rows={4}
              value={report.coachSummary}
              onChange={(e) => {
                handleUpdateCoachNotes(e.target.value);
                setSavedNotice(true);
                setTimeout(() => setSavedNotice(false), 1500);
              }}
              className="w-full border border-gray-200 rounded-xl p-3.5 text-sm text-[#111827] leading-relaxed focus:outline-none focus:border-[#111827]"
            />
          </div>

          <div className="md:col-span-5 bg-[#FFFDF5] border border-[#FEF3C7] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#92400E]">
                Next Phase Prescription
              </span>
              <span className="text-xs font-bold text-[#111827]">
                {report.nextPhase}
              </span>
            </div>
            <ul className="space-y-2">
              {report.nextPhaseFocus.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-[#111827]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#F5B800] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
