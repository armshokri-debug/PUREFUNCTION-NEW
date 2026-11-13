export const WEIGHT_UNIT = 'lb';

export const KG_TO_LB = 2.20462;

/** Convert kilograms to pounds (1 kg = 2.20462 lb). */
export function kgToLb(kg: number): number {
  return kg * KG_TO_LB;
}

/** Convert pounds to kilograms (1 kg = 2.20462 lb). */
export function lbToKg(lb: number): number {
  return lb / KG_TO_LB;
}

/** Convert kilograms to pounds rounded to 1 decimal place. */
export function roundLb(kg: number): number {
  const n = Number(kgToLb(kg).toFixed(1));
  return n === 0 ? 0 : n;
}

/** Format a weight stored in kg as lb rounded to 1 decimal (e.g. "176.4 lb"). */
export function formatWeight(kg: number): string {
  return `${roundLb(kg)} ${WEIGHT_UNIT}`;
}
