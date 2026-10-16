/**
 * Whether the collections sidebar is open. The toggle sits in the top bar and
 * the sidebar is in the content page, so both read this small shared store. The
 * choice is remembered in this browser; if storage is blocked it still works
 * for the visit.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'sethucms.sidebar';

function saved(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'closed';
  } catch {
    return true;
  }
}

let open = saved();
const listeners = new Set<() => void>();

export function toggleSidebar(): void {
  open = !open;
  try {
    window.localStorage.setItem(KEY, open ? 'open' : 'closed');
  } catch {
    // Not fatal: the choice just is not remembered.
  }
  listeners.forEach((listener) => listener());
}

export function useSidebarOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => open,
  );
}
