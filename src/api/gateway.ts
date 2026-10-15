/**
 * Everything the admin says to the gateway, in one place.
 *
 * The API token lives in memory (and in sessionStorage so a page reload does
 * not sign you out). It is sent in the Authorization header and never put in a
 * URL. Error answers from the gateway are turned into `GatewayError`, whose
 * message is always safe to show to a person.
 */

// ---- Types ---------------------------------------------------------------

/** Permission level; the gateway enforces it, the UI only hides actions. */
export type Role = 'admin' | 'editor' | 'viewer';

/** The signed-in person. */
export interface Me {
  id: string;
  name: string;
  role: Role;
}

/** One field of a collection, including what this person may see or edit. */
export interface FieldInfo {
  name: string;
  type:
    | 'string'
    | 'text'
    | 'integer'
    | 'decimal'
    | 'boolean'
    | 'datetime'
    | 'date'
    | 'json'
    | 'array'
    | 'reference'
    | 'binary'
    | 'geopoint';
  required?: boolean;
  primaryKey?: boolean;
  generated?: boolean;
  readOnly?: boolean;
  references?: string;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: Array<string | number>;
  };
  /** The value is hidden from this person (shown as asterisks). */
  masked: boolean;
  /** This person may change the field. */
  editable: boolean;
}

/** A collection with its fields and what this person may do. */
export interface CollectionDetail {
  name: string;
  fields: FieldInfo[];
  access: { create: boolean; update: boolean; delete: boolean };
  mode: 'read_only' | 'read_write';
}

/** A collection as listed, without per-person access. */
export interface CollectionSummary {
  name: string;
  displayName: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    primaryKey: boolean;
  }>;
}

/** A connection as listed for content editors. */
export interface ConnectionListItem {
  id: string;
  name: string;
  adapterType: string;
  mode: 'read_only' | 'read_write';
  status: string;
}

// ---- Migration -----------------------------------------------------------

/** What to move and how to handle conflicts. */
export interface MigrationOptions {
  source: string;
  target: string;
  onConflict?: 'skip' | 'overwrite' | 'fail';
  preserveIds?: boolean;
  createMissing?: boolean;
  dropUnmappedFields?: boolean;
  collections?: Array<
    string | { from: string; to?: string; fields?: Record<string, string> }
  >;
}

/** Dry-run result for one collection. */
export interface MigrationCollectionPlan {
  from: string;
  to: string;
  idsPreserved: boolean;
  /** The target collection does not exist and will be created. */
  create: boolean;
  leftBehind: string[];
  problems: string[];
  warnings: string[];
  sourceRecords: { count: number; exact: boolean } | null;
  targetRecords: { count: number; exact: boolean } | null;
}

/** Dry-run result; `ready` is false when blocking problems exist. */
export interface MigrationPlan {
  source: { id: string; name: string; adapter: string };
  target: { id: string; name: string; adapter: string };
  collections: MigrationCollectionPlan[];
  problems: string[];
  warnings: string[];
  ready: boolean;
}

/** Live counters for one collection during a migration. */
export interface MigrationProgress {
  from: string;
  to: string;
  state: 'waiting' | 'running' | 'done' | 'failed' | 'skipped';
  total: number | null;
  read: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  differences: number;
  verified: boolean | null;
  note?: string;
}

/** A migration run and its overall outcome. */
export interface MigrationJob {
  id: string;
  status:
    'running' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';
  source: string;
  target: string;
  startedAt: string;
  finishedAt?: string;
  collections: MigrationProgress[];
  errors: Array<{
    collection: string;
    id: string;
    code: string;
    message: string;
  }>;
  errorsTruncated: boolean;
  message?: string;
}

/** A record's values by field name. */
export type RecordData = Record<string, unknown>;

/** One page of records; use `nextCursor` to continue. */
export interface RecordPage {
  data: RecordData[];
  page: { nextCursor: string | null; limit: number };
  meta?: { capabilityNotes?: string[] };
}

/**
 * An unpublished edit. `version` is for optimistic locking: saves and publishes
 * are rejected if someone else changed the draft meanwhile.
 */
