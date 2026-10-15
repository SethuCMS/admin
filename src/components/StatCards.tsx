/**
 * Four numbers and a seven-day activity chart, all from the gateway overview.
 */

import type { Overview } from '../api';

const DAY = 86_400_000;

/** Count audit events per day for the last seven days, oldest first. */
function perDay(overview: Overview, now: number = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getTime() - (6 - index) * DAY);
    return {
      key: date.toDateString(),
      label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date).slice(0, 1),
      full: new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date),
      count: 0,
    };
  });
  for (const item of overview.activity) {
    const slot = days.find((day) => day.key === new Date(item.at).toDateString());
    if (slot) {
      slot.count += 1;
    }
  }
  return days;
}

/** The stat row and the activity chart. */
export function StatCards({ overview }: { overview: Overview }) {
  const total = overview.connections.length;
  const healthy = overview.connections.filter((c) => c.health === 'healthy').length;
  const exposed = overview.connections.reduce((sum, c) => sum + c.collections.exposed, 0);
  const found = overview.connections.reduce((sum, c) => sum + c.collections.total, 0);
  const waiting = overview.reviewQueue.length;
  const days = perDay(overview);
  const peak = Math.max(1, ...days.map((day) => day.count));
  const todayIndex = days.length - 1;

  const stats = [
    { label: 'Connections healthy', value: `${healthy}/${total}`, detail: healthy === total ? 'All working' : 'Needs a look' },
    { label: 'Collections in the API', value: String(exposed), detail: `${found} found` },
    { label: 'Waiting for review', value: String(waiting), detail: waiting === 0 ? 'All clear' : 'Open Connections' },
    { label: 'Changes this week', value: String(days.reduce((sum, day) => sum + day.count, 0)), detail: 'From the audit log' },
  ];

  return (
    <section className="stats" aria-label="At a glance">
      <ul className="stat-row">
        {stats.map((stat, index) => (
          <li className={`stat${index === 0 ? ' stat-lead' : ''}`} key={stat.label}>
            <span className="stat-label">{stat.label}</span>
            <span className="stat-line">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-detail">{stat.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <figure className="chart">
        <figcaption>
          <strong>Activity</strong>
          <span className="muted small">Changes recorded in the last 7 days</span>
        </figcaption>
        <ol className="bars">
          {days.map((day, index) => (
            <li className="bar-col" key={day.key}>
              <span
                className={`bar${index === todayIndex ? ' bar-today' : ''}`}
                style={{ height: `${Math.max(day.count === 0 ? 4 : 10, (day.count / peak) * 100)}%` }}
                role="img"
                aria-label={`${day.full}: ${day.count} ${day.count === 1 ? 'change' : 'changes'}`}
              />
              <span className="bar-label" aria-hidden="true">
                {day.label}
              </span>
            </li>
          ))}
        </ol>
      </figure>
    </section>
  );
}
