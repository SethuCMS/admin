/**
 * DesignWear: the four working views over the `orders` collection (owner,
 * vendor, order desk, delivery partner). Reads and changes go through the same
 * permission-checked record API as the content pages, so a person can only do
 * what their role allows.
 */

import { useEffect, useMemo, useState } from 'react';

import { gateway, type RecordData } from '../api';
import {
  VIEWS,
  actionsFor,
  cashDue,
  forView,
  summarise,
  toOrder,
  type Action,
  type Order,
  type View,
} from '../lib/designwear';
import { useAsync } from '../useAsync';
import '../styles/dashboard.css';
import '../styles/designwear.css';

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const STORAGE_KEY = 'sethucms.designwear';
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function remembered(): { view?: View; team?: string } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Read every page of a collection, up to a limit. Missing collections give []. */
async function readAll(connectionId: string, collection: string, signal: AbortSignal): Promise<RecordData[]> {
  const out: RecordData[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await gateway.records(connectionId, collection, { limit: PAGE_SIZE, cursor, sort: '-createdAt' }, signal);
    out.push(...result.data);
    cursor = result.page.nextCursor;
    if (!cursor) break;
  }
  return out;
}

export function DesignWearPage() {
  const saved = useMemo(remembered, []);
  const [view, setView] = useState<View>(saved.view ?? 'owner');
  const [team, setTeam] = useState(saved.team ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  // The connection that holds the DesignWear `orders` collection.
  const found = useAsync(async (signal) => {
    for (const c of await gateway.connections(signal)) {
      const collections = await gateway.collections(c.id, signal);
      if (collections.some((x) => x.name === 'orders')) {
        return { connectionId: c.id, hasTeams: collections.some((x) => x.name === 'teams') };
      }
    }
    return null;
  }, 'dw-find');

  const connectionId = found.state.status === 'ready' ? found.state.data?.connectionId : undefined;
  const hasTeams = found.state.status === 'ready' && !!found.state.data?.hasTeams;

  const data = useAsync(async (signal) => {
    if (!connectionId) return null;
    const orders = (await readAll(connectionId, 'orders', signal)).map(toOrder);
    const teams = hasTeams
      ? (await readAll(connectionId, 'teams', signal)).map((t) => ({
          id: String(t.id ?? ''),
          name: String(t.name ?? t.title ?? t.id ?? ''),
        }))
      : [];
    return { orders, teams };
  }, `dw-data:${connectionId ?? ''}`);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ view, team }));
    } catch {
      /* private mode: the choice just is not remembered */
    }
  }, [view, team]);

  const orders = data.state.status === 'ready' ? data.state.data?.orders ?? [] : [];
  const teams = data.state.status === 'ready' ? data.state.data?.teams ?? [] : [];
  const teamNames = useMemo(
    () => [...new Set([...teams.map((t) => t.name), ...orders.map((o) => o.teamName)].filter(Boolean))],
    [teams, orders],
  );
  useEffect(() => {
    if (!team && teamNames[0]) setTeam(teamNames[0]);
  }, [team, teamNames]);

  const shown = forView(orders, view, team);
  const summary = useMemo(() => summarise(orders), [orders]);

  /** Change an order: a draft with the new values, published straight away. */
  async function change(order: Order, set: RecordData, label: string) {
    if (!connectionId) return;
    setBusy(order.id);
    setMessage('');
    try {
      const draft = await gateway.createDraft(connectionId, 'orders', {
        recordId: order.id,
        values: { ...order.raw, ...set, updatedAt: new Date().toISOString() },
      });
      await gateway.publishDraft(connectionId, 'orders', draft.id, { version: draft.version });
      setMessage(`${label}: order ${order.id.slice(0, 8)} updated.`);
      data.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not update the order.');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">DesignWear</h1>
        <button className="button" type="button" onClick={data.reload}>Refresh</button>
      </header>

      <div className="dw-tabs" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            className={view === v.id ? 'on' : ''}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="muted">{VIEWS.find((v) => v.id === view)?.about}</p>

      {found.state.status === 'loading' || data.state.status === 'loading' ? (
        <p className="muted" aria-busy="true">Loading…</p>
      ) : null}
      {found.state.status === 'ready' && !connectionId ? (
        <p className="notice" role="note">
          No connection has an <b>orders</b> collection yet. Create it with the fields listed in the
          DesignWear API README, then refresh.
        </p>
      ) : null}
      {data.state.status === 'error' ? <p className="muted">{data.state.message}</p> : null}
      {message ? <p className="notice" role="status">{message}</p> : null}

      {view === 'vendor' ? (
        <div className="dash-pickers">
          <label>
            Vendor / team
            <select value={team} onChange={(e) => setTeam(e.target.value)}>
              {teamNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      ) : null}

      {view === 'owner' && data.state.status === 'ready' ? <Owner summary={summary} /> : null}

      {connectionId && data.state.status === 'ready' ? (
        <section className="dash-card dw-orders">
          <h2>{shown.length} order{shown.length === 1 ? '' : 's'}</h2>
          {shown.length === 0 ? <p className="muted">Nothing here right now.</p> : null}
          {shown.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              view={view}
              teams={teams}
              busy={busy === o.id}
              onChange={(set, label) => change(o, set, label)}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Owner({ summary }: { summary: ReturnType<typeof summarise> }) {
  return (
    <>
      <div className="dash-stats">
        <div className="dash-stat"><b>{summary.active}</b><span>orders in progress</span></div>
        <div className="dash-stat"><b>{summary.today}</b><span>new today</span></div>
        <div className="dash-stat"><b>{money.format(summary.revenue)}</b><span>sales (excl. cancelled)</span></div>
        <div className="dash-stat"><b>{money.format(summary.cash)}</b><span>cash to collect</span></div>
        <div className="dash-stat"><b>{summary.awaitingPayment}</b><span>awaiting payment</span></div>
        <div className={`dash-stat${summary.stuck ? ' warn' : ''}`}><b>{summary.stuck}</b><span>stuck over 24 hours</span></div>
      </div>
      <div className="dash-grid">
        <section className="dash-card">
          <h2>By status</h2>
          {summary.byStatus.map((r) => (
            <Bar key={r.value} label={r.value} count={r.count} peak={summary.byStatus[0]?.count ?? 1} />
          ))}
        </section>
        <section className="dash-card">
          <h2>By vendor</h2>
          {summary.byTeam.map((r) => (
            <Bar key={r.value} label={r.value} count={r.count} peak={summary.byTeam[0]?.count ?? 1} note={money.format(r.revenue)} />
          ))}
        </section>
      </div>
    </>
  );
}

function Bar({ label, count, peak, note }: { label: string; count: number; peak: number; note?: string }) {
  return (
    <div className="dash-bar">
      <span className="label" title={label}>{label}</span>
      <span className="track"><span className="fill" style={{ width: `${(count / peak) * 100}%`, display: 'block' }} /></span>
      <span>{count}{note ? ` · ${note}` : ''}</span>
    </div>
  );
}

interface RowProps {
  order: Order;
  view: View;
  teams: Array<{ id: string; name: string }>;
  busy: boolean;
  onChange: (set: RecordData, label: string) => void;
}

function OrderRow({ order: o, view, teams, busy, onChange }: RowProps) {
  const [carrier, setCarrier] = useState(o.carrier);
  const [tracking, setTracking] = useState(o.trackingId);
  const [assignTo, setAssignTo] = useState('');
  const due = cashDue(o);

  const run = (a: Action) => {
    if (a.needsDelivery && !carrier.trim()) return;
    onChange(a.needsDelivery ? { ...a.set, carrier: carrier.trim(), trackingId: tracking.trim() } : a.set, a.label);
  };

  return (
    <article className="dw-order">
      <header>
        <b>#{o.id.slice(0, 8)}</b>
        <span className={`dw-status s-${o.status}`}>{o.status.replace('_', ' ')}</span>
        <span className="muted">{o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN') : ''}</span>
      </header>
      <p>
        {o.itemCount} item{o.itemCount === 1 ? '' : 's'} · {money.format(o.total)} ·{' '}
        {o.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online'}
        {due ? <b className="dw-cash"> · collect {money.format(due)}</b> : null}
      </p>
      <p className="muted">
        {o.customerName} · {o.customerPhone}
        <br />
        {o.address}, {o.city} {o.pin}
        {o.teamName ? <><br />Vendor: {o.teamName}</> : null}
      </p>

      {view === 'delivery' && o.status === 'packed' ? (
        <div className="dw-inline">
          <input placeholder="Delivery partner" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          <input placeholder="Tracking ID (optional)" value={tracking} onChange={(e) => setTracking(e.target.value)} />
        </div>
      ) : null}

      {view === 'desk' && teams.length > 0 && !['cancelled', 'delivered'].includes(o.status) ? (
        <div className="dw-inline">
          <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Assign a vendor…</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button
            className="button"
            type="button"
            disabled={busy || !assignTo}
            onClick={() => {
              const t = teams.find((x) => x.id === assignTo);
              if (t) onChange({ teamId: t.id, teamName: t.name }, 'Assigned');
            }}
          >
            Assign
          </button>
        </div>
      ) : null}

      <div className="dw-actions">
        {actionsFor(view, o).map((a) => (
          <button
            key={a.label}
            className={a.danger ? 'button danger' : 'button primary'}
            type="button"
            disabled={busy || (a.needsDelivery && !carrier.trim())}
            onClick={() => run(a)}
          >
            {a.label}
          </button>
        ))}
      </div>
    </article>
  );
}
