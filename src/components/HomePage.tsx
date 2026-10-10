/**
 * Home page.
 */

import { usingSampleData } from '../api';
import type { OverviewState } from '../useOverview';
import { summarize } from '../lib/sentence';
import { ActivityList } from './ActivityList';
import { ConnectionLedger } from './ConnectionLedger';
import { EmptyState } from './EmptyState';
import { ReviewQueue } from './ReviewQueue';

/** Overview state plus a retry callback. */
interface HomePageProps {
  state: OverviewState;
  onRetry: () => void;
}

/**
 * Home page: one-sentence status, connections, review queue and activity.
 */
export function HomePage({ state, onRetry }: HomePageProps) {
  // Each branch below handles one load state before the data exists.
  if (state.status === 'loading') {
    return (
      <div className="page" aria-busy="true">
        <h1 className="headline headline-loading">
          Checking your connections…
        </h1>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="page">
        <h1 className="headline">The home page could not load.</h1>
        <p className="muted">{state.message}</p>
        <p>
          <button className="button" type="button" onClick={onRetry}>
            Try again
          </button>
        </p>
      </div>
    );
  }

  const { overview } = state;
  const { headline } = summarize(overview);
  const hasConnections = overview.connections.length > 0;

  return (
    <div className="page">
      {usingSampleData ? (
        <p className="notice" role="note">
          Showing sample data. Set <code>VITE_API_URL</code> to connect your
          gateway.
        </p>
      ) : null}

      <header className="hero">
        <h1 className="headline">{headline}</h1>
        <div className="hero-actions">
          {overview.reviewQueue.length > 0 ? (
            <a className="button" href="#/content">
              Review collections
            </a>
          ) : null}
          <a
            className={
              overview.reviewQueue.length > 0
                ? 'button button-outline'
                : 'button'
            }
            href="#/connections"
          >
            Add connection
          </a>
        </div>
      </header>

      {hasConnections ? (
        <ConnectionLedger connections={overview.connections} />
      ) : (
        <EmptyState />
      )}

      <div className="two-up">
        <ReviewQueue items={overview.reviewQueue} />
        <ActivityList items={overview.activity} />
      </div>
    </div>
  );
}
