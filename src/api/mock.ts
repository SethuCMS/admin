/**
 * Sample data and a fake API, used when VITE_API_URL is not set.
 */

import type { AdminApi, Overview } from './types';

// Time constants so sample timestamps read as "N minutes ago".
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

/** Sample data so the admin runs before the gateway exists. */
function buildSample(): Overview {
  return {
    workspaceName: 'Acme workspace',
    userName: 'Kasinadh',
    connections: [
      {
        id: 'c_pg_prod',
        name: 'Orders (production)',
        adapter: 'postgres',
        adapterLabel: 'PostgreSQL',
        mode: 'read_only',
        health: 'healthy',
        lastCheckedAt: ago(2 * MINUTE),
        collections: { exposed: 14, total: 17 },
        capabilities: {
          joins: true,
          transactions: 'multi-document',
          filterOr: true,
          inequality: 'full',
          fullText: false,
          realtime: false,
          writes: true,
        },
      },
      {
        id: 'c_fs_store',
        name: 'Storefront content',
        adapter: 'firestore',
        adapterLabel: 'Firestore',
        mode: 'read_write',
        health: 'healthy',
        lastCheckedAt: ago(4 * MINUTE),
        collections: { exposed: 6, total: 8 },
        capabilities: {
          joins: false,
          transactions: 'multi-document',
          filterOr: true,
          inequality: 'single-field',
          fullText: false,
          realtime: true,
          writes: true,
        },
      },
      {
        id: 'c_mongo_logs',
        name: 'Event logs',
        adapter: 'mongodb',
        adapterLabel: 'MongoDB Atlas',
        mode: 'read_only',
        health: 'degraded',
        healthNote: 'Slow responses: 2.8 s average over the last hour',
        lastCheckedAt: ago(9 * MINUTE),
        collections: { exposed: 3, total: 3 },
        capabilities: {
          joins: false,
          transactions: 'multi-document',
          filterOr: true,
          inequality: 'full',
          fullText: true,
          realtime: true,
          writes: true,
        },
      },
      {
        id: 'c_dynamo_sessions',
        name: 'Sessions',
        adapter: 'dynamodb',
        adapterLabel: 'DynamoDB',
        mode: 'read_only',
        health: 'error',
        healthNote: 'Access denied: the IAM role can no longer be assumed',
        lastCheckedAt: ago(26 * MINUTE),
        collections: { exposed: 1, total: 1 },
        capabilities: {
          joins: false,
          transactions: 'multi-document',
          filterOr: false,
          inequality: 'single-field',
          fullText: false,
          realtime: false,
          writes: true,
        },
      },
    ],
    reviewQueue: [
      {
        id: 'r1',
        connectionId: 'c_pg_prod',
        connectionName: 'Orders (production)',
        collection: 'refund_requests',
        fieldCount: 11,
        discoveredAt: ago(3 * HOUR),
      },
      {
        id: 'r2',
        connectionId: 'c_fs_store',
        connectionName: 'Storefront content',
        collection: 'campaign_banners',
        fieldCount: 7,
        discoveredAt: ago(1 * DAY),
      },
      {
        id: 'r3',
        connectionId: 'c_pg_prod',
        connectionName: 'Orders (production)',
        collection: 'customer_notes',
        fieldCount: 6,
        discoveredAt: ago(2 * DAY),
      },
    ],
    activity: [
      {
        id: 'a1',
        actor: 'Meera Nair',
        operation: 'record.update',
        target: 'products / sku-1042',
        at: ago(12 * MINUTE),
      },
      {
        id: 'a2',
        actor: 'Kasinadh Sarma',
        operation: 'permission.change',
        target: 'Editor role on orders',
        at: ago(2 * HOUR),
      },
      {
        id: 'a3',
        actor: 'Ravi Teja',
        operation: 'record.create',
        target: 'campaign_banners / diwali-sale',
        at: ago(5 * HOUR),
      },
      {
        id: 'a4',
        actor: 'Kasinadh Sarma',
        operation: 'connection.create',
        target: 'Sessions',
        at: ago(1 * DAY),
      },
      {
        id: 'a5',
        actor: 'Meera Nair',
        operation: 'record.delete',
        target: 'products / sku-0871',
        at: ago(1 * DAY + 3 * HOUR),
      },
    ],
  };
}

// Fake latency lets the loading state be seen during development.
export const mockApi: AdminApi = {
  async getOverview() {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return buildSample();
  },
};
