/**
 * The human drawing for Assessment › Body map.
 * Safe to redesign (e.g. in AI Studio) — read docs/BODY_FIGURE.md first:
 * keep the props, follow solve(view, pose) joints, keep the viewBox.
 */
import React from 'react';
import { Joints, Pose, Pt, View, solve } from '../lib/bodyModel';
import { LABEL_VIEWBOX_FRONT, LABEL_VIEWBOX_SIDE, PlacedLabel, layoutLabels } from '../lib/labelLayout';

export interface FigureLabel {
  at: Pt;
  text: string;
  color: string;
  /** which side of the figure the tag sits on */
  side: 'left' | 'right';
  dy?: number;
  onClick?: () => void;
}

export interface FigureLine {
  a: Pt;
  b: Pt;
  color: string;
  dashed?: boolean;
  width?: number;
}

export interface FigureArc {
  center: Pt;
  fromDeg: number; // screen angle in degrees (0 = +x, 90 = down)
  toDeg: number;
  color: string;
  r?: number;
  text?: string;
}

const OUTLINE = '#111827';
const FILL = '#F3F4F6';
const FAR_OUTLINE = '#6B7280';
const FAR_FILL = '#E5E7EB';

const f1 = (n: number) => n.toFixed(1);
const P = (p: Pt) => `${f1(p[0])},${f1(p[1])}`;

/**
 * Local coordinate frame from joint `a` to joint `b`.
 * `t` = distance along `a -> b` in px; `out` = perpendicular offset
 * (`+` = lateral/outward away from body centerline when `outSide` is +1 for L / -1 for R;
 * in side view `outSide = 1` puts `+out` posterior/back and `-out` anterior/front when limb points down).
 */
function limbFrame(a: Pt, b: Pt, outSide: 1 | -1 = 1) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const ux = len > 1e-4 ? dx / len : 0;
  const uy = len > 1e-4 ? dy / len : 1;
  const ox = uy * outSide;
  const oy = -ux * outSide;
  const pt = (t: number, out: number): Pt => [a[0] + ux * t + ox * out, a[1] + uy * t + oy * out];
  return { len, pt, ux, uy, ox, oy };
}

/**
 * Anatomical upper arm (`sh -> el`).
 * - When `len < 24` (`pose.shRot`, 90/90 shoulder test in side view): foreshortened upper arm
 *   pointing straight toward the viewer with a round elbow cap in front of the shoulder.
 * - Front view: sculpted deltoid cap at shoulder, bicep/tricep taper to elbow at waist level.
 * - Side view: full adult arm thickness (bicep in front, tricep/deltoid behind).
 */
function upperArmPath(a: Pt, b: Pt, outSide: 1 | -1, view: View, foreshortened?: boolean): string {
  const { len, pt } = limbFrame(a, b, outSide);
  if (view === 'side' && len < 24 && !foreshortened) {
    // Side-view 90/90 shoulder rotation: upper arm abducted 90° pointing at the viewer,
    // foreshortened from shoulder `a` to round elbow `b` in front of the shoulder.
    const shR = 16.5;
    const elR = 14.0;
    return [
      `M ${P([a[0], a[1] - shR])}`,
      `C ${P([a[0] - shR * 1.15, a[1] - shR])} ${P([a[0] - shR * 1.15, a[1] + shR])} ${P([a[0], a[1] + shR])}`,
      `C ${P([a[0] + 6, a[1] + shR])} ${P([b[0] - 4, b[1] + elR])} ${P([b[0], b[1] + elR])}`,
      `C ${P([b[0] + elR * 1.15, b[1] + elR])} ${P([b[0] + elR * 1.15, b[1] - elR])} ${P([b[0], b[1] - elR])}`,
      `C ${P([b[0] - 4, b[1] - elR])} ${P([a[0] + 6, a[1] - shR])} ${P([a[0], a[1] - shR])}`,
      'Z'
    ].join(' ');
  }

  if (foreshortened) {
    // Foreshortened upper arm (front-view shoulder flexion or side-view shoulder abduction):
    // keeps vertical X-axis symmetry so the arm never flips left-to-right when passing 90°.
    const dirY = b[1] >= a[1] ? 1 : -1;
    const shR = 15.5;
    const elR = 13.5;
    const midY = (a[1] + b[1]) / 2;
    const midX = (a[0] + b[0]) / 2;
    const wMid = 16.0;
    return [
      `M ${P([a[0] - shR, a[1]])}`,
      `C ${P([a[0] - shR, a[1] - dirY * shR * 1.15])} ${P([a[0] + shR, a[1] - dirY * shR * 1.15])} ${P([a[0] + shR, a[1]])}`,
      `C ${P([midX + wMid, midY])} ${P([b[0] + elR, b[1] - dirY * 4])} ${P([b[0] + elR, b[1]])}`,
      `C ${P([b[0] + elR, b[1] + dirY * elR * 1.15])} ${P([b[0] - elR, b[1] + dirY * elR * 1.15])} ${P([b[0] - elR, b[1]])}`,
      `C ${P([b[0] - elR, b[1] - dirY * 4])} ${P([midX - wMid, midY])} ${P([a[0] - shR, a[1]])}`,
      'Z'
    ].join(' ');
  }

  if (view === 'side') {
    // Side view: -out is anterior (bicep/anterior deltoid), +out is posterior (tricep/posterior deltoid)
    return [
      `M ${P(pt(0, -15.5))}`,
      `C ${P(pt(-16.5, -12.5))} ${P(pt(-16.5, 13.0))} ${P(pt(0, 16.2))}`,
      // Posterior deltoid & tricep sweep down to olecranon (back of elbow)
      `C ${P(pt(len * 0.28, 17.2))} ${P(pt(len * 0.62, 15.4))} ${P(pt(len, 12.6))}`,
      // Seamless rounded elbow cap
      `C ${P(pt(len + 12.2, 9.8))} ${P(pt(len + 12.2, -9.8))} ${P(pt(len, -12.2))}`,
      // Anterior bicep bulge back to shoulder
      `C ${P(pt(len * 0.66, -14.8))} ${P(pt(len * 0.32, -16.2))} ${P(pt(0, -15.5))}`,
      'Z'
    ].join(' ');
  }

  return [
    `M ${P(pt(0, -13.5))}`,
    // Rounded deltoid cap at shoulder joint
    `C ${P(pt(-15.5, -11.0))} ${P(pt(-15.5, 12.0))} ${P(pt(0, 15.6))}`,
    // Lateral deltoid bulge tapering into lateral upper arm
    `C ${P(pt(len * 0.26, 17.2))} ${P(pt(len * 0.56, 14.5))} ${P(pt(len * 0.82, 12.2))}`,
    `C ${P(pt(len * 0.92, 11.6))} ${P(pt(len * 0.97, 11.4))} ${P(pt(len, 11.2))}`,
    // Seamless rounded elbow cap
    `C ${P(pt(len + 11.2, 8.8))} ${P(pt(len + 11.2, -8.8))} ${P(pt(len, -10.8))}`,
    // Medial bicep contour back to axilla
    `C ${P(pt(len * 0.68, -11.6))} ${P(pt(len * 0.34, -13.0))} ${P(pt(0, -13.5))}`,
    'Z'
  ].join(' ');
}

/**
 * Anatomical forearm + wrist + hand with fingers (`el -> wr`).
 * Extends past `wr` so fingertips naturally reach mid-thigh (`y ≈ 352`) when arms hang at side.
 */
