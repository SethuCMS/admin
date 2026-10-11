/**
 * API entry point: picks the real gateway or sample data at build time.
 *
 * VITE_API_URL:
 *   unset   sample data (no gateway)
 *   "/"     same address as the page (the gateway serves the admin)
 *   a URL   that gateway
 *   "ask"   hosted admin: each person types the address of their own gateway,
 *           which is remembered in this browser
 */

import { configureGateway, gateway } from './gateway';
import { mockApi } from './mock';
import type { AdminApi } from './types';

const configured = import.meta.env.VITE_API_URL;

// Hosted mode: the address comes from the person, never from the page address
// or a link, so a crafted link cannot point the sign-in at someone else's gateway.
const GATEWAY_KEY = 'sethucms.gateway';

/** True when this build asks each person for their own gateway address. */
export const askForGateway = configured === 'ask';

/** The gateway address saved in this browser, if any. */
export function savedGateway(): string | null {
  try {
    return window.localStorage.getItem(GATEWAY_KEY);
  } catch {
    return null; // storage can be blocked
  }
}

/** Remember a gateway address, then reload so the app starts against it. */
export function saveGateway(url: string): void {
  try {
    window.localStorage.setItem(GATEWAY_KEY, url);
  } catch {
    /* the person is asked again next time */
  }
}

/** Forget the saved address and its session, then reload. */
export function forgetGateway(): void {
  try {
    window.localStorage.removeItem(GATEWAY_KEY);
    window.sessionStorage.clear();
  } catch {
    /* nothing to clear */
  }
  window.location.reload();
}

/**
 * Check and tidy a typed gateway address.
 * @throws Error with a message the person can act on.
 */
export function normalizeGatewayUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Enter a full address, for example https://cms.example.com');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error('Use an https:// address. Plain http is only allowed for localhost.');
  }
  if (url.username || url.password) {
    throw new Error('Leave the username and password out of the address.');
  }
  return url.origin;
}

const baseUrl = askForGateway ? (savedGateway() ?? '') : configured;

/** True while the hosted admin still needs the person's gateway address. */
export const needsGateway = askForGateway && !baseUrl;

/** True while the app shows sample data instead of a real gateway. */
export const usingSampleData = !baseUrl && !askForGateway;

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
