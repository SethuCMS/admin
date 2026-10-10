/**
 * Review queue: newly discovered collections awaiting a decision.
 */

import type { ReviewItem } from '../api';
import { timeAgo } from '../lib/time';

/** Collections discovered but not yet reviewed or exposed. */
export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  return (
    <section aria-labelledby="review-heading" className="section">
      <h2 id="review-heading">Waiting for review</h2>
      <p className="muted section-lede">
        New collections stay out of the API until you review and expose them.
      </p>

      {items.length === 0 ? (
        <p className="empty">
          Nothing is waiting. New collections found in your databases will show
          up here.
        </p>
      ) : (
        <ul className="list">
          {items.map((item) => (
            <li className="list-item" key={item.id}>
              <div>
                <div className="item-title">
                  <code>{item.collection}</code>
                </div>
                <div className="meta-line muted small">
                  <span>{item.connectionName}</span>
                  <span>{item.fieldCount} fields</span>
                  <span>found {timeAgo(item.discoveredAt)}</span>
                </div>
              </div>
              <a
                className="button button-small"
                href={`#/connections/${encodeURIComponent(item.connectionId)}`}
              >
                Review
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
