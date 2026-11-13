import React, { useMemo } from 'react';
import { ClientProfile } from '../../types';
import { SEVERITY_COLOR, Severity } from '../../lib/bodyModel';
import { formatWeight } from '../../lib/units';
import {
  ClientFinding,
  clientFindings,
  evaluateSpectrum,
  resolveSpectrumTests
} from '../../lib/spectrum';
import { sortWorstFindings } from '../BodyLab';

const dotStyle = (sev: Severity) => ({ backgroundColor: SEVERITY_COLOR[sev] });

function formatFindingSummary(f: ClientFinding): string {
  const side = f.worse ?? (f.left !== null ? 'L' : 'R');
  const val = Math.round((side === 'L' ? f.left : f.right) ?? 0);
  return `${side} ${f.label} ${val}° (Full ${f.full}°) — ${f.diffText}`;
}

export const AssessmentSummary: React.FC<{ client: ClientProfile }> = ({ client }) => {
  const assessments = client.assessments ?? [];
  const latestSnap = assessments.length > 0 ? assessments[assessments.length - 1] : null;
  const latestDate = latestSnap?.date ?? client.posture?.measuredOn ?? 'Current baseline';
  const latestWeek = latestSnap?.week ?? client.currentWeek;
  const inBody = latestSnap?.inBody ?? client.inBody;

  const findings = useMemo(() => clientFindings(client), [client]);
  const topFindings = useMemo(
    () => sortWorstFindings(findings.filter((f) => f.sideLimited !== 'none')).slice(0, 3),
    [findings]
  );

  const spectrumEval = useMemo(
    () => evaluateSpectrum(resolveSpectrumTests(client)),
    [client]
  );

  const spectrumSeverity: Severity = !spectrumEval.bestPattern
    ? 'watch'
    : spectrumEval.bestPattern.key === 'A' || spectrumEval.bestPattern.key === 'F'
      ? 'ok'
      : spectrumEval.bestPattern.key === 'B' || spectrumEval.bestPattern.key === 'E'
        ? 'watch'
        : 'work';

  return (
    <section className="bg-white rounded-[28px] border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-[#111827]">Assessment summary</h2>
          <p className="text-xs text-gray-500">
            Latest: <span className="font-semibold text-[#111827]">{latestDate}</span> · Week{' '}
            {latestWeek} · Next re-check in{' '}
            <span className="font-semibold text-[#111827]">{client.nextAssessmentDays} days</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-gray-100 font-semibold text-[#111827]">
            Weight: {formatWeight(inBody.weight)}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-gray-100 font-semibold text-[#111827]">
            Muscle: {formatWeight(inBody.skeletalMuscleMass)}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-gray-100 font-semibold text-[#111827]">
            Body fat: {inBody.bodyFatPercent}%
          </span>
        </div>
      </div>

      <div className="pt-3.5 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
            Top findings
          </div>
          {topFindings.length > 0 ? (
            <ul className="space-y-1.5">
              {topFindings.map((f) => (
                <li key={f.key} className="flex items-start gap-2 text-xs sm:text-sm text-[#111827]">
                  <span
                    className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                    style={dotStyle(f.severity)}
                  />
                  <span className="font-semibold">{formatFindingSummary(f)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={dotStyle('ok')} />
              <span>All measured tests are ≥ 90% of Full range.</span>
            </div>
          )}
        </div>

        <div className="md:border-l md:border-gray-100 md:pl-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
            Spectrum best pattern
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#111827]">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={dotStyle(spectrumSeverity)}
            />
            <span>{spectrumEval.summaryText}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
