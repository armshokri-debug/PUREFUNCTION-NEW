import React, { useEffect, useState } from 'react';
import { lbToKg, roundLb } from '../lib/units';

export interface WeightInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Stored weight in kg (or null/undefined when empty) */
  kg: number | null | undefined;
  /** Called with the converted kg value (or null when cleared and allowEmpty is true) */
  onChangeKg: (kg: number | null) => void;
  /** When true, clearing the input calls onChangeKg(null) instead of onChangeKg(0) */
  allowEmpty?: boolean;
}

const formatFromKg = (kg: number | null | undefined): string =>
  kg == null ? '' : String(roundLb(kg));

/**
 * Weight input that displays lb while storing kg.
 * Keeps typed text in local state while focused so typing "100" or "102.5"
 * never jumps or gets re-rounded mid-keystroke; re-derives from kg only when not focused.
 */
export const WeightInput: React.FC<WeightInputProps> = ({
  kg,
  onChangeKg,
  allowEmpty = false,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [draft, setDraft] = useState<string>(() => formatFromKg(kg));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(formatFromKg(kg));
    }
  }, [kg, focused]);

  return (
    <input
      type="number"
      inputMode="decimal"
      {...rest}
      value={focused ? draft : formatFromKg(kg)}
      onFocus={(e) => {
        setDraft(formatFromKg(kg));
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        setDraft(formatFromKg(kg));
        onBlur?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const trimmed = raw.trim();
        if (trimmed === '') {
          onChangeKg(allowEmpty ? null : 0);
          return;
        }
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) {
          onChangeKg(lbToKg(Math.max(0, parsed)));
        }
      }}
    />
  );
};
