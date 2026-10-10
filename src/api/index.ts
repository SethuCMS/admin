/**
 * API entry point: picks the real gateway or sample data at build time.
 */

import { configureGateway, gateway } from './gateway';
import { mockApi } from './mock';
import type { AdminApi } from './types';

// Build-time switch: without VITE_API_URL the admin runs on sample data.
const baseUrl = import.meta.env.VITE_API_URL;

/** True while the app shows sample data instead of a real gateway. */
export const usingSampleData = !baseUrl;

// "/" means same origin (admin served by the gateway), so use relative URLs.
if (baseUrl) {
  configureGateway(baseUrl === '/' ? '' : baseUrl);
}

/** The data source the UI uses: the real gateway or in-memory samples. */
export const api: AdminApi = baseUrl
  ? { getOverview: (signal) => gateway.overview(signal) }
  : mockApi;

export * from './gateway';
export type * from './types';