export interface DraftInfo {
  id: string;
  connectionId: string;
  collection: string;
  recordId: string | null;
  values: RecordData;
  version: number;
  status: 'draft' | 'publishing' | 'published' | 'discarded';
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  publishedRecordId?: string;
}

/** A short-lived link to view a draft without signing in. */
export interface PreviewLink {
  token: string;
  path: string;
  expiresAt: string;
}

/** Full admin view of a connection. Secrets are never included. */
export interface ConnectionDetail {
  id: string;
  name: string;
  adapter: string;
  adapterLabel: string;
  mode: 'read_only' | 'read_write';
  config: Record<string, unknown>;
  hasCredentials: boolean;
  health: string;
  healthNote?: string;
  lastCheckedAt: string;
  /** True when this connection lets an admin declare a new, empty collection. */
  canCreateCollections?: boolean;
  capabilities: {
    joins: boolean;
    transactions: string;
    filterOr: boolean;
    inequality: string;
    fullText: boolean;
    realtime: boolean;
    writes: boolean;
  };
  collections: Array<{
    name: string;
    exposed: boolean;
    reviewed: boolean;
    fields: number;
    primaryKey: string | null;
  }>;
}

/** An API token's metadata; the secret is shown only on creation. */
export interface TokenInfo {
  id: string;
  name: string;
  role: Role;
  createdAt: string;
  revokedAt?: string;
  expiresAt?: string;
}

/** A person who signs in with an authenticator app. */
export interface PersonInfo {
  id: string;
  username: string;
  name: string;
  role: Role;
  /** False until their first correct code. */
  enabled: boolean;
  createdAt: string;
}

/** What the gateway returns when a person is added or reset: shown once. */
export interface PersonSetup extends PersonInfo {
  /** The setup key to type into the authenticator app. */
  secret: string;
  /** The same key as a link; opens the authenticator app on a phone. */
  otpauthUri: string;
}

/** One audit-log entry. */
export interface AuditItem {
  id: string;
  at: string;
  actor: string;
  operation: string;
  target: string;
  detail?: unknown;
}

/** Live changes pushed over the event stream. */
export type GatewayEvent =
  | {
      type: 'record.created' | 'record.updated' | 'record.deleted';
      connectionId: string;
      collection: string;
      recordId: string;
    }
  | {
      type:
        | 'draft.created'
        | 'draft.updated'
        | 'draft.discarded'
        | 'draft.published';
      connectionId: string;
      collection: string;
      draftId: string;
      recordId: string | null;
      version: number;
    }
  | { type: 'connection.changed'; connectionId: string };

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

let baseUrl = '';
let token: string | null = null;
let onSignedOut: (() => void) | null = null;

/**
 * Set the gateway address and restore any saved token. Must run before the
 * first request.
 */
