import { useEffect, useState } from 'react';

/** useState that survives a page reload (localStorage). Falls back silently when storage is unavailable. */
export function usePersistentState<T>(key: string, initial: () => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      /* private mode / corrupted value */
    }
    return initial();
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota exceeded / unavailable */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
