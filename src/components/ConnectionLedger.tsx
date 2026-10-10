/**
 * Home-page list of connections with health and capabilities.
 */

import type { ConnectionHealth, ConnectionSummary } from '../api';
import { timeAgo } from '../lib/time';
import {
  CapabilityHeader,
  CapabilityLegend,
  CapabilityRow,
} from './CapabilityGrid';

// Plain wording for each health state.
const HEALTH_LABEL: Record<ConnectionHealth, string> = {
  healthy: 'Healthy',
  degraded: 'Slow',
  error: 'Not working',
  pending: 'Not checked yet',
};

/** Coloured dot plus text, so state is not conveyed by colour alone. */
function HealthBadge({ connection }: { connection: ConnectionSummary }) {
  return (
    <span className={`health health-${connection.health}`}>
      <span className="health-dot" aria-hidden="true" />
      {HEALTH_LABEL[connection.health]}
    </span>
  );
}

/** Home-page table of connections with health and capabilities. */
export function ConnectionLedger({
  connections,
}: {
  connections: ConnectionSummary[];
}) {
  return (
    <section aria-labelledby="connections-heading" className="section">
      <h2 id="connections-heading">Connections</h2>
      <p className="muted section-lede">
        What each database can do. Queries it cannot run are refused, never
        quietly changed.
      </p>

      <div
        className="ledger"
        role="group"
        aria-label="Connections and what they support"
      >
        <div className="ledger-head">
          <span>Connection</span>
          <CapabilityHeader />
          <span className="num">Collections</span>
          <span className="num">Checked</span>
        </div>

        {connections.map((connection, rowIndex) => (
          <article className="ledger-row" key={connection.id}>
            <div className="ledger-name">
              <a
                href={`#/connections/${encodeURIComponent(connection.id)}`}
                className="ledger-link"
              >
                {connection.name}
              </a>
              <div className="ledger-meta">
                <span>{connection.adapterLabel}</span>
                <span className={`mode mode-${connection.mode}`}>
                  {connection.mode === 'read_only'
                    ? 'Read-only'
                    : 'Read and write'}
                </span>
              </div>
              <HealthBadge connection={connection} />
              {connection.healthNote ? (
                <p className="health-note">{connection.healthNote}</p>
              ) : null}
            </div>

            <CapabilityRow connection={connection} rowIndex={rowIndex} />

            <div className="num ledger-collections">
              <strong>{connection.collections.exposed}</strong> of{' '}
              {connection.collections.total}
              <span className="sub">in the API</span>
            </div>
            <div className="num ledger-checked">
              {timeAgo(connection.lastCheckedAt)}
            </div>
          </article>
        ))}
      </div>

      <CapabilityLegend />
    </section>
  );
}
