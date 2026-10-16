/**
 * The gateway client's plumbing: who is signed in, which gateway and workspace
 * to talk to, and one `request` function that turns every error answer into a
 * `GatewayError`. The endpoints themselves are in gateway.ts.
 *
 * The API token lives in memory (and in sessionStorage so a page reload does
 * not sign you out). It is sent in the Authorization header and never put in a
 * URL.
 */
import type { Role } from './wire';

// ---- Errors --------------------------------------------------------------

/**
 * Error from the gateway. `message` is safe to show to people; `code` is for
 * logic.
 */
export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

// ---- Client --------------------------------------------------------------

// sessionStorage (not localStorage): survives reloads but ends with the tab.
const TOKEN_KEY = 'sethucms.token';

export let baseUrl = '';
/** The gateway's own address, without any /w/<workspace> part. */
let rootUrl = '';
let workspace: string | null = null;
export let token: string | null = null;
const WORKSPACE_KEY = 'sethucms.workspace';
export const WORKSPACE_ID = /^w[0-9a-f]{40}$/;

/**
 * Work inside a workspace (every person who signs in gets one) or, with null,
 * on the gateway's main workspace. Remembered for page reloads in this tab.
 */
export function enterWorkspace(id: string | null): void {
  workspace = id !== null && WORKSPACE_ID.test(id) ? id : null;
  baseUrl = workspace ? `${rootUrl}/w/${workspace}` : rootUrl;
  try {
    if (workspace) {
      window.sessionStorage.setItem(WORKSPACE_KEY, workspace);
    } else {
      window.sessionStorage.removeItem(WORKSPACE_KEY);
    }
  } catch {
    // Not fatal.
  }
}

/** The workspace id in use, or null on the main workspace. */
export const currentWorkspace = (): string | null => workspace;

/**
 * A workspace an invitation link points to (?workspace=<id>), kept until the
 * person has signed in.
 */
let joining: string | null = null;
export const joiningWorkspace = (): string | null => joining;

/** Link to give an invited person: opens this panel for that workspace. */
export const inviteLink = (): string | null =>
  workspace
    ? `${window.location.origin}${window.location.pathname}?workspace=${workspace}`
    : null;
export let onSignedOut: (() => void) | null = null;

/**
 * Set the gateway address and restore any saved token. Must run before the
 * first request.
 */
export function configureGateway(url: string): void {
  rootUrl = url.replace(/\/$/, '');
  baseUrl = rootUrl;
  try {
    token = window.sessionStorage.getItem(TOKEN_KEY);
    const saved = token ? window.sessionStorage.getItem(WORKSPACE_KEY) : null;
    if (saved) {
      enterWorkspace(saved);
    }
  } catch {
    token = null; // storage can be blocked; the person just signs in again
  }
  // An invitation link: ?workspace=<id>
  try {
    const wanted = new URLSearchParams(window.location.search).get('workspace');
    joining = wanted && WORKSPACE_ID.test(wanted) ? wanted : null;
  } catch {
    joining = null;
  }
  // Run after restoring so a fresh SSO token replaces a stale one.
  takeSsoResult();
}

/**
 * Why the last single sign-on attempt failed, for the sign-in page to show. Set
 * at most once per page load.
 */
export let ssoError: 'denied' | 'failed' | 'expired' | null = null;

/**
 * After single sign-on the gateway sends the browser back with the result in
 * the URL fragment (#sso_token=... or #sso_error=...). Fragments are never sent
 * to a server. Take the result and clear the address bar straight away so the
 * token is not left in history or on screen.
 */
function takeSsoResult(): void {
  if (typeof window === 'undefined' || !window.location.hash.includes('sso_')) {
    return;
  }
  const params = new URLSearchParams(window.location.hash.slice(1));
  const sessionToken = params.get('sso_token');
  const error = params.get('sso_error');
  if (sessionToken) {
    setToken(sessionToken);
  } else if (error === 'denied' || error === 'failed' || error === 'expired') {
    ssoError = error;
  }
  try {
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    );
  } catch {
    // Not fatal.
  }
}

/** Remember the token for requests and reloads; null signs out. */
export function setToken(value: string | null): void {
  token = value;
  if (value === null) {
    // Signed out: back to the front door, where sign-in picks the workspace.
    enterWorkspace(null);
  }
  try {
    if (value) {
      window.sessionStorage.setItem(TOKEN_KEY, value);
    } else {
      window.sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Not fatal.
  }
}

/** True when a token is held (it may still be rejected). */
export const hasToken = (): boolean => token !== null;
/** Register what to do when the gateway rejects the token (401). */
export const onSessionEnded = (callback: (() => void) | null): void => {
  onSignedOut = callback;
};
/** Full URL for a gateway path, e.g. for links shown to people. */
export const absoluteUrl = (path: string): string =>
  new URL(baseUrl + path, window.location.href).toString();

/** Optional request parts. */
interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal | undefined;
  headers?: Record<string, string>;
}

/**
 * Single choke point for gateway calls: adds auth, converts every failure to
 * GatewayError and signs out on 401.
 */
export async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    const init: RequestInit = { method, headers };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }
    if (options.signal) {
      init.signal = options.signal;
    }
    response = await fetch(baseUrl + path, init);
  } catch (error) {
    // Let cancellation through unchanged so callers can tell it from a real
    // network failure.
    if (options.signal?.aborted) {
      throw error;
    }
    throw new GatewayError(
      'The gateway could not be reached. Check that it is running and try again.',
      0,
      'NETWORK',
    );
  }

  // No content (deletes): nothing to parse.
  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON error bodies (proxies, crashes) fall back to a generic message
    // below.
    payload = undefined;
  }

  if (!response.ok) {
    const error = (
      payload as
        | { error?: { code?: string; message?: string; details?: unknown } }
        | undefined
    )?.error;
    // Only react if we had a token; a 401 while signing in is just a bad token.
    if (response.status === 401 && token) {
      setToken(null);
      onSignedOut?.();
    }
    throw new GatewayError(
      error?.message ?? `The gateway answered with status ${response.status}.`,
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.details,
    );
  }
  return payload as T;
}

export const enc = encodeURIComponent;
// Unique key per call so a retried create or publish cannot apply twice.
export const idempotency = (): Record<string, string> => ({
  'Idempotency-Key': crypto.randomUUID(),
});
export const collectionPath = (connectionId: string, collection: string): string =>
  `/v1/connections/${enc(connectionId)}/collections/${enc(collection)}`;

