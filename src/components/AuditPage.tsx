/**
 * Audit log page (admin only).
 */

import { gateway } from '../api';
import { describeOperation } from '../lib/sentence';
import { timeAgo } from '../lib/time';
import { useAsync } from '../useAsync';

/**
 * Admin audit log. Actor ids are shown as token names where known.
 */
export function AuditPage() {
  const { state, reload } = useAsync(async (signal) => {
    // Fetched together to resolve actor ids to readable names.
    const [entries, tokens] = await Promise.all([
      gateway.audit(200, signal),
      gateway.tokens(),
    ]);
    return {
      entries,
      // Falls back to the raw actor id for deleted tokens.
      names: new Map(tokens.map((token) => [token.id, token.name])),
    };
  }, 'audit');

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Audit log</h1>
        <button
          className="button button-outline"
          type="button"
          onClick={reload}
        >
          Refresh
        </button>
      </header>
      <p className="muted section-lede">
        Every change to connections, content, tokens and drafts. Passwords and
        tokens are never recorded.
      </p>

      {state.status === 'loading' ? (
        <p className="muted" aria-busy="true">
          Loading…
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === 'ready' ? (
        <ul className="list">
          {state.data.entries.map((entry) => (
            <li className="list-item" key={entry.id}>
              <div>
                <div className="item-title">
                  {state.data.names.get(entry.actor) ?? entry.actor}{' '}
                  {describeOperation(entry.operation)}{' '}
                  <span className="target">{entry.target}</span>
                </div>
                <div className="meta-line muted small">
                  <time
                    dateTime={entry.at}
                    title={new Date(entry.at).toLocaleString()}
                  >
                    {timeAgo(entry.at)}
                  </time>
                  <code>{entry.operation}</code>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