function forearmHandPath(a: Pt, b: Pt, outSide: 1 | -1, view: View, foreshortened?: boolean): string {
  const { len, pt } = limbFrame(a, b, outSide);
  const wristT = len + 16;

  if (foreshortened) {
    // Foreshortened forearm + hand moving along its vertical line (front shoulder-flex or side shoulder-abd)
    const dirY = b[1] >= a[1] ? 1 : -1;
    const elR = 12.5;
    const wrR = 8.2;
    const handR = 9.8;
    const tipY = b[1] + dirY * 26;
    const midY = (a[1] + b[1]) / 2;
    const midX = (a[0] + b[0]) / 2;
    return [
      `M ${P([a[0] - elR, a[1]])}`,
      `C ${P([a[0] - elR, a[1] - dirY * elR * 1.1])} ${P([a[0] + elR, a[1] - dirY * elR * 1.1])} ${P([a[0] + elR, a[1]])}`,
      `C ${P([midX + 12.8, midY])} ${P([b[0] + wrR, b[1] - dirY * 4])} ${P([b[0] + wrR, b[1]])}`,
      // Foreshortened palm & fingers
      `C ${P([b[0] + handR, b[1] + dirY * 8])} ${P([b[0] + handR, tipY - dirY * 4])} ${P([b[0], tipY])}`,
      `C ${P([b[0] - handR, tipY - dirY * 4])} ${P([b[0] - handR, b[1] + dirY * 8])} ${P([b[0] - wrR, b[1]])}`,
      `C ${P([b[0] - wrR, b[1] - dirY * 4])} ${P([midX - 12.8, midY])} ${P([a[0] - elR, a[1]])}`,
      'Z'
    ].join(' ');
  }

  if (view === 'side') {
    return [
      `M ${P(pt(0, -11.8))}`,
      // Rounded elbow cap matching upper arm
      `C ${P(pt(-12.0, -9.2))} ${P(pt(-12.0, 9.2))} ${P(pt(0, 12.4))}`,
      // Posterior/ulnar forearm muscle belly tapering to wrist
      `C ${P(pt(len * 0.28, 14.0))} ${P(pt(len * 0.68, 11.2))} ${P(pt(wristT, 7.6))}`,
      // Side profile hand & fingers reaching mid-thigh
      `C ${P(pt(wristT + 12, 8.2))} ${P(pt(wristT + 28, 7.6))} ${P(pt(wristT + 42, 4.8))}`,
      `C ${P(pt(wristT + 46, 3.2))} ${P(pt(wristT + 46, -0.4))} ${P(pt(wristT + 41, -2.2))}`,
      `C ${P(pt(wristT + 33, -3.6))} ${P(pt(wristT + 24, -4.0))} ${P(pt(wristT + 18, -5.0))}`,
      // Thumb in profile
      `C ${P(pt(wristT + 22, -7.8))} ${P(pt(wristT + 24, -11.8))} ${P(pt(wristT + 20, -13.0))}`,
      `C ${P(pt(wristT + 16, -13.6))} ${P(pt(wristT + 9, -10.0))} ${P(pt(wristT, -7.2))}`,
      // Anterior/radial forearm back to elbow
      `C ${P(pt(len * 0.65, -10.5))} ${P(pt(len * 0.28, -12.6))} ${P(pt(0, -11.8))}`,
      'Z'
    ].join(' ');
  }

  return [
    `M ${P(pt(0, -10.6))}`,
    // Rounded elbow cap matching upper arm
    `C ${P(pt(-11.0, -8.5))} ${P(pt(-11.0, 8.5))} ${P(pt(0, 11.2))}`,
    // Lateral forearm (brachioradialis) bulge tapering down to wrist
    `C ${P(pt(len * 0.26, 13.4))} ${P(pt(len * 0.66, 10.6))} ${P(pt(wristT, 6.8))}`,
    // Outer palm flaring to pinky finger
    `C ${P(pt(wristT + 8.0, 7.8))} ${P(pt(wristT + 18.0, 9.6))} ${P(pt(wristT + 29.0, 9.8))}`,
    // Pinky finger
    `C ${P(pt(wristT + 33.0, 9.8))} ${P(pt(wristT + 33.0, 6.8))} ${P(pt(wristT + 24.0, 6.0))}`,
    // Ring finger
    `C ${P(pt(wristT + 32.0, 5.8))} ${P(pt(wristT + 40.5, 5.6))} ${P(pt(wristT + 40.5, 3.5))}`,
    `C ${P(pt(wristT + 40.5, 1.8))} ${P(pt(wristT + 31.0, 2.0))} ${P(pt(wristT + 25.5, 2.0))}`,
    // Middle finger (reaches mid-thigh y ≈ 352)
    `C ${P(pt(wristT + 33.5, 1.8))} ${P(pt(wristT + 44.0, 1.4))} ${P(pt(wristT + 44.0, -0.5))}`,
    `C ${P(pt(wristT + 44.0, -2.4))} ${P(pt(wristT + 32.5, -2.0))} ${P(pt(wristT + 25.5, -2.0))}`,
    // Index finger
    `C ${P(pt(wristT + 32.0, -2.3))} ${P(pt(wristT + 38.5, -2.8))} ${P(pt(wristT + 38.5, -4.8))}`,
    `C ${P(pt(wristT + 38.5, -6.5))} ${P(pt(wristT + 27.0, -5.8))} ${P(pt(wristT + 19.0, -5.6))}`,
    // Thumb
    `C ${P(pt(wristT + 22.5, -8.2))} ${P(pt(wristT + 26.5, -12.0))} ${P(pt(wristT + 23.8, -13.4))}`,
    `C ${P(pt(wristT + 20.8, -14.2))} ${P(pt(wristT + 13.5, -10.6))} ${P(pt(wristT + 7.5, -8.0))}`,
    `L ${P(pt(wristT, -6.6))}`,
    // Medial forearm contour back to medial elbow
    `C ${P(pt(len * 0.64, -9.8))} ${P(pt(len * 0.28, -11.4))} ${P(pt(0, -10.6))}`,
    'Z'
  ].join(' ');
}

/**
 * Anatomical thigh (`hip -> kn`).
 * - Seated (`pose.seated`): foreshortened thigh coming toward the viewer (short and wide, knees rounded at 90°).
 * - Foreshortened (`foreshortened`): knee coming toward the viewer along the leg's own vertical line (hip-flex / SLR in front view).
 * - Side view: prominent anterior quadriceps sweep and posterior hamstring contour.
 * - Front view: full upper thigh at pelvis tapering smoothly to the knee.
 */
