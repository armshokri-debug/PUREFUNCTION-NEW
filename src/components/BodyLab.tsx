import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { ClientProfile, PostureAngles } from '../types';
import {
  MOVEMENTS,
  MovementDef,
  POSTURE,
  PostureDef,
  SEVERITY_COLOR,
  Severity,
  View,
  postureToPose,
  ratePosture,
  rateRom,
  movementPose,
  solve
} from '../lib/bodyModel';
import { ClientFinding, clientFindings } from '../lib/spectrum';
import { BodyFigure, FigureArc, FigureLabel, FigureLine } from './BodyFigure';
import { todayISO } from '../lib/workouts';

const pill = 'min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap';
const sevBg: Record<Severity, string> = {
  ok: 'bg-green-50 text-green-700',
  watch: 'bg-amber-50 text-amber-800',
  work: 'bg-red-50 text-red-700'
};
const sevText: Record<Severity, string> = { ok: 'OK', watch: 'Watch', work: 'Work on' };
const sevRank: Record<Severity, number> = { work: 2, watch: 1, ok: 0 };

function shortFindingLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('shoulder internal') || lower === 'shoulder ir') return 'shoulder IR';
  if (lower.includes('shoulder external') || lower === 'shoulder er') return 'shoulder ER';
  if (lower.includes('shoulder abduction')) return 'shoulder abd';
  if (lower.includes('shoulder flexion')) return 'shoulder flex';
  if (lower.includes('hip internal') || lower === 'hip ir') return 'hip IR';
  if (lower.includes('hip external') || lower === 'hip er') return 'hip ER';
  if (lower.includes('hip abduction')) return 'hip abd';
  if (lower.includes('hip flexion')) return 'hip flex';
  if (lower.includes('straight leg raise') || lower === 'slr') return 'SLR';
  if (lower.includes('ankle dorsiflexion')) return 'ankle dorsi';
  if (lower.includes('trunk rotation')) return 'trunk rot';
  return lower;
}

/** Rank findings so the worst (lowest % of full & highest severity) comes first. */
export function sortWorstFindings(findings: ClientFinding[]): ClientFinding[] {
  return [...findings].sort((a, b) => {
    if (sevRank[b.severity] !== sevRank[a.severity]) {
      return sevRank[b.severity] - sevRank[a.severity];
    }
    const ratioA = Math.min(...[a.left, a.right].filter((v): v is number => v !== null)) / (a.full || 90);
    const ratioB = Math.min(...[b.left, b.right].filter((v): v is number => v !== null)) / (b.full || 90);
    if (Math.abs(ratioA - ratioB) > 1e-3) return ratioA - ratioB;
    return Math.abs((b.left ?? b.right ?? 0) - (b.right ?? b.left ?? 0))
      - Math.abs((a.left ?? a.right ?? 0) - (a.right ?? a.left ?? 0));
  });
}

