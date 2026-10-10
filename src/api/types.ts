/**
 * The data the admin home page needs.
 *
 * These shapes mirror what the SethuCMS gateway will return from
 * GET /v1/admin/overview. Capability values follow @sethucms/core.
 */

/**
 * How a connection may be used; `read_only` blocks all writes regardless of
 * adapter support.
 */
export type ConnectionMode = 'read_only' | 'read_write';
export type ConnectionHealth = 'healthy' | 'degraded' | 'error' | 'pending';

/** What a database adapter can do, used to show or hide features. */
export interface CapabilitySummary {
  joins: boolean;
  transactions: 'none' | 'single-document' | 'multi-document';
  filterOr: boolean;
  inequality: 'full' | 'single-field' | 'none';
  fullText: boolean;
  realtime: boolean;
  /**
   * What the adapter can do. Whether writes are actually on also depends on the
   * connection mode.
   */
  writes: boolean;
}

/** One connected database as shown in lists. */
export interface ConnectionSummary {
  id: string;
  name: string;
  /** Adapter id such as "postgres" or "firestore". */
  adapter: string;
  adapterLabel: string;
  mode: ConnectionMode;
  health: ConnectionHealth;
  /** Short explanation when health is not "healthy". */
  healthNote?: string;
  lastCheckedAt: string;
  collections: { exposed: number; total: number };
  capabilities: CapabilitySummary;
}

/** A collection found in a database that nobody has reviewed yet. */
export interface ReviewItem {
  id: string;
  connectionId: string;
  connectionName: string;
  collection: string;
  fieldCount: number;
  discoveredAt: string;
}

/** One audit-log entry in the recent activity feed. */
export interface ActivityItem {
  id: string;
  actor: string;
  /** Audit operation, for example "record.update" or "connection.create". */
  operation: string;
  target: string;
  at: string;
}

/** Everything the home page shows. */
export interface Overview {
  workspaceName: string;
  userName: string;
  connections: ConnectionSummary[];
  reviewQueue: ReviewItem[];
  activity: ActivityItem[];
}

/** Contract implemented by both the gateway client and the mock. */
export interface AdminApi {
  getOverview(signal?: AbortSignal): Promise<Overview>;
}