export function configureGateway(url: string): void {
  baseUrl = url.replace(/\/$/, '');
  try {
    token = window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    token = null; // storage can be blocked; the person just signs in again
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
async function request<T>(
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

const enc = encodeURIComponent;
// Unique key per call so a retried create or publish cannot apply twice.
const idempotency = (): Record<string, string> => ({
  'Idempotency-Key': crypto.randomUUID(),
});
const collectionPath = (connectionId: string, collection: string): string =>
  `/v1/connections/${enc(connectionId)}/collections/${enc(collection)}`;

/**
 * All gateway endpoints, grouped by area. Methods resolve to unwrapped data or
 * throw GatewayError.
 */
export const gateway = {
  me: (signal?: AbortSignal) =>
    request<{ data: Me }>('GET', '/v1/me', { signal }).then((r) => r.data),

  /**
   * Is single sign-on switched on at the gateway? Never throws: the token form
   * still works without it.
   */
  ssoConfig: (signal?: AbortSignal): Promise<{ enabled: boolean }> =>
    request<{ oidc?: { enabled?: boolean } }>('GET', '/v1/auth/config', {
      signal,
    }).then(
      (r) => ({ enabled: r.oidc?.enabled === true }),
      () => ({ enabled: false }),
    ),
  /**
   * Which social sign-in methods does the gateway offer? Never throws: the
   * other sign-in forms still work.
   */
  socialConfig: (signal?: AbortSignal): Promise<SocialConfig> =>
    request<{
      oidc?: { enabled?: boolean; provider?: string };
      github?: { enabled?: boolean };
      firebase?: {
        enabled?: boolean;
        apiKey?: string;
        authDomain?: string;
        projectId?: string;
        providers?: string[];
      };
    }>('GET', '/v1/auth/config', { signal }).then(
      (r) => ({
        sso: r.oidc?.enabled === true,
        google: r.oidc?.enabled === true && r.oidc.provider === 'google',
        github: r.github?.enabled === true,
        ...(r.firebase?.enabled &&
        r.firebase.apiKey &&
        r.firebase.authDomain &&
        r.firebase.projectId
          ? {
              firebase: {
                apiKey: r.firebase.apiKey,
                authDomain: r.firebase.authDomain,
                projectId: r.firebase.projectId,
                providers: r.firebase.providers ?? [],
              },
            }
          : {}),
      }),
      () => ({ sso: false, google: false, github: false }),
    ),
  /** Trade a Firebase ID token for a SethuCMS session. */
  firebaseLogin: (idToken: string) =>
    request<{ data: { token: string; expiresAt: string } }>(
      'POST',
      '/v1/auth/firebase',
      { body: { idToken } },
    ).then((r) => r.data),
  /**
   * Does the gateway have people set up for authenticator-app sign-in? Never
   * throws: the API-token form still works.
   */
  totpConfig: (signal?: AbortSignal): Promise<{ enabled: boolean }> =>
    request<{ totp?: { enabled?: boolean } }>('GET', '/v1/auth/config', {
      signal,
    }).then(
      (r) => ({ enabled: r.totp?.enabled === true }),
      () => ({ enabled: false }),
    ),
  /** Sign in with a username and the 6-digit code from the authenticator app. */
  totpLogin: (username: string, code: string) =>
    request<{ data: { token: string; expiresAt: string } }>(
      'POST',
      '/v1/auth/totp/login',
      { body: { username, code } },
    ).then((r) => r.data),
  /**
   * Ends a single sign-on session on the gateway. Best effort: signing out here
   * always works.
   */
  logout: (): Promise<void> =>
    request<void>('POST', '/v1/auth/logout').then(
      () => undefined,
      () => undefined,
    ),

  // Content
  connections: (signal?: AbortSignal) =>
    request<{ data: ConnectionListItem[] }>('GET', '/v1/connections', {
      signal,
    }).then((r) => r.data),
  collections: (connectionId: string, signal?: AbortSignal) =>
    request<{ data: CollectionSummary[] }>(
      'GET',
      `/v1/connections/${enc(connectionId)}/collections`,
      { signal },
    ).then((r) => r.data),
  collection: (
    connectionId: string,
    collection: string,
    signal?: AbortSignal,
  ) =>
    request<{ data: CollectionDetail }>(
      'GET',
      collectionPath(connectionId, collection),
      { signal },
    ).then((r) => r.data),

  records: (
    connectionId: string,
    collection: string,
    query: {
      sort?: string;
      limit?: number;
      cursor?: string | null;
      filter?: unknown;
    },
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams();
    if (query.sort) {
      params.set('sort', query.sort);
    }
    if (query.limit) {
      params.set('limit', String(query.limit));
    }
    if (query.cursor) {
      params.set('cursor', query.cursor);
    }
    if (query.filter) {
      params.set('filter', JSON.stringify(query.filter));
    }
    // Only send filters that are set to keep URLs short.
    const suffix = params.size > 0 ? `?${params}` : '';
    return request<RecordPage>(
      'GET',
      `${collectionPath(connectionId, collection)}/records${suffix}`,
      { signal },
    );
  },
  record: (
    connectionId: string,
    collection: string,
    id: string,
    signal?: AbortSignal,
  ) =>
    request<{ data: RecordData }>(
      'GET',
      `${collectionPath(connectionId, collection)}/records/${enc(id)}`,
      { signal },
    ).then((r) => r.data),
  deleteRecord: (connectionId: string, collection: string, id: string) =>
    request<void>(
      'DELETE',
      `${collectionPath(connectionId, collection)}/records/${enc(id)}`,
      { headers: idempotency() },
    ),

  // Drafts
  drafts: (connectionId: string, collection: string, signal?: AbortSignal) =>
    request<{ data: DraftInfo[] }>(
      'GET',
      `${collectionPath(connectionId, collection)}/drafts`,
      { signal },
    ).then((r) => r.data),
  createDraft: (
    connectionId: string,
    collection: string,
    body: { recordId?: string | null; values: RecordData },
  ) =>
    request<{ data: DraftInfo }>(
      'POST',
      `${collectionPath(connectionId, collection)}/drafts`,
      { body, headers: idempotency() },
    ).then((r) => r.data),
  saveDraft: (
    connectionId: string,
    collection: string,
    draftId: string,
    body: { version: number; values: RecordData },
  ) =>
    request<{ data: DraftInfo }>(
      'PATCH',
      `${collectionPath(connectionId, collection)}/drafts/${enc(draftId)}`,
      { body },
    ).then((r) => r.data),
  discardDraft: (connectionId: string, collection: string, draftId: string) =>
    request<void>(
      'DELETE',
      `${collectionPath(connectionId, collection)}/drafts/${enc(draftId)}`,
    ),
  publishDraft: (
    connectionId: string,
    collection: string,
    draftId: string,
    body: { version: number; force?: boolean },
  ) =>
    request<{ data: { draft: DraftInfo; record: RecordData } }>(
      'POST',
      `${collectionPath(connectionId, collection)}/drafts/${enc(draftId)}/publish`,
      { body, headers: idempotency() },
    ).then((r) => r.data),
  previewLink: (connectionId: string, collection: string, draftId: string) =>
    request<{ data: PreviewLink }>(
      'POST',
      `${collectionPath(connectionId, collection)}/drafts/${enc(draftId)}/preview-link`,
    ).then((r) => r.data),

  // Administration
  overview: (signal?: AbortSignal) =>
    request<import('./types').Overview>('GET', '/v1/admin/overview', {
      signal,
    }),
  adapters: () =>
    request<{ data: Array<{ id: string; label: string }> }>(
      'GET',
      '/v1/admin/adapters',
    ).then((r) => r.data),
  connection: (id: string, signal?: AbortSignal) =>
    request<{ data: ConnectionDetail }>(
      'GET',
      `/v1/admin/connections/${enc(id)}`,
      { signal },
    ).then((r) => r.data),
  createConnection: (body: unknown) =>
    request<{ data: ConnectionDetail }>('POST', '/v1/admin/connections', {
      body,
      headers: idempotency(),
    }).then((r) => r.data),
  updateConnection: (id: string, body: unknown) =>
    request<{ data: ConnectionDetail }>(
      'PATCH',
      `/v1/admin/connections/${enc(id)}`,
      { body },
    ).then((r) => r.data),
  deleteConnection: (id: string) =>
    request<void>('DELETE', `/v1/admin/connections/${enc(id)}`),
  testConnection: (id: string) =>
    request<{ data: { ok: boolean; message: string; collections?: number } }>(
      'POST',
      `/v1/admin/connections/${enc(id)}/test`,
    ).then((r) => r.data),
  refreshConnection: (id: string) =>
    request<{ data: ConnectionDetail }>(
      'POST',
      `/v1/admin/connections/${enc(id)}/refresh`,
    ).then((r) => r.data),
  setExposed: (id: string, collection: string, exposed: boolean) =>
    request<{ data: ConnectionDetail }>(
      'PUT',
      `/v1/admin/connections/${enc(id)}/collections/${enc(collection)}`,
      { body: { exposed } },
    ).then((r) => r.data),
  /** Declare a new, empty collection (Firestore). It is switched on unless `expose` is false. */
  createCollection: (
    id: string,
    body: {
      name: string;
      fields?: Array<{ name: string; type: string; required?: boolean }>;
      expose?: boolean;
    },
  ) =>
    request<{ data: ConnectionDetail }>(
      'POST',
      `/v1/admin/connections/${enc(id)}/collections`,
      { body, headers: idempotency() },
    ).then((r) => r.data),

  tokens: () =>
    request<{ data: TokenInfo[] }>('GET', '/v1/admin/tokens').then(
      (r) => r.data,
    ),
  createToken: (body: { name: string; role: Role; expiresInDays?: number }) =>
    request<{ data: { id: string; token: string; expiresAt?: string } }>(
      'POST',
      '/v1/admin/tokens',
      { body },
    ).then((r) => r.data),
  rotateToken: (id: string, graceMinutes: number) =>
    request<{ data: { id: string; token: string; expiresAt?: string } }>(
      'POST',
      `/v1/admin/tokens/${enc(id)}/rotate`,
      { body: { graceMinutes } },
    ).then((r) => r.data),
  revokeToken: (id: string) =>
    request<void>('DELETE', `/v1/admin/tokens/${enc(id)}`),
  people: () =>
    request<{ data: PersonInfo[] }>('GET', '/v1/admin/people').then(
      (r) => r.data,
    ),
  createPerson: (body: { username: string; name?: string; role: Role }) =>
    request<{ data: PersonSetup }>('POST', '/v1/admin/people', { body }).then(
      (r) => r.data,
    ),
  resetPerson: (id: string) =>
    request<{ data: PersonSetup }>(
      'POST',
      `/v1/admin/people/${enc(id)}/reset`,
    ).then((r) => r.data),
  setPersonRole: (id: string, role: Role) =>
    request<unknown>('PATCH', `/v1/admin/people/${enc(id)}`, {
      body: { role },
    }),
  removePerson: (id: string) =>
    request<void>('DELETE', `/v1/admin/people/${enc(id)}`),
  audit: (limit = 100, signal?: AbortSignal) =>
    request<{ data: AuditItem[] }>('GET', `/v1/admin/audit?limit=${limit}`, {
      signal,
    }).then((r) => r.data),

  planMigration: (body: MigrationOptions) =>
    request<{ data: MigrationPlan }>('POST', '/v1/admin/migrations/plan', {
      body,
    }).then((r) => r.data),
  startMigration: (body: MigrationOptions) =>
    request<{ data: MigrationJob }>('POST', '/v1/admin/migrations', {
      body,
      headers: idempotency(),
    }).then((r) => r.data),
  migration: (id: string, signal?: AbortSignal) =>
    request<{ data: MigrationJob }>('GET', `/v1/admin/migrations/${enc(id)}`, {
      signal,
    }).then((r) => r.data),
  migrations: (signal?: AbortSignal) =>
    request<{ data: MigrationJob[] }>('GET', '/v1/admin/migrations', {
      signal,
    }).then((r) => r.data),
  cancelMigration: (id: string) =>
    request<{ data: MigrationJob }>(
      'POST',
      `/v1/admin/migrations/${enc(id)}/cancel`,
    ).then((r) => r.data),

  /**
   * Open the live event stream. Uses fetch (not EventSource) because the token
   * must go in a header. Resolves when the stream closes; callers reconnect.
   */
  async streamEvents(
    onEvent: (event: GatewayEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await fetch(`${baseUrl}/v1/events`, {
      headers: {
        // Header auth is why EventSource is not used (it cannot set headers).
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      signal,
    });
    if (!response.ok || !response.body) {
      throw new GatewayError(
        'Live updates are not available.',
        response.status,
        'STREAM',
      );
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        // Events are separated by a blank line; only the data line matters.
        const data = /^data: (.*)$/m.exec(chunk)?.[1];
        if (!data) {
          continue;
        }
        try {
          const parsed = JSON.parse(data) as GatewayEvent;
          if (
            typeof parsed.type === 'string' &&
            // Skip the initial "ready" handshake; it is not a change.
            parsed.type !== ('ready' as string)
          ) {
            onEvent(parsed);
          }
        } catch {
          // Ignore a malformed event.
        }
      }
    }
  },
};

/** The social sign-in methods a gateway offers (from /v1/auth/config). */
export interface SocialConfig {
  /** Some OpenID Connect provider is set up. */
  sso: boolean;
  /** That provider is Google. */
  google: boolean;
  /** Direct GitHub sign-in is set up. */
  github: boolean;
  /** Firebase Authentication is set up; public web settings for the popup. */
  firebase?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    providers: string[];
  };
}
