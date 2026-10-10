/**
 * Hook that loads the home-page overview through the API layer.
 */

import { useCallback, useEffect, useState } from 'react';
import { api, type Overview } from './api';

/** Loading state of the home-page overview. */
export type OverviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; overview: Overview };

/**
 * Load the workspace overview for the home page and the app shell. Pass a `key`
 * (such as the signed-in user id) to refetch when it changes; call `reload` to
 * refresh after a live event.
 */
export function useOverview(key = 'default'): {
  state: OverviewState;
  reload: () => void;
} {
  const [state, setState] = useState<OverviewState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // Always reset on refetch: a different user must never see the previous
    // user's overview.
    setState({ status: 'loading' });

    api
      .getOverview(controller.signal)
      .then((overview) => setState({ status: 'ready', overview }))
      .catch((error: unknown) => {
        // Aborted fetches are intentional (cleanup), so stay silent.
        if (controller.signal.aborted) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Something went wrong while loading.';
        setState({ status: 'error', message });
      });

    return () => controller.abort();
  }, [attempt, key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, reload };
}
