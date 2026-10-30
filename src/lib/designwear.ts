/**
 * DesignWear's four working views over the `orders` collection. Pure functions:
 * the page loads the records, this decides who sees which orders and what they
 * may do next.
 */

import type { RecordData } from '../api';

export type View = 'owner' | 'vendor' | 'desk' | 'delivery';

export interface Order {
  id: string;
  status: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  pin: string;
  items: string;
  itemCount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  teamId: string;
  teamName: string;
  trackingId: string;
  carrier: string;
  raw: RecordData;
}

export const VIEWS: Array<{ id: View; label: string; about: string }> = [
  { id: 'owner', label: 'DesignWear', about: 'Every order, vendor and payment.' },
  { id: 'vendor', label: 'Vendor', about: 'A brand or local team: confirm and pack its orders.' },
  { id: 'desk', label: 'Order desk', about: 'New orders: check, assign a vendor, cancel.' },
  { id: 'delivery', label: 'Delivery partner', about: 'Packed orders: ship, deliver, collect cash.' },
];

const text = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

export function toOrder(r: RecordData): Order {
  return {
    id: text(r.id),
    status: text(r.status) || 'placed',
    createdAt: text(r.createdAt),
    customerName: text(r.customerName),
    customerPhone: text(r.customerPhone),
    address: text(r.address),
    city: text(r.city),
    pin: text(r.pin),
    items: text(r.items),
    itemCount: num(r.itemCount),
    total: num(r.total),
    paymentMethod: text(r.paymentMethod),
    paymentStatus: text(r.paymentStatus),
    teamId: text(r.teamId),
    teamName: text(r.teamName),
    trackingId: text(r.trackingId),
    carrier: text(r.carrier),
    raw: r,
  };
}

export const isFinal = (o: Order) => o.status === 'delivered' || o.status === 'cancelled';

/** Cash still to be collected at the door. */
export const cashDue = (o: Order) =>
  o.paymentMethod === 'cod' && o.paymentStatus !== 'paid' && o.status !== 'cancelled' ? o.total : 0;

/** The orders one view works on. `team` narrows the vendor view. */
export function forView(orders: Order[], view: View, team: string): Order[] {
  switch (view) {
    case 'owner':
      return orders;
    case 'vendor':
      return orders.filter(
        (o) => (o.teamId === team || o.teamName === team) && ['placed', 'confirmed', 'packed'].includes(o.status),
      );
    case 'desk':
      return orders.filter((o) => ['awaiting_payment', 'placed'].includes(o.status));
    case 'delivery':
      return orders.filter((o) => ['packed', 'shipped'].includes(o.status));
  }
}

export interface Action {
  label: string;
  /** Fields to change on the order. */
  set: RecordData;
  danger?: boolean;
  /** Needs the partner and tracking inputs filled in first. */
  needsDelivery?: boolean;
}

/** What each view may do to an order in its current status. */
export function actionsFor(view: View, o: Order): Action[] {
  if (isFinal(o)) return [];
  const confirm: Action = { label: 'Confirm', set: { status: 'confirmed' } };
  const cancel: Action = { label: 'Cancel order', set: { status: 'cancelled' }, danger: true };
  switch (view) {
    case 'vendor':
      if (o.status === 'placed') return [confirm];
      if (o.status === 'confirmed') return [{ label: 'Mark packed', set: { status: 'packed' } }];
      return [];
    case 'desk':
      return o.status === 'placed' ? [confirm, cancel] : [cancel];
    case 'delivery':
      if (o.status === 'packed') return [{ label: 'Out for delivery', set: { status: 'shipped' }, needsDelivery: true }];
      return [{ label: 'Delivered', set: { status: 'delivered' } }];
    case 'owner':
      return [cancel];
  }
}

const DAY = 86_400_000;

export interface Summary {
  active: number;
  today: number;
  revenue: number;
  cash: number;
  awaitingPayment: number;
  stuck: number;
  byStatus: Array<{ value: string; count: number }>;
  byTeam: Array<{ value: string; count: number; revenue: number }>;
}

/** Orders sitting in placed/confirmed for over a day: someone is forgetting them. */
export function summarise(orders: Order[], now = Date.now()): Summary {
  const status = new Map<string, number>();
  const team = new Map<string, { count: number; revenue: number }>();
  let revenue = 0;
  let cash = 0;
  let today = 0;
  let stuck = 0;
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  for (const o of orders) {
    status.set(o.status, (status.get(o.status) ?? 0) + 1);
    const t = Date.parse(o.createdAt);
    if (t >= startOfToday) today += 1;
    if (['placed', 'confirmed'].includes(o.status) && now - t > DAY) stuck += 1;
    if (o.status === 'cancelled' || o.status === 'awaiting_payment') continue;
    revenue += o.total;
    cash += cashDue(o);
    const key = o.teamName || 'Not assigned';
    const row = team.get(key) ?? { count: 0, revenue: 0 };
    row.count += 1;
    row.revenue += o.total;
    team.set(key, row);
  }
  return {
    active: orders.filter((o) => !isFinal(o)).length,
    today,
    revenue,
    cash,
    awaitingPayment: status.get('awaiting_payment') ?? 0,
    stuck,
    byStatus: [...status].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    byTeam: [...team].map(([value, v]) => ({ value, ...v })).sort((a, b) => b.revenue - a.revenue),
  };
}
