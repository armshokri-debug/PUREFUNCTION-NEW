import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientProfile } from '../../types';
import { SpectrumOfPatterns } from '../../components/coach/SpectrumOfPatterns';
import {
  SPECTRUM_ROWS,
  SpectrumTestsMap,
  classifyRow,
  clientFindings,
  evaluateSpectrum,
  parseDegreeInput,
  resolveSpectrumTests
} from '../spectrum';

describe('spectrum of patterns', () => {
  it('scores an all-normal client as Functionally Left/Right Lateralized (none)', () => {
    const allNormal: SpectrumTestsMap = {
      'shoulder-ir': { left: 90, right: 90 },
      'shoulder-er': { left: 90, right: 90 },
      'shoulder-abd': { left: 45, right: 45 },
      'shoulder-flex': { left: 140, right: 140 },
      'trunk-rot': { left: 70, right: 70 },
      obers: { left: 'Knee to table', right: 'Knee to table' },
      'hip-abd': { left: 45, right: 45 },
      'hip-flex': { left: 140, right: 140 },
      slr: { left: 90, right: 90 },
      'hip-ir': { left: 40, right: 40 },
      'hip-er': { left: 45, right: 45 },
      foot: { left: 'Balanced' }
    };

    for (const row of SPECTRUM_ROWS) {
      const res = classifyRow(row, allNormal[row.id]);
      expect(res).toBe(row.kind === 'foot' ? 'Balanced' : 'none');
    }

    const evalRes = evaluateSpectrum(allNormal);
    expect(evalRes.measuredCount).toBe(12);
    expect(evalRes.scores.A).toBe(12);
    expect(evalRes.scores.F).toBe(12);
    expect(evalRes.bestPattern?.key).toBe('A');
    expect(evalRes.bestPattern?.label).toBe('Functionally Left Lateralized');
  });

  it('scores a client with L shoulder IR + R shoulder ER + R hip IR limited as In-Tact Left Lateralized', () => {
    const tests: SpectrumTestsMap = {
      'shoulder-ir': { left: 65, right: 90 }, // L limited (< 81)
      'shoulder-er': { left: 90, right: 72 }, // R limited (< 81)
      'hip-ir': { left: 40, right: 28 } // R limited (< 36)
    };

    const evalRes = evaluateSpectrum(tests);
    expect(evalRes.rowResults['shoulder-ir']).toBe('L');
    expect(evalRes.rowResults['shoulder-er']).toBe('R');
    expect(evalRes.rowResults['hip-ir']).toBe('R');
    expect(evalRes.measuredCount).toBe(3);
    expect(evalRes.scores.B).toBe(3);
    expect(evalRes.bestPattern?.key).toBe('B');
    expect(evalRes.bestPattern?.label).toBe('In-Tact Left Lateralized');
    expect(evalRes.summaryText).toBe('3 / 3 tests matched — Best match: In-Tact Left Lateralized');
  });

  it('awards 0.5 points when Both(L) vs Both(R) on bidirectional limitation', () => {
    const tests: SpectrumTestsMap = {
      'shoulder-ir': { left: 60, right: 75 } // Both limited, left lower -> Both(L)
    };
    const evalRes = evaluateSpectrum(tests);
    expect(evalRes.rowResults['shoulder-ir']).toBe('Both(L)');
    expect(evalRes.scores.C).toBe(1);
    expect(evalRes.scores.D).toBe(0.5);
  });

  it('clientFindings reads spectrumTests first, falls back to latestRom, applies 90%/70% rule, and formats degrees', () => {
    const findings = clientFindings({
      rom: [
        { id: '1', name: 'Shoulder internal rotation', left: 75, right: 22, normalMax: 70 },
        { id: '2', name: 'Hip internal rotation', left: 38, right: 30, normalMax: 45 },
        { id: '3', name: 'Shoulder abduction', left: 42, right: 44, normalMax: 45 }
      ],
      spectrumTests: {
        // Override Hip IR right side from 30 -> 39 (so both >= 90% of Full 40)
        'hip-ir': { left: 38, right: 39 },
        // Add Shoulder ER directly in spectrumTests (Full = 90; 70% = 63, 90% = 81)
        'shoulder-er': { left: 85, right: 70 }
      }
    });

    const shIr = findings.find((f) => f.key === 'shoulder-ir')!;
    expect(shIr.full).toBe(90);
    expect(shIr.left).toBe(75);
    expect(shIr.right).toBe(22);
    expect(shIr.sideLimited).toBe('both'); // 75 < 81 and 22 < 81
    expect(shIr.worse).toBe('R');
    expect(shIr.severity).toBe('work'); // 22 < 63 (70% of 90)
    expect(shIr.diffText).toBe('Right 53° less than left');
    expect(shIr.diffText).not.toContain('%');

    const shEr = findings.find((f) => f.key === 'shoulder-er')!;
    expect(shEr.full).toBe(90);
    expect(shEr.sideLimited).toBe('R'); // 85 >= 81, 70 < 81
    expect(shEr.worse).toBe('R');
    expect(shEr.severity).toBe('watch'); // 70 >= 63 (70% of 90) and < 81
    expect(shEr.diffText).toBe('Right 15° less than left');

    const hipIr = findings.find((f) => f.key === 'hip-ir')!;
    expect(hipIr.full).toBe(40);
    expect(hipIr.left).toBe(38);
    expect(hipIr.right).toBe(39);
    expect(hipIr.sideLimited).toBe('none'); // both >= 36 (90% of 40)
    expect(hipIr.severity).toBe('ok');
    expect(hipIr.diffText).toBe('Left 1° less than right');
  });

  it('keeps Left and Right independent with one side measured and an explicit blank', () => {
    const client = {
      rom: [],
      spectrumTests: { 'shoulder-ir': { left: 62, right: '' } }
    };
    const resolved = resolveSpectrumTests(client);
    expect(resolved['shoulder-ir']).toEqual({ left: 62, right: undefined });
    const found = clientFindings(client).find((f) => f.key === 'shoulder-ir')!;
    expect(found.left).toBe(62);
    expect(found.right).toBeNull();
    expect(found.worse).toBeNull();
    expect(found.sideLimited).toBe('L');
    expect(evaluateSpectrum(resolved).rowResults['shoulder-ir']).toBe('L');
  });

  it('renders an empty Right input when only Left was typed', () => {
    const client = { rom: [], spectrumTests: { 'shoulder-ir': { left: 62, right: '' } } } as unknown as ClientProfile;
    const html = renderToStaticMarkup(createElement(SpectrumOfPatterns, { client, onUpdateClient: () => {} }));
    const left = html.match(/<input[^>]*aria-label="Shoulder IR left degrees"[^>]*>/)?.[0];
    const right = html.match(/<input[^>]*aria-label="Shoulder IR right degrees"[^>]*>/)?.[0];
    expect(left).toContain('value="62"');
    expect(right).toContain('value=""');
  });

  it('finds only Right measured and does not fabricate a Left value', () => {
    const client = { rom: [], spectrumTests: { 'hip-ir': { right: 21 } } };
    const found = clientFindings(client).find((f) => f.key === 'hip-ir')!;
    expect(found.left).toBeNull();
    expect(found.right).toBe(21);
    expect(found.worse).toBeNull();
    expect(found.severity).toBe('work');
    expect(evaluateSpectrum(resolveSpectrumTests(client)).rowResults['hip-ir']).toBe('R');
  });

  it('treats negative historical saved degrees as unmeasured', () => {
    const client = { rom: [], spectrumTests: { 'shoulder-ir': { left: -8, right: 75 } } };
    const resolved = resolveSpectrumTests(client);
    expect(resolved['shoulder-ir'].left).toBeUndefined();
    const found = clientFindings(client).find((f) => f.key === 'shoulder-ir')!;
    expect(found.left).toBeNull();
    expect(found.right).toBe(75);
    expect(classifyRow(SPECTRUM_ROWS[0], { left: -8 })).toBeNull();
    expect(evaluateSpectrum({ 'shoulder-ir': { left: -8 } }).measuredCount).toBe(0);
  });

  it('validates 0..180 integer input without persisting negative or non-numeric values', () => {
    expect(parseDegreeInput('0')).toBe(0);
    expect(parseDegreeInput('180')).toBe(180);
    for (const invalid of ['-1', '181', '2.5', 'foo', '1e3', 'Infinity', ' 3']) {
      expect(parseDegreeInput(invalid)).toBeNull();
    }
  });

  it('renders paired side fields and closed mobile Patterns for every row', () => {
    const client = {
      rom: [], spectrumTests: { 'shoulder-ir': { left: 65, right: 90 } }
    } as unknown as ClientProfile;
    const html = renderToStaticMarkup(createElement(SpectrumOfPatterns, { client }));
    expect((html.match(/<details\b/g) ?? []).length).toBe(SPECTRUM_ROWS.length);
    expect(html).not.toMatch(/<details[^>]*\sopen(?:\s|=|>)/);
    expect(html).toContain('pf-spectrum-side');
    expect(html).toContain('pf-spectrum-full');
    expect(html).toContain('pf-spectrum-limited');
    expect(html).toContain('pf-spectrum-desktop-pattern');
    expect(html).toContain('pf-spectrum-patterns');
    expect(html).toContain('bg-green-100/90');
  });
});