function thighPath(
  a: Pt,
  b: Pt,
  outSide: 1 | -1,
  view: View,
  seated?: boolean,
  foreshortened?: boolean
): string {
  const { len, pt } = limbFrame(a, b, outSide);
  if (seated && view === 'front') {
    // Seated front view: thigh comes forward toward viewer from hip (y=300) to knee (y=346),
    // short and wide, with a well-rounded 90° knee cap in front.
    return [
      `M ${P(pt(0, -18.5))}`,
      `C ${P(pt(-18.0, -15.0))} ${P(pt(-18.0, 16.0))} ${P(pt(0, 21.5))}`,
      // Foreshortened outer thigh widening toward viewer's knee
      `C ${P(pt(len * 0.42, 23.5))} ${P(pt(len * 0.80, 23.0))} ${P(pt(len, 20.5))}`,
      // Rounded forward-facing knee cap (patella)
      `C ${P(pt(len + 18.0, 16.5))} ${P(pt(len + 18.0, -16.5))} ${P(pt(len, -19.2))}`,
      // Foreshortened inner thigh back to hip
      `C ${P(pt(len * 0.80, -20.5))} ${P(pt(len * 0.42, -19.5))} ${P(pt(0, -18.5))}`,
      'Z'
    ].join(' ');
  }

  if (foreshortened && view === 'front') {
    // Front-view sagittal hip flexion / SLR: thigh foreshortens toward viewer and knee rises straight up
    // along the leg's own vertical line (even when kn[1] < hip[1] above 90°!).
    const dirY = b[1] >= a[1] ? 1 : -1;
    const out = outSide;
    const hipIn = -17.5 * out;
    const hipOut = 22.0 * out;
    const knIn = -16.2 * out;
    const knOut = 17.8 * out;
    const midY = (a[1] + b[1]) / 2;
    const midX = (a[0] + b[0]) / 2;
    return [
      `M ${P([a[0] + hipIn, a[1]])}`,
      `C ${P([a[0] + hipIn, a[1] - dirY * 18.0])} ${P([a[0] + hipOut, a[1] - dirY * 18.0])} ${P([a[0] + hipOut, a[1]])}`,
      `C ${P([midX + 21.5 * out, midY])} ${P([b[0] + knOut, b[1] - dirY * 6.0])} ${P([b[0] + knOut, b[1]])}`,
      `C ${P([b[0] + knOut, b[1] + dirY * 16.5])} ${P([b[0] + knIn, b[1] + dirY * 16.5])} ${P([b[0] + knIn, b[1]])}`,
      `C ${P([b[0] + knIn, b[1] - dirY * 6.0])} ${P([midX - 17.5 * out, midY])} ${P([a[0] + hipIn, a[1]])}`,
      'Z'
    ].join(' ');
  }

  if (view === 'side') {
    // Side view (facing right): -out is anterior (quadriceps), +out is posterior (glute/hamstring)
    return [
      `M ${P(pt(0, -21.0))}`,
      `C ${P(pt(-20.0, -16.0))} ${P(pt(-20.0, 18.0))} ${P(pt(0, 23.5))}`,
      // Posterior hamstring contour tapering to back of knee
      `C ${P(pt(len * 0.30, 22.0))} ${P(pt(len * 0.68, 17.2))} ${P(pt(len, 12.8))}`,
      // Rounded knee joint
      `C ${P(pt(len + 12.8, 10.0))} ${P(pt(len + 12.8, -10.5))} ${P(pt(len, -13.5))}`,
      // Prominent anterior quadriceps sweep back to anterior hip
      `C ${P(pt(len * 0.66, -19.5))} ${P(pt(len * 0.30, -23.5))} ${P(pt(0, -21.0))}`,
      'Z'
    ].join(' ');
  }

  return [
    `M ${P(pt(0, -17.5))}`,
    // Rounded hip head inside pelvis
    `C ${P(pt(-18.0, -14.0))} ${P(pt(-18.0, 15.0))} ${P(pt(0, 22.5))}`,
    // Outer thigh (vastus lateralis) sweep tapering gracefully to lateral knee
    `C ${P(pt(len * 0.28, 23.2))} ${P(pt(len * 0.66, 17.8))} ${P(pt(len, 12.8))}`,
    // Seamless rounded knee joint
    `C ${P(pt(len + 12.5, 10.0))} ${P(pt(len + 12.5, -10.0))} ${P(pt(len, -12.2))}`,
    // Inner thigh (adductor) contour tapering from upper thigh to medial knee
    `C ${P(pt(len * 0.68, -13.4))} ${P(pt(len * 0.32, -16.8))} ${P(pt(0, -17.5))}`,
    'Z'
  ].join(' ');
}

/**
 * Anatomical shin + bulging calf (gastrocnemius/soleus) tapering to ankle + real foot (`kn -> an`).
 */
function shinFootPath(
  a: Pt,
  b: Pt,
  outSide: 1 | -1,
  view: View,
  toePt?: Pt,
  seated?: boolean,
  foreshortened?: boolean
): string {
  const { len, pt } = limbFrame(a, b, outSide);
  if (view === 'side') {
    const tPt: Pt = toePt ?? [b[0] + 34, b[1] + 6];
    const heel: Pt = [b[0] - 13.5, b[1] + 12.5];
    const soleArch: Pt = [b[0] + 8, tPt[1] + 7.5];
    const toeTip: Pt = [tPt[0] + 10.5, tPt[1] + 6.0];
    const toeTop: Pt = [tPt[0] + 9.0, tPt[1] - 1.5];
    const instep: Pt = [b[0] + 12.0, b[1] - 2.0];
    return [
      `M ${P(pt(0, -13.0))}`,
      // Rounded knee cap matching thigh
      `C ${P(pt(-12.5, -10.0))} ${P(pt(-12.5, 10.0))} ${P(pt(0, 12.5))}`,
      // Prominent posterior gastrocnemius calf bulge tapering to slender Achilles tendon
      `C ${P(pt(len * 0.24, 20.5))} ${P(pt(len * 0.54, 16.2))} ${P(pt(len * 0.86, 8.2))}`,
      // Sculpted heel & plantar sole
      `C ${P([b[0] - 11.5, b[1] + 3.5])} ${P([heel[0] - 1.5, heel[1] - 2.5])} ${P(heel)}`,
      `C ${P([b[0] - 3.0, heel[1] + 2.5])} ${P(soleArch)} ${P(toeTip)}`,
      // Rounded toes & dorsum of foot up to anterior ankle
      `C ${P([toeTip[0] + 4.0, toeTip[1] - 2.8])} ${P([toeTop[0] + 2.5, toeTop[1] - 1.2])} ${P(toeTop)}`,
      `C ${P([b[0] + 24.0, b[1] - 1.5])} ${P(instep)} ${P(pt(len * 0.92, -7.4))}`,
      // Anterior shin (tibia) line back up to patella
      `C ${P(pt(len * 0.58, -9.6))} ${P(pt(len * 0.24, -12.2))} ${P(pt(0, -13.0))}`,
      'Z'
    ].join(' ');
  }

  if (foreshortened) {
    // Foreshortened front-view shin & foot (hip-flex or straight leg raise toward viewer):
    // when SLR approaches 90° (`len` small), the sole of the foot faces the viewer cleanly at `b`.
    const dirY = b[1] >= a[1] ? 1 : -1;
    const out = outSide;
    const knIn = -13.5 * out;
    const knOut = 14.5 * out;
    const anIn = -8.5 * out;
    const anOut = 9.5 * out;
    const footIn = -11.0 * out;
    const footOut = 13.5 * out;
    const footEnd = b[1] + 18.0;
    const midY = (a[1] + b[1]) / 2;
    const midX = (a[0] + b[0]) / 2;
    return [
      `M ${P([a[0] + knIn, a[1]])}`,
      `C ${P([a[0] + knIn, a[1] - dirY * 12.0])} ${P([a[0] + knOut, a[1] - dirY * 12.0])} ${P([a[0] + knOut, a[1]])}`,
      `C ${P([midX + 16.0 * out, midY])} ${P([b[0] + anOut, b[1] - dirY * 4.0])} ${P([b[0] + anOut, b[1]])}`,
      // Foreshortened foot below/in front of ankle
      `C ${P([b[0] + footOut, b[1] + 6.0])} ${P([b[0] + footOut, footEnd])} ${P([b[0] + 2.0 * out, footEnd])}`,
      `C ${P([b[0] + footIn, footEnd])} ${P([b[0] + footIn, b[1] + 6.0])} ${P([b[0] + anIn, b[1]])}`,
      `C ${P([b[0] + anIn, b[1] - dirY * 4.0])} ${P([midX - 14.5 * out, midY])} ${P([a[0] + knIn, a[1]])}`,
      'Z'
    ].join(' ');
  }

  const kneeOut = seated ? 14.5 : 12.4;
  const kneeIn = seated ? -14.0 : -11.8;

  if (seated) {
    // Seated shin hanging from 90° knee + flat-ish foot below ankle
    return [
      `M ${P(pt(0, kneeIn))}`,
      `C ${P(pt(-12.5, -9.6))} ${P(pt(-12.5, 9.6))} ${P(pt(0, kneeOut))}`,
      // Lateral calf bulge tapering to ankle
      `C ${P(pt(len * 0.18, 16.8))} ${P(pt(len * 0.44, 15.8))} ${P(pt(len * 0.70, 10.4))}`,
      `C ${P(pt(len * 0.84, 7.4))} ${P(pt(len * 0.94, 6.2))} ${P(pt(len, 6.6))}`,
      // Flat-ish foot below ankle (wide plantar base facing viewer)
      `C ${P(pt(len + 5.0, 9.5))} ${P(pt(len + 12.0, 16.5))} ${P(pt(len + 16.5, 15.5))}`,
      `C ${P(pt(len + 18.8, 14.2))} ${P(pt(len + 19.0, -9.5))} ${P(pt(len + 16.0, -11.5))}`,
      `C ${P(pt(len + 11.5, -12.2))} ${P(pt(len + 5.0, -8.5))} ${P(pt(len, -6.2))}`,
      // Medial ankle flaring back up into medial calf bulge
      `C ${P(pt(len * 0.92, -5.8))} ${P(pt(len * 0.80, -7.0))} ${P(pt(len * 0.66, -9.8))}`,
      `C ${P(pt(len * 0.42, -14.2))} ${P(pt(len * 0.18, -14.6))} ${P(pt(0, kneeIn))}`,
      'Z'
    ].join(' ');
  }

  return [
    `M ${P(pt(0, kneeIn))}`,
    // Rounded knee cap matching thigh
    `C ${P(pt(-12.5, -9.6))} ${P(pt(-12.5, 9.6))} ${P(pt(0, kneeOut))}`,
    // Lateral gastrocnemius calf bulge in upper third, then clear taper to slender ankle
    `C ${P(pt(len * 0.18, 16.4))} ${P(pt(len * 0.42, 15.8))} ${P(pt(len * 0.68, 10.6))}`,
    `C ${P(pt(len * 0.82, 7.6))} ${P(pt(len * 0.92, 6.2))} ${P(pt(len, 6.4))}`,
    // Real front-view foot with lateral contour, grounded forefoot/toes, and medial arch
    `C ${P(pt(len + 6.0, 8.2))} ${P(pt(len + 13.5, 13.6))} ${P(pt(len + 18.2, 12.2))}`,
    `C ${P(pt(len + 21.5, 10.2))} ${P(pt(len + 21.8, -5.2))} ${P(pt(len + 17.8, -8.2))}`,
    `C ${P(pt(len + 13.0, -9.4))} ${P(pt(len + 6.0, -7.2))} ${P(pt(len, -6.0))}`,
    // Medial ankle flaring back up into medial gastrocnemius calf bulge
    `C ${P(pt(len * 0.92, -5.8))} ${P(pt(len * 0.80, -7.0))} ${P(pt(len * 0.66, -9.8))}`,
    `C ${P(pt(len * 0.42, -14.2))} ${P(pt(len * 0.18, -14.6))} ${P(pt(0, kneeIn))}`,
    'Z'
  ].join(' ');
}

