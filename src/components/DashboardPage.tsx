/**
 * Dashboards: pick a collection and see its numbers. Everything is read through
 * the same permission-checked record API as the content pages, so a person only
 * ever sees what their role may read.
 */

import { useEffect, useMemo, useState } from 'react';

import { gateway, type CollectionDetail, type RecordData } from '../api';
import { buildDashboard } from '../lib/dashboard';
import { useAsync } from '../useAsync';
import '../styles/dashboard.css';

// Records are read a page at a time, up to this many in total.
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const STORAGE_KEY = 'sethucms.dashboard';

function remembered(): { connectionId?: string; collection?: string } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

const money = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function DashboardPage() {
  const saved = useMemo(remembered, []);
  const [connectionId, setConnectionId] = useState(saved.connectionId ?? '');
  const [collection, setCollection] = useState(saved.collection ?? '');

  const connections = useAsync((signal) => gateway.connections(signal), 'dash-connections');

  // Default to the first connection once the list arrives.
  useEffect(() => {
    if (connections.state.status !== 'ready' || connectionId) return;
    const first = connections.state.data[0];
    if (first) setConnectionId(first.id);
  }, [connections.state, connectionId]);

  const collections = useAsync(
    (signal) => (connectionId ? gateway.collections(connectionId, signal) : Promise.resolve([])),
    `dash-collections:${connectionId}`,
  );

  useEffect(() => {
    if (collections.state.status !== 'ready' || collection) return;
    const first = collections.state.data[0];
    if (first) setCollection(first.name);
  }, [collections.state, collection]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ connectionId, collection }));
    } catch {
      /* private mode: the choice just is not remembered */
    }
  }, [connectionId, collection]);

  const data = useAsync(async (signal) => {
    if (!connectionId || !collection) return null;
    const detail: CollectionDetail = await gateway.collection(connectionId, collection, signal);
    const records: RecordData[] = [];
    let cursor: string | null = null;
    let more = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await gateway.records(connectionId, collection, { limit: PAGE_SIZE, cursor }, signal);
      records.push(...result.data);
      cursor = result.page.nextCursor;
      if (!cursor) break;
      more = page === MAX_PAGES - 1;
    }
    return { detail, records, truncated: more };
  }, `dash-data:${connectionId}:${collection}`);

  const dashboard = useMemo(
    () => (data.state.status === 'ready' && data.state.data
      ? buildDashboard(data.state.data.records, data.state.data.detail.fields)
      : null),
    [data.state],
  );

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Dashboards</h1>
        <button className="button" type="button" onClick={data.reload}>Refresh</button>
      </header>

      <div className="dash-pickers">
        <label>
          Connection
          <select
            value={connectionId}
            onChange={(e) => { setConnectionId(e.target.value); setCollection(''); }}
          >
            {connections.state.status === 'ready' &&
              connections.state.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          Collection
          <select value={collection} onChange={(e) => setCollection(e.target.value)}>
            {collections.state.status === 'ready' &&
              collections.state.data.map((c) => (
                <option key={c.name} value={c.name}>{c.displayName || c.name}</option>
              ))}
          </select>
        </label>
      </div>

      {data.state.status === 'loading' ? <p className="muted" aria-busy="true">Loading…</p> : null}
      {data.state.status === 'error' ? <p className="muted">{data.state.message}</p> : null}

      {dashboard && data.state.status === 'ready' && data.state.data ? (
        <>
          {data.state.data.truncated ? (
            <p className="notice" role="note">
              Showing the first {dashboard.total.toLocaleString()} records. Totals cover only these.
            </p>
          ) : null}

          <div className="dash-stats">
            <div className="dash-stat"><b>{dashboard.total.toLocaleString()}</b><span>records</span></div>
            {dashboard.timeline ? (
              <div className="dash-stat"><b>{dashboard.timeline.today}</b><span>new today ({dashboard.timeline.field})</span></div>
            ) : null}
            {dashboard.numbers.slice(0, 4).map((n) => (
              <div className="dash-stat" key={n.field}>
                <b>{money.format(n.sum)}</b>
                <span>total {n.field} · average {money.format(n.average)}</span>
              </div>
            ))}
          </div>

          <div className="dash-grid">
            {dashboard.timeline ? (
              <section className="dash-card">
                <h2>Last 14 days · {dashboard.timeline.field}</h2>
                <Days days={dashboard.timeline.days} />
              </section>
            ) : null}
            {dashboard.breakdowns.map((b) => (
              <section className="dash-card" key={b.field}>
                <h2>By {b.field}</h2>
                {b.rows.map((row) => (
                  <div className="dash-bar" key={row.value}>
                    <span className="label" title={row.value}>{row.value}</span>
                    <span className="track">
                      <span className="fill" style={{ width: `${(row.count / b.rows[0]!.count) * 100}%`, display: 'block' }} />
                    </span>
                    <span>{row.count}</span>
                  </div>
                ))}
              </section>
            ))}
          </div>

          {dashboard.total === 0 ? <p className="muted">This collection has no records yet.</p> : null}
        </>
      ) : null}
    </div>
  );
}

function Days({ days }: { days: Array<{ day: string; count: number }> }) {
  const peak = Math.max(1, ...days.map((d) => d.count));
  const label = (d: string) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(new Date(d));
  return (
    <>
      <div className="dash-days" role="img" aria-label="Records per day for the last 14 days">
        {days.map((d, i) => (
          <span
            key={d.day}
            className={`col${i === days.length - 1 ? ' today' : ''}`}
            style={{ height: `${(d.count / peak) * 100}%` }}
            title={`${label(d.day)}: ${d.count}`}
          />
        ))}
      </div>
      <div className="dash-days-labels"><span>{label(days[0]!.day)}</span><span>Today</span></div>
    </>
  );
}
