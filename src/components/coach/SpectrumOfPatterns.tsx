import React, { useMemo } from 'react';
import { ClientProfile } from '../../types';
import {
  FOOT_OPTIONS,
  OBERS_OPTIONS,
  SPECTRUM_PATTERNS,
  SPECTRUM_ROWS,
  SpectrumRowDef,
  evaluateSpectrum,
  resolveSpectrumTests,
  parseDegreeInput,
  scoreCellMatch
} from '../../lib/spectrum';

export const SpectrumOfPatterns: React.FC<{
  client: ClientProfile;
  onUpdateClient?: (c: ClientProfile) => void;
}> = ({ client, onUpdateClient }) => {
  const resolved = useMemo(() => resolveSpectrumTests(client), [client]);
  const evaluation = useMemo(() => evaluateSpectrum(resolved), [resolved]);

  const updateCell = (rowId: string, side: 'left' | 'right', raw: string) => {
    if (!onUpdateClient) return;
    const prevSaved = client.spectrumTests ?? {};
    const prevRow = prevSaved[rowId] ?? resolved[rowId] ?? {};
    const rowDef = SPECTRUM_ROWS.find((r) => r.id === rowId);
    let nextVal: number | string | undefined;
    if (raw === '') {
      nextVal = '';
    } else if (rowDef?.kind === 'degrees') {
      const n = parseDegreeInput(raw);
      if (n === null) return; // Reject negative, fractions, >180 and non-numbers.
      nextVal = n;
    } else {
      nextVal = raw;
    }

    const nextRow =
      rowDef?.kind === 'foot'
        ? { left: nextVal, right: nextVal }
        : { ...prevRow, [side]: nextVal };

    onUpdateClient({
      ...client,
      spectrumTests: {
        ...prevSaved,
        [rowId]: nextRow
      }
    });
  };

  const renderInputs = (row: SpectrumRowDef) => {
    const entry = resolved[row.id] ?? {};
    if (row.kind === 'foot') {
      const val = String(entry.left ?? entry.right ?? '');
      return (
        <td colSpan={2} data-label="Selection" className="pf-spectrum-choice px-2.5 py-2 border-b border-gray-100">
          <select
            aria-label={`${row.label} selection`}
            value={val}
            disabled={!onUpdateClient}
            onChange={(e) => updateCell(row.id, 'left', e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#111827] focus:outline-none focus:border-[#111827]"
          >
            <option value="">Select…</option>
            {FOOT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </td>
      );
    }

    if (row.kind === 'obers') {
      return (['left', 'right'] as const).map((side) => {
        const val = String(entry[side] ?? '');
        return (
          <td key={side} data-label={side === 'left' ? 'Left' : 'Right'} className="pf-spectrum-side px-2 py-2 border-b border-gray-100">
            <select
              aria-label={`${row.label} ${side}`}
              value={val}
              disabled={!onUpdateClient}
              onChange={(e) => updateCell(row.id, side, e.target.value)}
              className="w-28 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-[#111827] focus:outline-none focus:border-[#111827]"
            >
              <option value="">—</option>
              {OBERS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </td>
        );
      });
    }

    return (['left', 'right'] as const).map((side) => {
      // Independent fields: blank must not display the opposite side's finding.
      const val = entry[side] ?? '';
      return (
        <td key={side} data-label={side === 'left' ? 'Left' : 'Right'} className="pf-spectrum-side px-2 py-2 border-b border-gray-100">
          <label className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-2.5 py-1">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={180}
              step={1}
              aria-label={`${row.label} ${side} degrees`}
              value={val}
              disabled={!onUpdateClient}
              placeholder={String(row.full)}
              onChange={(e) => updateCell(row.id, side, e.target.value)}
              className="w-12 text-xs font-semibold text-right text-[#111827] bg-transparent focus:outline-none"
            />
            <span className="text-[11px] text-gray-400 ml-0.5">°</span>
          </label>
        </td>
      );
    });
  };

  const winningKey = evaluation.bestPattern?.key ?? null;

  return (
    <section className="bg-white rounded-[28px] border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6 mb-6">
      <div className="w-full min-w-0">
        <table className="pf-responsive-table pf-spectrum-table w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500">
              <th className="py-2.5 pr-3 font-bold text-[#111827]">Test</th>
              <th className="py-2.5 px-2 font-bold text-gray-500">Full</th>
              <th className="py-2.5 px-2 font-bold text-[#111827]">Left</th>
              <th className="py-2.5 px-2 font-bold text-[#111827]">Right</th>
              <th className="py-2.5 px-2 font-bold text-gray-600">Limited</th>
              {SPECTRUM_PATTERNS.map((pat) => {
                const isWinner = winningKey === pat.key && evaluation.measuredCount > 0;
                const scoreVal = evaluation.scores[pat.key];
                const scoreText = Number.isInteger(scoreVal) ? String(scoreVal) : scoreVal.toFixed(1);
                return (
                  <th
                    key={pat.key}
                    style={isWinner ? { backgroundColor: '#FFC809' } : undefined}
                    className={`py-2.5 px-2.5 rounded-t-xl font-bold transition-colors ${
                      isWinner ? 'bg-[#FFC809] text-[#111827]' : 'text-gray-600'
                    }`}
                  >
                    <div className="text-[11px] font-extrabold">
                      {pat.code} · {pat.label}
                    </div>
                    {evaluation.measuredCount > 0 && (
                      <div className="text-[10px] font-semibold opacity-80 mt-0.5">
                        Score: {scoreText} / {evaluation.measuredCount}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {SPECTRUM_ROWS.map((row) => {
              const actual = evaluation.rowResults[row.id];
              return (
                <tr key={row.id} className="hover:bg-gray-50/60">
                  <td data-label="Test" className="pf-spectrum-test py-2 pr-3 border-b border-gray-100 font-semibold text-[#111827] whitespace-nowrap">
                    {row.label}
                  </td>
                  <td data-label="Full" className="pf-spectrum-full py-2 px-2 border-b border-gray-100 text-gray-500 whitespace-nowrap">
                    {typeof row.full === 'number' ? `${row.full}°` : row.full}
                  </td>
                  {renderInputs(row)}
                  <td data-label="Limited" className="pf-spectrum-limited py-2 px-2 border-b border-gray-100 font-bold text-[#111827] whitespace-nowrap">
                    {actual ?? '—'}
                  </td>
                  {SPECTRUM_PATTERNS.map((pat) => {
                    const exp = row.expected[pat.key];
                    const disp = row.displayExpected?.[pat.key] ?? exp;
                    const pts = scoreCellMatch(actual, exp);
                    const isExact = pts === 1;
                    const isPartial = pts === 0.5;
                    return (
                      <td
                        key={pat.key}
                        data-label={`${pat.code} · ${pat.label}`}
                        className={`pf-spectrum-desktop-pattern py-2 px-2.5 border-b border-gray-100 whitespace-nowrap font-medium ${
                          isExact
                            ? 'bg-green-100/90 text-green-900 font-bold'
                            : isPartial
                              ? 'bg-green-50 text-green-800 font-semibold'
                              : 'text-gray-500'
                        }`}
                      >
                        {disp}
                      </td>
                    );
                  })}
                  <td colSpan={6} className="pf-spectrum-patterns" data-label="Patterns">
                    <details className="w-full">
                      <summary className="min-h-[44px] cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#111827]">
                        Patterns
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        {SPECTRUM_PATTERNS.map((pat) => {
                          const exp = row.expected[pat.key];
                          const disp = row.displayExpected?.[pat.key] ?? exp;
                          const pts = scoreCellMatch(actual, exp);
                          return (
                            <div
                              key={pat.key}
                              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ${
                                pts === 1
                                  ? 'bg-green-100/90 text-green-900 font-bold'
                                  : pts === 0.5
                                    ? 'bg-green-50 text-green-800 font-semibold'
                                    : 'bg-white text-gray-600'
                              }`}
                            >
                              <span className="min-w-0 break-words">{pat.code} · {pat.label}</span>
                              <span className="break-words">{disp}</span>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-400 mt-3">
        Original SOP sheet credit: Applied Integration Academy
      </p>
    </section>
  );
};
