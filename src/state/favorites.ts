import { useCallback, useMemo } from 'react';
import { usePersistentState } from '../lib/storage';

/** Coach's starred exercises (kept on this device). */
export function useFavorites() {
  const [ids, setIds] = usePersistentState<string[]>('pf.favorites.v1', () => []);
  const set = useMemo(() => new Set(ids), [ids]);
  const toggle = useCallback(
    (id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
    [setIds]
  );
  return { favorites: set, toggle };
}
