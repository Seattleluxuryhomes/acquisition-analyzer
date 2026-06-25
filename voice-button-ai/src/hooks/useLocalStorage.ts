import { useCallback, useState } from 'react';
import { storage } from '../lib/storage';

/**
 * useState backed by local-first storage (localStorage / chrome.storage.local).
 * Returns the same [value, setValue] shape as useState and persists on write.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => storage.get<T>(key, initial));

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        storage.set(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, set];
}