/**
 * Front-view anatomical head & neck (`j.p.neck -> j.p.head`).
 * Sized so total standing height (crown y≈14 to sole y≈552, ~538px) is ≈ 7.5 heads (head height ~71px, width ~56px).
 */
function frontHeadNeckPath(j: Joints): string {
  const neck = j.p.neck;
  const head = j.p.head;
  const dx = head[0] - neck[0];
  const dy = head[1] - neck[1];
  const len = Math.hypot(dx, dy) || 42;
  const ux = dx / len;
  const uy = dy / len;
  const rx = -uy;
  const ry = ux;
  const hp = (up: number, right: number): Pt => [
    head[0] + ux * up + rx * right,
    head[1] + uy * up + ry * right
  ];

  return [
    // Crown of head (y ≈ 14 when head=[150,56])
    `M ${P(hp(42.0, 0))}`,
    // Cranial vault -> temple -> cheekbone -> jaw -> chin (y ≈ 85, head height = 71px)
    `C ${P(hp(42.0, 17.5))} ${P(hp(30.0, 27.8))} ${P(hp(12.0, 27.8))}`,
    `C ${P(hp(-2.0, 27.8))} ${P(hp(-16.5, 22.5))} ${P(hp(-25.5, 13.8))}`,
    // Neck cylinder & trapezius slope into upper chest
    `L ${P(hp(-36.0, 14.5))}`,
    `C ${P(hp(-43.0, 16.5))} ${P(hp(-49.0, 25.0))} ${P(hp(-54.0, 30.0))}`,
    `L ${P(hp(-54.0, -30.0))}`,
    `C ${P(hp(-49.0, -25.0))} ${P(hp(-43.0, -16.5))} ${P(hp(-36.0, -14.5))}`,
    // Left jawline -> cheek -> temple -> crown
    `L ${P(hp(-25.5, -13.8))}`,
    `C ${P(hp(-16.5, -22.5))} ${P(hp(-2.0, -27.8))} ${P(hp(12.0, -27.8))}`,
    `C ${P(hp(30.0, -27.8))} ${P(hp(42.0, -17.5))} ${P(hp(42.0, 0))}`,
    'Z'
  ].join(' ');
}

/**
 * Front-view anatomical torso (`neck, shL, shR, hipL, hipR`).
 * Shoulders ≈ 2.2–2.3 head-widths wide; chest/lat taper to natural waist at elbow level (y≈205);
 * hips/pelvis flare to real anatomical width (narrower than shoulders, wider than waist).
 */
function frontTorsoPath(j: Joints, seated?: boolean): string {
  const { neck, shL, shR, hipL, hipR } = j.p;
  const hipMidY = (hipL[1] + hipR[1]) / 2;
  const waistY = (shL[1] + hipL[1]) * 0.49; // ~205px (right at elbow level)
  const waistL: Pt = [150 + 38.5, waistY];
  const waistR: Pt = [150 - 38.5, waistY];
  const hipOut = seated ? 28.0 : 22.0;
  const pelvisDrop = seated ? 22.0 : 19.0;

  return [
    `M ${P([neck[0] + 14.0, neck[1] - 5.0])}`,
    // Left trapezius & clavicle slope to left acromion / shoulder cap
    `C ${P([neck[0] + 25.0, neck[1] + 1.0])} ${P([shL[0] - 18.0, shL[1] - 14.5])} ${P([shL[0] + 3.0, shL[1] - 15.0])}`,
    // Left shoulder joint into axilla / upper latissimus
    `C ${P([shL[0] + 14.0, shL[1] - 11.0])} ${P([shL[0] + 13.0, shL[1] + 16.0])} ${P([shL[0] - 11.0, shL[1] + 28.0])}`,
    // Left chest / latissimus dorsi tapering to natural waist at elbow height
    `C ${P([shL[0] - 13.5, shL[1] + 54.0])} ${P([waistL[0] + 2.5, waistL[1] - 26.0])} ${P(waistL)}`,
    // Left waist flaring over iliac crest / pelvis to outer hip (wide on stool when seated)
    `C ${P([waistL[0] - 0.5, waistL[1] + 26.0])} ${P([hipL[0] + hipOut - 1.0, hipL[1] - 30.0])} ${P([hipL[0] + hipOut, hipL[1] + (seated ? 4.0 : -2.0)])}`,
    // Lower pelvis resting on seat / groin
    `C ${P([hipL[0] + hipOut, hipL[1] + 16.0])} ${P([hipL[0] + 10.0, hipL[1] + pelvisDrop])} ${P([hipL[0] - 14.0, hipL[1] + pelvisDrop])}`,
    `Q ${P([150, hipMidY + (seated ? 19.0 : 15.0)])} ${P([hipR[0] + 14.0, hipR[1] + pelvisDrop])}`,
    // Right lower pelvis to outer right hip
    `C ${P([hipR[0] - 10.0, hipR[1] + pelvisDrop])} ${P([hipR[0] - hipOut, hipR[1] + 16.0])} ${P([hipR[0] - hipOut, hipR[1] + (seated ? 4.0 : -2.0)])}`,
    // Right outer hip tapering to right waist
    `C ${P([hipR[0] - hipOut + 1.0, hipR[1] - 30.0])} ${P([waistR[0] + 0.5, waistR[1] + 26.0])} ${P(waistR)}`,
    // Right waist flaring up right latissimus to right axilla
    `C ${P([waistR[0] - 2.5, waistR[1] - 26.0])} ${P([shR[0] + 13.5, shR[1] + 54.0])} ${P([shR[0] + 11.0, shR[1] + 28.0])}`,
    // Right axilla around right shoulder cap
    `C ${P([shR[0] - 13.0, shR[1] + 16.0])} ${P([shR[0] - 14.0, shR[1] - 11.0])} ${P([shR[0] - 3.0, shR[1] - 15.0])}`,
    // Right shoulder top up trapezius to right side of neck
    `C ${P([shR[0] + 18.0, shR[1] - 14.5])} ${P([neck[0] - 25.0, neck[1] + 1.0])} ${P([neck[0] - 14.0, neck[1] - 5.0])}`,
    'Z'
  ].join(' ');
}

