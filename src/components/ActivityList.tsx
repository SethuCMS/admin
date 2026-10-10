/**
 * Recent activity list for the home page.
 */

import type { ActivityItem } from '../api';
import { describeOperation } from '../lib/sentence';
import { timeAgo } from '../lib/time';

/** Recent audit entries on the home page, newest first. */
export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <section aria-labelledby="activity-heading" className="section">
      <div className="section-head">
        <h2 id="activity-heading">Recent activity</h2>
        <a className="button button-quiet" href="#/audit">
          Open audit log
        </a>
      </div>

      {items.length === 0 ? (
        <p className="empty">
          No activity yet. Changes made through the admin appear here.
        </p>
      ) : (
        <ul className="list">
          {items.map((item) => (
            <li className="list-item" key={item.id}>
              <div>
                <div>
                  <strong>{item.actor}</strong>{' '}
                  {describeOperation(item.operation)}{' '}
                  <span className="target">{item.target}</span>
                </div>
              </div>
              <time className="muted small" dateTime={item.at}>
                {timeAgo(item.at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