/** 0 → 1 → hold → 0 loop while playing. */
function useCycle(playing: boolean, resetKey: string) {
  const [t, setT] = useState(0);
  const start = useRef(0);
  useEffect(() => {
    start.current = performance.now();
    setT(0);
  }, [resetKey]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const UP = 1700,
      HOLD = 1400,
      DOWN = 1200,
      REST = 500,
      ALL = UP + HOLD + DOWN + REST;
    const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    const tick = (now: number) => {
      const e = (now - start.current) % ALL;
      const v =
        e < UP
          ? ease(e / UP)
          : e < UP + HOLD
            ? 1
            : e < UP + HOLD + DOWN
              ? 1 - ease((e - UP - HOLD) / DOWN)
              : 0;
      setT(v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, resetKey]);
  return [t, setT] as const;
}

const screenDeg = (from: [number, number], to: [number, number]) =>
  (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/**
 * Interactive body section:
 * Two side-by-side cards always visible: A) Body map and B) Movements,
 * both synced to clientFindings(client).
 */
export const BodyLab: React.FC<{
  client: ClientProfile;
  onUpdateClient?: (c: ClientProfile) => void;
  compact?: boolean;
}> = ({ client, onUpdateClient, compact }) => {
  const findings = useMemo(() => clientFindings(client), [client]);
  const findingsByKey = useMemo(() => {
    const map = new Map<string, ClientFinding>();
    findings.forEach((f) => map.set(f.key, f));
    return map;
  }, [findings]);

  // Rank movements by worst finding in clientFindings
  const worstMoveId = useMemo(() => {
    const playable = findings.filter((f) => MOVEMENTS.some((m) => m.sopKey === f.key));
    const sorted = sortWorstFindings(playable);
    return sorted[0]?.key ?? MOVEMENTS[0].id;
  }, [findings]);

  const [userMoveId, setUserMoveId] = useState<string | null>(null);
  const moveId = userMoveId && MOVEMENTS.some((m) => m.id === userMoveId) ? userMoveId : worstMoveId;
  const move = MOVEMENTS.find((m) => m.id === moveId) ?? MOVEMENTS[0];
  const finding = findingsByKey.get(move.sopKey);

  const posture = client.posture ?? {};
  const hasPosture = POSTURE.some((d) => posture[d.key] != null);

  // Separate Front / Side toggles for Body map and Movements
  const [mapView, setMapView] = useState<View>('front');
  const [moveViewPref, setMoveViewPref] = useState<View | null>(null);
  // Natural view is the default; a user can freely choose the other view.
  const moveView: View = moveViewPref ?? move.view;

  const worseSide: 'L' | 'R' = finding
    ? (finding.worse ?? (finding.left !== null ? 'L' : 'R'))
    : 'L';
  const [sideSel, setSideSel] = useState<'L' | 'R' | null>(null);
  const side = sideSel ?? worseSide;
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useCycle(playing, `${move.id}-${side}`);

  const normal = finding?.full ?? move.normal;
  // Unmeasured side animates to Full, without pretending it was measured.
  const measuredTarget = finding ? (side === 'L' ? finding.left : finding.right) : null;
  const target = measuredTarget ?? normal;

  const selectMovement = (targetMoveId: string, preferredSide?: 'L' | 'R' | null) => {
    const m = MOVEMENTS.find((x) => x.id === targetMoveId || x.sopKey === targetMoveId);
    if (!m) return;
    setUserMoveId(m.id);
    setSideSel(preferredSide ?? null);
    setMoveViewPref(m.view);
    setPlaying(true);
  };

  const setPosture = (key: keyof PostureAngles, raw: string) => {
    if (!onUpdateClient) return;
    const v = raw === '' ? undefined : Number(raw);
    onUpdateClient({ ...client, posture: { ...posture, [key]: v, measuredOn: todayISO() } });
  };

  // ---------------- Body map figure (posture lines + joint dots/tags from limited clientFindings)
  const bodyMapData = useMemo(() => {
    const pose = postureToPose(posture, mapView);
    const j = solve(mapView, pose);
    const labels: FigureLabel[] = [];
    const dots: Record<string, string> = {};
    const dotMoveMap: Record<string, { moveId: string; side: 'L' | 'R' }> = {};
    const dotSevRank: Record<string, number> = {};
    const lines: FigureLine[] = [];

    const setDot = (
      jointKey: string,
      sev: Severity,
      linkedMove?: { moveId: string; side: 'L' | 'R' }
    ) => {
      const rank = sevRank[sev];
      if (dotSevRank[jointKey] === undefined || rank >= dotSevRank[jointKey]) {
        dotSevRank[jointKey] = rank;
        dots[jointKey] = SEVERITY_COLOR[sev];
        if (linkedMove) dotMoveMap[jointKey] = linkedMove;
      }
    };

    // 1. Standing posture angles
    const defs = POSTURE.filter((d) => d.view === mapView);
    const anchor: Record<
      string,
      { at: [number, number]; side: 'left' | 'right'; dots: string[]; dy?: number }
    > =
      mapView === 'front'
        ? {
            shoulderTilt: { at: j.p.shL, side: 'right', dots: ['shL', 'shR'], dy: -36 },
            pelvisTilt: { at: j.p.hipL, side: 'right', dots: ['hipL', 'hipR'], dy: -28 },
            headTilt: { at: [j.p.head[0] - 26, j.p.head[1]], side: 'left', dots: [], dy: -20 },
            kneeValgusL: { at: j.p.knL, side: 'right', dots: ['knL'] },
            kneeValgusR: { at: j.p.knR, side: 'left', dots: ['knR'] }
          }
        : {
            headForward: { at: [j.p.head[0] + 26, j.p.head[1]], side: 'right', dots: [], dy: -26 },
            roundedShoulders: { at: j.p.sh, side: 'right', dots: ['sh'], dy: -24 },
            trunkLean: { at: j.p.hip, side: 'right', dots: ['hip'], dy: -22 }
          };

    defs.forEach((d) => {
      const v = posture[d.key] as number | undefined;
      const sev = ratePosture(d, v);
      const a = anchor[d.key];
      if (!a || sev == null) return;
      a.dots.forEach((k) => setDot(k, sev));
      labels.push({
        at: a.at,
        side: a.side,
        color: SEVERITY_COLOR[sev],
        text: d.describe(v!),
        dy: a.dy
      });
    });

    if (mapView === 'front') {
      const sv = ratePosture(POSTURE[0], posture.shoulderTilt);
      if (sv) {
        lines.push({
          a: [j.p.shR[0] - 22, j.p.shR[1] - (j.p.shL[1] - j.p.shR[1]) * 0.4],
          b: [j.p.shL[0] + 22, j.p.shL[1] + (j.p.shL[1] - j.p.shR[1]) * 0.4],
          color: SEVERITY_COLOR[sv]
        });
        lines.push({
          a: [j.p.shR[0] - 22, j.p.shR[1]],
          b: [j.p.shL[0] + 22, j.p.shR[1]],
          color: '#CBD5E1',
          dashed: true,
          width: 1.2
        });
      }
      const pv = ratePosture(POSTURE[1], posture.pelvisTilt);
      if (pv) {
        lines.push({
          a: [j.p.hipR[0] - 26, j.p.hipR[1] - (j.p.hipL[1] - j.p.hipR[1]) * 0.45],
          b: [j.p.hipL[0] + 26, j.p.hipL[1] + (j.p.hipL[1] - j.p.hipR[1]) * 0.45],
          color: SEVERITY_COLOR[pv]
        });
      }
    } else {
      lines.push({
        a: [j.p.neck[0], j.p.neck[1]],
        b: [j.p.neck[0], j.p.neck[1] - 60],
        color: '#CBD5E1',
        dashed: true,
        width: 1.2
      });
    }

    // 2. Limited findings from clientFindings(client) attached to their joint (shoulder, hip, ankle)
    const limitedFindings = sortWorstFindings(findings.filter((f) => f.sideLimited !== 'none'));

    limitedFindings.forEach((f) => {
      const m = MOVEMENTS.find((x) => x.sopKey === f.key);
      if (!m) return;
      const limSide: 'L' | 'R' = f.worse ?? (f.left !== null && rateRom(f.left, f.full) !== 'ok' ? 'L' : 'R');
      const val = (limSide === 'L' ? f.left : f.right) ?? f.full;
      const sev = rateRom(val, f.full);

      const jointKey =
        mapView === 'front'
          ? m.joint === 'shoulder'
            ? `sh${limSide}`
            : m.joint === 'hip'
              ? `hip${limSide}`
              : `an${limSide}`
          : m.joint === 'shoulder'
            ? 'sh'
            : m.joint === 'hip'
              ? 'hip'
              : 'an';

      const pt = j.p[jointKey];
      if (!pt) return;

      setDot(jointKey, sev, { moveId: m.id, side: limSide });

      // Place tag on viewer's left for client's R side, viewer's right for client's L side
      const tagSide: 'left' | 'right' =
        mapView === 'front' ? (limSide === 'R' ? 'left' : 'right') : 'left';

      labels.push({
        at: pt,
        side: tagSide,
        color: SEVERITY_COLOR[sev],
        text: `${limSide} ${shortFindingLabel(f.label)} ${Math.round(val)}°`,
        onClick: () => selectMovement(m.id, limSide)
      });
    });

    return { pose, dots, labels, lines, dotMoveMap, limitedFindings };
  }, [posture, mapView, findings]);

  // ---------------- Movement figure
  const movementFigure = (() => {
    const v = target * t;
    const pose = movementPose(move, moveView, v, side);
    const j = solve(moveView, pose);
    const arcs: FigureArc[] = [];
    const sideKey = (k: string) => (moveView === 'front' ? `${k}${side}` : k);
    if (move.pivot) {
      const c = j.p[sideKey(move.pivot)];
      const e = j.p[sideKey(move.end)];
      if (c && e) {
        // The zero-angle arc starts on this exact limb, in the selected view.
        const neutral = solve(moveView, movementPose(move, moveView, 0, side)).p;
        const c0 = neutral[sideKey(move.pivot)];
        const e0 = neutral[sideKey(move.end)];
        const zeroScreen = c0 && e0 ? screenDeg(c0, e0) : screenDeg(c, e);
        const sev = measuredTarget !== null ? rateRom(target, normal) : 'ok';
        arcs.push({
          center: c,
          fromDeg: zeroScreen,
          toDeg: screenDeg(c, e),
          color: SEVERITY_COLOR[sev],
          r: move.id === 'shoulder-ir' || move.id === 'shoulder-er' ? 52 : 48,
          text: `${Math.round(v)}°`
        });
      }
    }
    const ghostKeys =
      moveView === 'front'
        ? move.pivot === 'el'
          ? [`fa${side}`]
          : move.pivot === 'sh'
            ? [`ua${side}`, `fa${side}`]
          : move.pivot === 'hip'
            ? [`th${side}`, `sh${side}`]
            : [`sh${side}`]
        : move.pivot === 'an' || move.pivot === 'hip'
          ? ['th', 'sh']
          : ['ua', 'fa'];
    const showGhost = measuredTarget !== null && target < normal * 0.9 && t > 0.98;
    return (
      <BodyFigure
        view={moveView}
        pose={pose}
        ghost={showGhost ? movementPose(move, moveView, normal, side) : undefined}
        ghostKeys={ghostKeys}
        arcs={arcs}
        className="w-full h-full"
        title={move.label}
      />
    );
  })();

  const postureRow = (d: PostureDef) => {
    const v = posture[d.key] as number | undefined;
    const sev = ratePosture(d, v);
    return (
      <div key={d.key} className="py-2 border-b border-gray-100 last:border-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#111827]">{d.label}</div>
            <div className="text-xs text-gray-500">
              {v != null ? d.describe(v) : 'Not measured'} · OK ≤ {d.ok}°
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {sev && (
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${sevBg[sev]}`}>
                {sevText[sev]}
              </span>
            )}
            {onUpdateClient && (
              <label className="flex items-center border border-gray-200 rounded-full pl-3 pr-2 py-1 bg-white">
                <input
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  value={v ?? ''}
                  onChange={(e) => setPosture(d.key, e.target.value)}
                  aria-label={`${d.label} in degrees`}
                  className="w-12 text-sm font-semibold text-right focus:outline-none bg-transparent"
                />
                <span className="text-xs text-gray-400 ml-0.5">°</span>
              </label>
            )}
          </div>
        </div>
        {sev && sev !== 'ok' && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{d.meaning}</p>
        )}
      </div>
    );
  };

  const movePanel = (m: MovementDef) => {
    const sevL = finding?.left != null ? rateRom(finding.left, normal) : null;
    const sevR = finding?.right != null ? rateRom(finding.right, normal) : null;
    return (
      <div className="space-y-3 mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-base font-bold text-[#111827]">{m.label}</div>
            <div className="text-xs text-gray-500">Normal (Full): {normal}°</div>
          </div>
          {finding && (
            <div className="text-xs font-bold text-[#111827]">{finding.diffText}</div>
          )}
        </div>
        {m.setup && <div className="text-xs text-gray-500">{m.setup}</div>}

        {finding ? (
          <div className="grid grid-cols-2 gap-2.5">
            {(['L', 'R'] as const).map((s) => {
              const val = s === 'L' ? finding.left : finding.right;
              const sev = s === 'L' ? sevL : sevR;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSideSel(s)}
                  className={`text-left rounded-2xl border px-4 py-3 cursor-pointer transition-colors ${
                    side === s
                      ? 'border-[#111827] bg-[#111827] text-white'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div
                    className={`text-xs font-semibold ${
                      side === s ? 'text-gray-300' : 'text-gray-500'
                    }`}
                  >
                    {s === 'L' ? 'Left' : 'Right'}
                  </div>
                  <div className="text-2xl font-bold tabular-nums">{val === null ? '—' : `${val}°`}</div>
                  {sev ? (
                    <span className={`inline-block mt-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${sevBg[sev]}`}>
                      {sevText[sev]}
                    </span>
                  ) : (
                    <span className="inline-block mt-1 text-[10.5px] text-gray-400">Not measured</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Not measured yet — showing Full range ({normal}°). Enter Left / Right in the Spectrum
            table above.
          </p>
        )}

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-2xl bg-amber-50/70 border border-amber-100 p-3.5">
            <div className="text-xs font-bold text-amber-900 mb-1">If it’s limited</div>
            <p className="text-[13px] text-amber-950/80 leading-relaxed">{m.limited}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3.5">
            <div className="text-xs font-bold text-gray-700 mb-1">What helps</div>
            <p className="text-[13px] text-gray-600 leading-relaxed">{m.tip}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`grid grid-cols-1 w-full min-w-0 gap-6 mb-6 ${compact ? '' : 'lg:grid-cols-2'}`}>
      {/* CARD A: Body map */}
      <section className="w-full min-w-0 bg-white rounded-[28px] border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">Body map</h2>
            <p className="text-xs text-gray-500">
              Standing posture &amp; limited joints — tap a joint or tag to inspect the movement
              {posture.measuredOn ? ` · ${posture.measuredOn}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <i className="w-2 h-2 rounded-full bg-green-600 inline-block" /> OK
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <i className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Watch
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <i className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Work on
            </span>
          </div>
        </div>

        <div className="relative w-full min-w-0 rounded-[24px] border border-gray-100 bg-[radial-gradient(circle_at_50%_38%,#ffffff,#F1F3F6)] overflow-hidden">
          <div className="absolute left-3 top-3 z-10 flex gap-1.5">
            {(['front', 'side'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMapView(v)}
                className={`${pill} border ${
                  mapView === v
                    ? 'bg-[#111827] border-[#111827] text-white'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {v === 'front' ? 'Front' : 'Side'}
              </button>
            ))}
          </div>
          <div className={`mx-auto ${compact ? 'h-[360px]' : 'h-[420px] sm:h-[460px]'} pt-10 pb-2`}>
            <BodyFigure
              view={mapView}
              pose={bodyMapData.pose}
              dots={bodyMapData.dots}
              onDotClick={(jointKey) => {
                const targetMove = bodyMapData.dotMoveMap[jointKey];
                if (targetMove) selectMovement(targetMove.moveId, targetMove.side);
              }}
              labels={bodyMapData.labels}
              lines={bodyMapData.lines}
              plumb
              showJoints
              className="w-full h-full"
              title="Posture"
            />
          </div>
        </div>

        <div className="mt-4">
          {POSTURE.filter((d) => d.view === mapView).map(postureRow)}
          {!hasPosture && (
            <p className="text-xs text-gray-500 mt-2">
              {onUpdateClient
                ? 'Type standing posture angles in degrees. The figure updates immediately.'
                : 'Your coach hasn’t measured standing posture angles yet.'}
            </p>
          )}
        </div>
      </section>

      {/* CARD B: Movements */}
      <section className="w-full min-w-0 bg-white rounded-[28px] border border-gray-100 shadow-[0_2px_14px_rgba(0,0,0,0.04)] p-4 sm:p-6 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">Movements</h2>
            <p className="text-xs text-gray-500">
              Client’s measured range vs Full — synced with Spectrum of Patterns
            </p>
          </div>
        </div>

        <div className="flex flex-wrap min-w-0 gap-1.5 pb-2 mb-3">
          {MOVEMENTS.map((m) => {
            const f = findingsByKey.get(m.sopKey);
            const sev = f?.severity ?? null;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMovement(m.id)}
                className={`${pill} border flex items-center gap-1.5 ${
                  move.id === m.id
                    ? 'bg-[#FFC809] border-[#FFC809] text-[#111827]'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {sev && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: SEVERITY_COLOR[sev] }}
                  />
                )}
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full min-w-0 rounded-[24px] border border-gray-100 bg-[radial-gradient(circle_at_50%_38%,#ffffff,#F1F3F6)] overflow-hidden">
          {/* Front / Side toggle on Movements card */}
          <div className="absolute left-3 top-3 z-10 flex gap-1.5">
            {(['front', 'side'] as const).map((v) => {
              const active = moveView === v;
              return (
                <button
                  key={v}
                  type="button"
                  title={`Show ${v} view`}
                  onClick={() => setMoveViewPref(v)}
                  className={`${pill} border ${
                    active
                      ? 'bg-[#111827] border-[#111827] text-white'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {v === 'front' ? 'Front' : 'Side'}
                </button>
              );
            })}
          </div>

          <div className="absolute right-3 top-3 z-10 flex gap-1.5">
            <button
              type="button"
              onClick={() => setPlaying(!playing)}
              aria-label={playing ? 'Pause' : 'Play'}
              className="w-9 h-9 rounded-full bg-[#111827] text-white flex items-center justify-center cursor-pointer"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setT(1);
              }}
              aria-label="Show end of range"
              className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className={`mx-auto ${compact ? 'h-[360px]' : 'h-[420px] sm:h-[460px]'} pt-10 pb-2`}>
            {movementFigure}
          </div>

          <div className="px-4 pb-4">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={t}
              onChange={(e) => {
                setPlaying(false);
                setT(Number(e.target.value));
              }}
              aria-label="Scrub movement"
              className="w-full accent-[#111827]"
            />
            <div className="flex justify-between text-[11px] text-gray-500">
              <span>Start</span>
              <span>
                {measuredTarget !== null ? `${side === 'L' ? 'Left' : 'Right'} ${target}°` : 'Not measured'} · Full {normal}°
              </span>
            </div>
            {measuredTarget !== null && target < normal * 0.9 && (
              <div className="text-[11px] text-gray-500 mt-1">
                Shaded limb = where Full ({normal}°) range reaches.
              </div>
            )}
          </div>
        </div>

        {movePanel(move)}
      </section>
    </div>
  );
};