/**
 * Side-view anatomical head & neck (person facing right `+x`).
 * Distinct facial profile (forehead, nose bridge/tip, lips, chin) in front and full occipital skull behind.
 */
function sideHeadNeckPath(j: Joints): string {
  const { neck, head } = j.p;
  const dx = head[0] - neck[0];
  const dy = head[1] - neck[1];
  const len = Math.hypot(dx, dy) || 40;
  const ux = dx / len;
  const uy = dy / len;
  // Forward vector (+x when upright)
  const fx = -uy;
  const fy = ux;
  const hp = (up: number, fwd: number): Pt => [
    head[0] + ux * up + fx * fwd,
    head[1] + uy * up + fy * fwd
  ];

  return [
    // Crown of head (y ≈ 14, matching 7.5-head proportion)
    `M ${P(hp(42.0, -2.0))}`,
    // Forehead & brow ridge facing right
    `C ${P(hp(42.0, 14.5))} ${P(hp(31.0, 22.5))} ${P(hp(15.5, 22.0))}`,
    // Nose bridge & projecting nose tip
    `C ${P(hp(10.5, 22.8))} ${P(hp(4.5, 28.2))} ${P(hp(0.5, 26.8))}`,
    `C ${P(hp(-2.0, 25.8))} ${P(hp(-3.5, 23.0))} ${P(hp(-5.5, 23.5))}`,
    // Upper/lower lip & sculpted chin
    `C ${P(hp(-10.0, 24.2))} ${P(hp(-17.5, 23.5))} ${P(hp(-23.5, 20.0))}`,
    // Submental jawline under chin to anterior neck
    `C ${P(hp(-27.0, 16.0))} ${P(hp(-27.5, 11.5))} ${P(hp(-30.5, 11.0))}`,
    // Anterior neck down into upper chest
    `L ${P(hp(-52.0, 13.5))}`,
    `L ${P(hp(-52.0, -16.5))}`,
    // Posterior neck (nape) curving out into full back of skull (occiput)
    `L ${P(hp(-24.0, -14.0))}`,
    `C ${P(hp(-14.0, -24.5))} ${P(hp(2.0, -29.5))} ${P(hp(17.5, -28.0))}`,
    `C ${P(hp(32.5, -25.5))} ${P(hp(42.0, -14.5))} ${P(hp(42.0, -2.0))}`,
    'Z'
  ].join(' ');
}

/**
 * Side-view anatomical torso (`hip -> neck/sh`, facing right `+x`).
 * Real front-to-back depth: chest in front, upper-back & scapula curve behind,
 * belly in front, lumbar lordosis curve behind, and full rounded glutes.
 */
function sideTorsoPath(j: Joints): string {
  const { hip, neck, sh } = j.p;
  const dx = neck[0] - hip[0];
  const dy = neck[1] - hip[1];
  const len = Math.hypot(dx, dy) || 204;
  const ux = dx / len;
  const uy = dy / len;
  // Forward vector (+x when upright)
  const fx = -uy;
  const fy = ux;
  const tp = (upFrac: number, fwd: number): Pt => [
    hip[0] + ux * (len * upFrac) + fx * fwd,
    hip[1] + uy * (len * upFrac) + fy * fwd
  ];
  const shFwd = Math.max(0, (sh[0] - neck[0]) * fx + (sh[1] - neck[1]) * fy);

  return [
    // Base of posterior neck / C7
    `M ${P(tp(0.98, -14.0))}`,
    // Suprasternal notch / anterior neck base
    `L ${P(tp(0.96, 12.5 + shFwd * 0.25))}`,
    // Prominent chest (pectoral) projection in front
    `C ${P(tp(0.88, 31.5 + shFwd * 0.35))} ${P(tp(0.72, 35.5 + shFwd * 0.25))} ${P(tp(0.56, 28.5))}`,
    // Upper waist & natural anterior belly / abdomen curve down to pelvis
    `C ${P(tp(0.44, 24.8))} ${P(tp(0.28, 27.2))} ${P(tp(0.12, 24.5))}`,
    `C ${P(tp(0.04, 22.5))} ${P(tp(-0.04, 18.5))} ${P(tp(-0.08, 12.0))}`,
    // Lower pelvis wrapping under hip joint into gluteal fold
    `C ${P(tp(-0.12, 2.0))} ${P(tp(-0.12, -18.0))} ${P(tp(-0.04, -29.5))}`,
    // Full rounded glutes behind hip -> inward lumbar lordosis curve at lower back
    `C ${P(tp(0.06, -35.5))} ${P(tp(0.18, -32.5))} ${P(tp(0.30, -21.0))}`,
    `C ${P(tp(0.38, -16.2))} ${P(tp(0.48, -17.0))} ${P(tp(0.58, -23.5))}`,
    // Thoracic upper-back & shoulder blade (scapula) curve up to posterior neck
    `C ${P(tp(0.72, -32.5))} ${P(tp(0.86, -31.0))} ${P(tp(0.98, -14.0))}`,
    'Z'
  ].join(' ');
}

