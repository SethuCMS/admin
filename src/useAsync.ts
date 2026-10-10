/**
 * Generic data-loading hook used by pages that fetch from the gateway.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The three states a loading screen needs to handle.
 */
export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

/**
 * Load something when `key` changes; reload on demand. Stale answers are
 * dropped.
 */
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  key: string,
): { state: Loaded<T>; reload: () => void } {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Keep the latest loader in a ref so callers can pass an inline function
  // without it re-triggering the effect; only `key` and reloads do.
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    const controller = new AbortController();
    // On a manual reload keep showing the old data instead of flashing a
    // spinner; a new `key` always resets to loading.
    setState((previous) =>
      previous.status === 'ready' && attempt > 0
        ? previous
        : { status: 'loading' },
    );
    loader
      .current(controller.signal)
      .then((data) => {
        // Ignore results from a superseded request so slow, stale responses
        // cannot overwrite newer data.
        if (!controller.signal.aborted) {
          setState({ status: 'ready', data });
        }
      })
      .catch((error: unknown) => {
        // An abort is expected on key change or unmount, not a failure to show.
        if (controller.signal.aborted) {
          return;
        }
        setState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Something went wrong while loading.',
        });
      });
    return () => controller.abort();
  }, [key, attempt]);

  return { state, reload: useCallback(() => setAttempt((n) => n + 1), []) };
}
