/**
 * Empty state for a workspace with no connections.
 */

// Keep in sync with the adapters the gateway offers.
const SUPPORTED = [
  'PostgreSQL',
  'MySQL',
  'SQL Server',
  'MongoDB',
  'Firestore',
  'DynamoDB',
];

/** Home-page prompt shown when no connection exists yet. */
export function EmptyState() {
  return (
    <section className="section empty-state" aria-labelledby="empty-heading">
      <h2 id="empty-heading">No databases connected yet</h2>
      <p className="muted">
        Connect the database you already use. Connections start read-only, and
        nothing is exposed until you have reviewed it.
      </p>
      <p>
        <a className="button" href="#/connections">
          Add your first connection
        </a>
      </p>
      <p className="muted small">Available now: {SUPPORTED.join(', ')}.</p>
    </section>
  );
}