function buildBodyPaths(j: Joints, view: View, pose?: Pose) {
  if (view === 'front') {
    const { shL, elL, wrL, shR, elR, wrR, hipL, knL, anL, hipR, knR, anR } = j.p;
    const seated = !!pose?.seated;
    const sagArmL = pose?.shFlexL != null;
    const sagArmR = pose?.shFlexR != null;
    const rotArmL = pose?.shRotL != null;
    const rotArmR = pose?.shRotR != null;
    const sagLegL = pose?.hipFlexL != null;
    const sagLegR = pose?.hipFlexR != null;
    const slrL = sagLegL && (pose?.kneeFlexL ?? 0) === 0;
    const slrR = sagLegR && (pose?.kneeFlexR ?? 0) === 0;

    // When seated, angle forearms inward so the hands rest naturally on the thighs
    const elLUse: Pt = seated ? [shL[0] + 10, shL[1] + 88] : elL;
    const elRUse: Pt = seated ? [shR[0] - 10, shR[1] + 88] : elR;
    const wrLUse: Pt = seated ? [knL[0] + 3, knL[1] - 48] : wrL;
    const wrRUse: Pt = seated ? [knR[0] - 3, knR[1] - 48] : wrR;

    const uaLPath = upperArmPath(shL, elLUse, 1, 'front', sagArmL);
    const faLPath = forearmHandPath(elLUse, wrLUse, 1, 'front', sagArmL || rotArmL);
    const uaRPath = upperArmPath(shR, elRUse, -1, 'front', sagArmR);
    const faRPath = forearmHandPath(elRUse, wrRUse, -1, 'front', sagArmR || rotArmR);
    const thLPath = thighPath(hipL, knL, 1, 'front', seated, sagLegL);
    const shLPath = shinFootPath(knL, anL, 1, 'front', undefined, seated, sagLegL);
    const thRPath = thighPath(hipR, knR, -1, 'front', seated, sagLegR);
    const shRPath = shinFootPath(knR, anR, -1, 'front', undefined, seated, sagLegR);

    const mainPaths: string[] = [
      frontHeadNeckPath(j),
      frontTorsoPath(j, seated)
    ];
    const nearArmPaths: string[] = [];

    if (seated) {
      mainPaths.push(uaLPath, uaRPath, shLPath, shRPath);
      nearArmPaths.push(thLPath, thRPath, faLPath, faRPath);
    } else {
      // Legs: if a leg is flexing toward the viewer (hip-flex or SLR), draw it in front of the torso/hip
      // For hip-flex (bent knee), the hanging shin stays under the raised thigh; for SLR, shin & foot come forward.
      if (sagLegL) {
        if (slrL) {
          nearArmPaths.push(thLPath, shLPath);
        } else {
          mainPaths.push(shLPath);
          nearArmPaths.push(thLPath);
        }
      } else {
        mainPaths.push(thLPath, shLPath);
      }

      if (sagLegR) {
        if (slrR) {
          nearArmPaths.push(thRPath, shRPath);
        } else {
          mainPaths.push(shRPath);
          nearArmPaths.push(thRPath);
        }
      } else {
        mainPaths.push(thRPath, shRPath);
      }

      if (sagArmL || rotArmL) {
        if (rotArmL) {
          mainPaths.push(uaLPath);
          nearArmPaths.push(faLPath);
        } else {
          nearArmPaths.push(uaLPath, faLPath);
        }
      } else {
        mainPaths.push(uaLPath, faLPath);
      }

      if (sagArmR || rotArmR) {
        if (rotArmR) {
          mainPaths.push(uaRPath);
          nearArmPaths.push(faRPath);
        } else {
          nearArmPaths.push(uaRPath, faRPath);
        }
      } else {
        mainPaths.push(uaRPath, faRPath);
      }
    }

    return {
      farPaths: [] as string[],
      mainPaths,
      nearArmPaths,
      limbByKey: {
        uaL: [uaLPath],
        faL: [faLPath],
        uaR: [uaRPath],
        faR: [faRPath],
        thL: [thLPath],
        shL: [shLPath],
        thR: [thRPath],
        shR: [shRPath]
      } as Record<string, string[]>
    };
  }

  // Side view (person facing right)
  const { sh, el, wr, hip, kn, an, toe } = j.p;
  const isShRot = pose?.shRot != null;
  const isShAbd = pose?.shAbd != null;
  const isHipAbd = pose?.hipAbd != null;
  const isHipFlexSide = pose?.hipFlex != null && (pose?.kneeFlex ?? 0) > 0;
  const isSlrSide = pose?.hipFlex != null && (pose?.kneeFlex ?? 0) === 0;
  const isShFlexSide = pose?.shFlex != null && !pose?.grounded;
  const isGroundedSide = !!pose?.grounded;
  const seated = !!pose?.seated;

  const findLimb = (key: string) => j.limbs.find((l) => l.key === key);
  const thF = findLimb('thF');
  const shF = findLimb('shF');
  const uaF = findLimb('uaF');
  const faF = findLimb('faF');
  const farHip = thF?.a ?? [hip[0] - 8, hip[1] - 2];
  const farKn: Pt = isHipFlexSide
    ? [farHip[0] + 104, farHip[1] + 6]
    : isSlrSide || isGroundedSide
      ? [farHip[0], farHip[1] + 110]
      : (thF?.b ?? [kn[0] - 8, kn[1] - 2]);
  const farAn: Pt = isHipFlexSide
    ? [farKn[0], farKn[1] + 110]
    : isSlrSide || isGroundedSide
      ? [farKn[0], farKn[1] + 110]
      : (shF?.b ?? [an[0] - 8, an[1] - 2]);
  const farToe: Pt = [farAn[0] + 34, farAn[1] + 6];
  const farSh = uaF?.a ?? [sh[0] - 8, sh[1] - 2];
  const farEl: Pt = isHipFlexSide
    ? [farSh[0] - 8, farSh[1] + 84]
    : isShFlexSide
      ? [farSh[0] + 6, farSh[1] + 84]
      : (uaF?.b ?? [el[0] - 8, el[1] - 2]);
  const farWr: Pt = isHipFlexSide
    ? [farEl[0] + 22, farEl[1] + 62]
    : isShFlexSide
      ? [farEl[0] + 14, farEl[1] + 74]
      : (faF?.b ?? [wr[0] - 8, wr[1] - 2]);

  const elNear: Pt = isHipFlexSide ? [sh[0] - 8, sh[1] + 84] : el;
  const wrNear: Pt = isHipFlexSide ? [elNear[0] + 22, elNear[1] + 62] : wr;

  const uaNear = upperArmPath(sh, elNear, 1, 'side', isShAbd);
  const faNear = forearmHandPath(elNear, wrNear, 1, 'side', isShAbd);
  const thNear = thighPath(hip, kn, 1, 'side');
  const shNear = shinFootPath(kn, an, 1, 'side', toe);

  return {
    farPaths: isShRot
      ? [
          thighPath(farHip, farKn, 1, 'side'),
          shinFootPath(farKn, farAn, 1, 'side', farToe)
        ]
      : [
          thighPath(farHip, farKn, 1, 'side'),
          shinFootPath(farKn, farAn, 1, 'side', farToe),
          upperArmPath(farSh, farEl, 1, 'side'),
          forearmHandPath(farEl, farWr, 1, 'side')
        ],
    mainPaths:
      isHipAbd || seated || isHipFlexSide || isSlrSide
        ? [sideHeadNeckPath(j), sideTorsoPath(j)]
        : [sideHeadNeckPath(j), sideTorsoPath(j), thNear, shNear],
    nearArmPaths:
      isHipAbd || seated || isHipFlexSide || isSlrSide
        ? [thNear, shNear, uaNear, faNear]
        : [uaNear, faNear],
    limbByKey: {
      ua: [uaNear],
      fa: [faNear],
      th: [thNear],
      sh: [shNear]
    } as Record<string, string[]>
  };
}

/**
 * Renders a set of overlapping body-part paths as ONE continuous silhouette
 * with a crisp ~1.8px dark outer outline and seamless joints.
 */
const SilhouetteLayer: React.FC<{
  paths: string[];
  outline: string;
  fill: string;
  outlineWidth?: number;
}> = ({ paths, outline, fill, outlineWidth = 3.6 }) => {
  if (!paths.length) return null;
  return (
    <g>
      <g fill={outline} stroke={outline} strokeWidth={outlineWidth} strokeLinejoin="round" strokeLinecap="round">
        {paths.map((d, i) => (
          <path key={`o-${i}`} d={d} />
        ))}
      </g>
      <g fill={fill} stroke={fill} strokeWidth={0.4} strokeLinejoin="round" strokeLinecap="round">
        {paths.map((d, i) => (
          <path key={`f-${i}`} d={d} />
        ))}
      </g>
    </g>
  );
};

