/**
 * The search box lives in the top bar, but what it searches is decided by the
 * collection that is open. This small shared store connects the two: the open
 * collection says what the box is for, and reads what was typed.
 */
import { useSyncExternalStore } from 'react';

interface HeaderSearch {
  /** Placeholder text, or null when there is nothing to search. */
  placeholder: string | null;
  value: string;
}

let state: HeaderSearch = { placeholder: null, value: '' };
const listeners = new Set<() => void>();

export function setHeaderSearch(next: Partial<HeaderSearch>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function useHeaderSearch(): HeaderSearch {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );
}