/** Clean line-art body (one continuous outline). Animate by passing a new pose. */
export const BodyFigure: React.FC<{
  view: View;
  pose?: Pose;
  ghost?: Pose;
  ghostKeys?: string[];
  dots?: Record<string, string>;
  onDotClick?: (jointKey: string) => void;
  showJoints?: boolean;
  lines?: FigureLine[];
  arcs?: FigureArc[];
  labels?: FigureLabel[];
  plumb?: boolean;
  className?: string;
  title?: string;
}> = ({
  view,
  pose,
  ghost,
  ghostKeys,
  dots,
  onDotClick,
  showJoints,
  lines,
  arcs,
  labels,
  plumb,
  className,
  title
}) => {
  const j = solve(view, pose);
  const g = ghost ? solve(view, ghost) : null;

  const body = buildBodyPaths(j, view, pose);
  const ghostBody = g ? buildBodyPaths(g, view, ghost) : null;
  const ghostPaths = ghostBody
    ? (ghostKeys ?? Object.keys(ghostBody.limbByKey)).flatMap((k) => ghostBody.limbByKey[k] ?? [])
    : [];

  const isForeshortenedMove =
    (view === 'front' &&
      (pose?.hipFlexL != null ||
        pose?.hipFlexR != null ||
        pose?.shFlexL != null ||
        pose?.shFlexR != null ||
        pose?.shRotL != null ||
        pose?.shRotR != null)) ||
    (view === 'side' && (pose?.shAbd != null || pose?.hipAbd != null || (pose?.seated && pose?.hipRot != null)));

  const arcPath = (a: FigureArc) => {
    const r = a.r ?? 34;
    const p = (deg: number): Pt => [
      a.center[0] + r * Math.cos((deg * Math.PI) / 180),
      a.center[1] + r * Math.sin((deg * Math.PI) / 180)
    ];
    let d = a.toDeg - a.fromDeg;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;

    // Front-view 90/90 shoulder rotation: forearm rotates down (+IR) or up (-ER) from horizontal 0° at the elbow
    if (view === 'front' && (pose?.shRotL != null || pose?.shRotR != null)) {
      const rotVal = pose?.shRotL ?? pose?.shRotR ?? 0;
      const isLeft = a.center[0] >= 150;
      const baseDeg = isLeft ? 180 : 0;
      const sweep = (isLeft ? -1 : 1) * Math.sign(rotVal || 1) * Math.min(Math.abs(rotVal), 90);
      const rUse = Math.min(r, 38);
      const pR = (deg: number): Pt => [
        a.center[0] + rUse * Math.cos((deg * Math.PI) / 180),
        a.center[1] + rUse * Math.sin((deg * Math.PI) / 180)
      ];
      const s = pR(baseDeg);
      const e = pR(baseDeg + sweep);
      return {
        d:
          Math.abs(sweep) < 0.5
            ? `M${a.center[0]},${a.center[1]} L${s[0]},${s[1]}`
            : `M${a.center[0]},${a.center[1]} L${s[0]},${s[1]} A${rUse},${rUse} 0 0 ${sweep > 0 ? 1 : 0} ${e[0]},${e[1]} Z`,
        mid: pR(baseDeg + sweep * 0.55)
      };
    }

    // When a movement is foreshortened along its own vertical line (hip-flex, slr, shoulder-flex in front;
    // shoulder-abd, hip-abd, seated hip-ir/er in side), display a clear perspective wedge showing the angle from 0° (down).
    if (isForeshortenedMove && Math.abs(d) < 18) {
      const degNum = a.text ? parseFloat(a.text) : 0;
      const sideSign =
        view === 'front'
          ? a.center[0] >= 150
            ? 1
            : -1
          : pose?.seated && (pose?.hipRot ?? 0) < 0
            ? -1
            : 1;
      const sweep = -sideSign * Math.min(Math.max(degNum, 0), 155);
      const s = p(90);
      const e = p(90 + sweep);
      return {
        d:
          Math.abs(sweep) < 0.5
            ? `M${a.center[0]},${a.center[1]} L${s[0]},${s[1]}`
            : `M${a.center[0]},${a.center[1]} L${s[0]},${s[1]} A${r},${r} 0 0 ${sweep > 0 ? 1 : 0} ${e[0]},${e[1]} Z`,
        mid: p(90 + sweep * 0.55)
      };
    }

    const s = p(a.fromDeg),
      e = p(a.fromDeg + d);
    return {
      d: `M${a.center[0]},${a.center[1]} L${s[0]},${s[1]} A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${e[0]},${e[1]} Z`,
      mid: p(a.fromDeg + d / 2)
    };
  };

  const placedLabels = labels?.length ? layoutLabels(labels, { view }) : [];

  const tag = (l: PlacedLabel, i: number) => (
    <g
      key={i}
      onClick={l.onClick}
      className={l.onClick ? 'cursor-pointer' : undefined}
      role={l.onClick ? 'button' : undefined}
    >
      <line x1={l.jointX} y1={l.jointY} x2={l.lineX} y2={l.lineY} stroke={l.color} strokeWidth={1.5} />
      <circle cx={l.jointX} cy={l.jointY} r={3} fill={l.color} />
      <rect x={l.x} y={l.y} width={l.width} height={l.height} rx={l.height / 2} fill={l.color} />
      <text
        x={l.x + l.width / 2}
        y={l.centerY + 4}
        fontSize={11}
        fontWeight={700}
        textAnchor="middle"
        fill={l.color === '#F59E0B' || l.color === '#FFC809' ? '#111827' : '#fff'}
      >
        {l.text}
      </text>
    </g>
  );

  const svgViewBox = placedLabels.length
    ? view === 'side'
      ? LABEL_VIEWBOX_SIDE
      : LABEL_VIEWBOX_FRONT
    : '-10 -70 320 620';

  return (
    <svg viewBox={svgViewBox} className={className} role="img" aria-label={title ?? 'Body model'}>
      <defs>
        <radialGradient id="pf-floor" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#111827" stopOpacity="0.12" />
          <stop offset="1" stopColor="#111827" stopOpacity="0" />
        </radialGradient>
      </defs>
      {pose?.seated || (view === 'side' && pose?.hipFlex != null && (pose?.kneeFlex ?? 0) > 0) ? (
        view === 'front' ? (
          <g aria-label="Examination stool">
            <ellipse cx={150} cy={488} rx={82} ry={8} fill="url(#pf-floor)" />
            {/* Stool legs & footrest in the same clean outline/fill style */}
            <line x1={102} y1={330} x2={90} y2={484} stroke={OUTLINE} strokeWidth={3.2} strokeLinecap="round" />
            <line x1={198} y1={330} x2={210} y2={484} stroke={OUTLINE} strokeWidth={3.2} strokeLinecap="round" />
            <line x1={150} y1={330} x2={150} y2={486} stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
            <line x1={96} y1={426} x2={204} y2={426} stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
            {/* Wide stool seat directly under pelvis */}
            <rect
              x={70}
              y={314}
              width={160}
              height={18}
              rx={9}
              fill={FILL}
              stroke={OUTLINE}
              strokeWidth={1.8}
            />
          </g>
        ) : (
          <g aria-label="Examination stool">
            <ellipse cx={155} cy={488} rx={82} ry={8} fill="url(#pf-floor)" />
            <line x1={116} y1={334} x2={106} y2={484} stroke={OUTLINE} strokeWidth={3.2} strokeLinecap="round" />
            <line x1={184} y1={334} x2={194} y2={484} stroke={OUTLINE} strokeWidth={3.2} strokeLinecap="round" />
            <line x1={150} y1={334} x2={150} y2={486} stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
            <line x1={110} y1={426} x2={190} y2={426} stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
            <rect
              x={98}
              y={318}
              width={108}
              height={16}
              rx={8}
              fill={FILL}
              stroke={OUTLINE}
              strokeWidth={1.8}
            />
          </g>
        )
      ) : (
        <ellipse cx={150} cy={548} rx={78} ry={8} fill="url(#pf-floor)" />
      )}
      {plumb && (
        <line
          x1={view === 'front' ? 150 : j.p.an[0] + 4}
          y1={10}
          x2={view === 'front' ? 150 : j.p.an[0] + 4}
          y2={548}
          stroke="#9CA3AF"
          strokeDasharray="3 6"
        />
      )}
      {ghostPaths.length > 0 && (
        <g opacity={0.28}>
          <SilhouetteLayer paths={ghostPaths} outline="#64748B" fill="#CBD5E1" outlineWidth={2.6} />
        </g>
      )}

      {/* Far-side limbs (side view) */}
      <SilhouetteLayer paths={body.farPaths} outline={FAR_OUTLINE} fill={FAR_FILL} outlineWidth={3.0} />

      {/* Main anatomical silhouette: one continuous #111827 (~1.8px) outline & #F3F4F6 fill */}
      <SilhouetteLayer paths={body.mainPaths} outline={OUTLINE} fill={FILL} outlineWidth={3.6} />

      {/* Near arm in side view (or seated/foreshortened limbs in front view) */}
      <SilhouetteLayer paths={body.nearArmPaths} outline={OUTLINE} fill={FILL} outlineWidth={3.6} />

      {/* 90/90 shoulder rotation foreshortened upper-arm cue & horizontal 0° reference line */}
      {view === 'side' && pose?.shRot != null && (
        <g>
          {/* Round elbow contour in front of the shoulder showing the upper arm pointing toward the viewer */}
          <circle
            cx={j.p.el[0]}
            cy={j.p.el[1]}
            r={11.5}
            fill={FILL}
            stroke={OUTLINE}
            strokeWidth={1.5}
            strokeDasharray="3 2.5"
          />
          {/* Horizontal 0° starting line from elbow forward */}
          <line
            x1={j.p.el[0]}
            y1={j.p.el[1]}
            x2={j.p.el[0] + 92}
            y2={j.p.el[1]}
            stroke="#9CA3AF"
            strokeWidth={1.4}
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* Dashed segment separation lines on chest/shoulders and hips (matching InBodySegmentSilhouette) */}
      <g stroke="#6B7280" strokeWidth={1.3} fill="none" strokeDasharray="3.5 3.5" strokeLinecap="round">
        {view === 'front' ? (
          <>
            {/* Left & Right Shoulder segment lines */}
            <line
              x1={j.p.shR[0] + 9}
              y1={j.p.shR[1] - 12}
              x2={j.p.shR[0] + 13}
              y2={j.p.shR[1] + 26}
            />
            <line
              x1={j.p.shL[0] - 9}
              y1={j.p.shL[1] - 12}
              x2={j.p.shL[0] - 13}
              y2={j.p.shL[1] + 26}
            />
            {/* Pelvis / Hip V-shaped segment lines */}
            <line
              x1={j.p.hipR[0] - 16}
              y1={j.p.hipR[1] - 14}
              x2={150}
              y2={(j.p.hipL[1] + j.p.hipR[1]) / 2 + 14}
            />
            <line
              x1={j.p.hipL[0] + 16}
              y1={j.p.hipL[1] - 14}
              x2={150}
              y2={(j.p.hipL[1] + j.p.hipR[1]) / 2 + 14}
            />
            {/* Seated or foreshortened knee-cap contour cues */}
            {(pose?.seated || pose?.hipFlexR != null) && (
              <path
                d={`M ${f1(j.p.knR[0] - 13)},${f1(j.p.knR[1] - 4)} Q ${f1(j.p.knR[0])},${f1(j.p.knR[1] - 14)} ${f1(j.p.knR[0] + 13)},${f1(j.p.knR[1] - 4)}`}
              />
            )}
            {(pose?.seated || pose?.hipFlexL != null) && (
              <path
                d={`M ${f1(j.p.knL[0] - 13)},${f1(j.p.knL[1] - 4)} Q ${f1(j.p.knL[0])},${f1(j.p.knL[1] - 14)} ${f1(j.p.knL[0] + 13)},${f1(j.p.knL[1] - 4)}`}
              />
            )}
            {/* Foreshortened elbow-cap contour cues for front shoulder flexion or 90/90 rotation */}
            {(pose?.shFlexR != null || pose?.shRotR != null) && (
              <circle cx={j.p.elR[0]} cy={j.p.elR[1]} r={9.5} />
            )}
            {(pose?.shFlexL != null || pose?.shRotL != null) && (
              <circle cx={j.p.elL[0]} cy={j.p.elL[1]} r={9.5} />
            )}
          </>
        ) : (
          <>
            {/* Side view shoulder & hip segment lines */}
            <line
              x1={j.p.sh[0] - 12}
              y1={j.p.sh[1] - 12}
              x2={j.p.sh[0] + 12}
              y2={j.p.sh[1] + 14}
            />
            <line
              x1={j.p.hip[0] - 20}
              y1={j.p.hip[1] - 8}
              x2={j.p.hip[0] + 18}
              y2={j.p.hip[1] + 10}
            />
            {pose?.shAbd != null && (
              <circle cx={j.p.el[0]} cy={j.p.el[1]} r={10.0} />
            )}
            {pose?.hipAbd != null && (
              <circle cx={j.p.kn[0]} cy={j.p.kn[1]} r={11.5} />
            )}
          </>
        )}
      </g>

      {lines?.map((l, i) => (
        <line
          key={i}
          x1={l.a[0]}
          y1={l.a[1]}
          x2={l.b[0]}
          y2={l.b[1]}
          stroke={l.color}
          strokeWidth={l.width ?? 2.4}
          strokeDasharray={l.dashed ? '4 4' : undefined}
          strokeLinecap="round"
        />
      ))}
      {arcs?.map((a, i) => {
        const { d, mid } = arcPath(a);
        return (
          <g key={i}>
            <path d={d} fill={a.color} fillOpacity={0.16} stroke={a.color} strokeWidth={1.6} />
            {a.text && (
              <text
                x={mid[0]}
                y={mid[1]}
                dy={4}
                fontSize={14}
                fontWeight={800}
                textAnchor="middle"
                fill={a.color}
                stroke="#fff"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {a.text}
              </text>
            )}
          </g>
        );
      })}
      {(showJoints || dots) &&
        Object.entries(j.p)
          .filter(([k]) => k !== 'head' && k !== 'neck' && k !== 'toe')
          .map(([k, p]) => {
            const c = dots?.[k];
            if (!showJoints && !c) return null;
            const clickable = !!(c && onDotClick);
            return (
              <g
                key={k}
                onClick={clickable ? () => onDotClick?.(k) : undefined}
                className={clickable ? 'cursor-pointer' : undefined}
              >
                {c && <circle cx={p[0]} cy={p[1]} r={11} fill={c} opacity={0.18} />}
                <circle cx={p[0]} cy={p[1]} r={c ? 5.5 : 3.6} fill={c ?? '#fff'} stroke="#111827" strokeWidth={1.3} />
              </g>
            );
          })}
      {placedLabels.map(tag)}
    </svg>
  );
};
