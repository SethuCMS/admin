/**
 * Everything the admin says to the gateway, in one place.
 *
 * The API token lives in memory (and in sessionStorage so a page reload does
 * not sign you out). It is sent in the Authorization header and never put in a
 * URL. Error answers from the gateway are turned into `GatewayError`, whose
 * message is always safe to show to a person.
 */

import type {
  CollectionDetail,
  CollectionSummary,
  ConnectionDetail,
  ConnectionListItem,
  DraftInfo,
  GatewayEvent,
  InviteInfo,
  Me,
  MigrationJob,
  MigrationOptions,
  MigrationPlan,
  PersonInfo,
  PersonSetup,
  PreviewLink,
  RecordData,
  RecordPage,
  Role,
  SchemaReport,
  TokenInfo,
  UploadedFile,
  AuditItem,
  FieldInfo,
  SocialConfig,
} from './wire';
import {
  GatewayError,
  WORKSPACE_ID,
  absoluteUrl,
  baseUrl,
  collectionPath,
  enc,
  enterWorkspace,
  idempotency,
  onSignedOut,
  request,
  setToken,
  token,
} from './client';

// The rest of the app imports everything from here.
export type * from './wire';
export {
  GatewayError,
  absoluteUrl,
  configureGateway,
  currentWorkspace,
  enterWorkspace,
  hasToken,
  inviteLink,
  joiningWorkspace,
  onSessionEnded,
  setToken,
  ssoError,
} from './client';

/**
 * All gateway endpoints, grouped by area. Methods resolve to unwrapped data or
 * throw GatewayError.
 */
export const gateway = {
  schema: (signal?: AbortSignal) =>
    request<{ data: SchemaReport }>('GET', '/v1/schema', { signal }).then(
      (r) => r.data,
    ),

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
        workspaces?: boolean;
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
                ...(r.firebase.workspaces ? { workspaces: true } : {}),
              },
            }
          : {}),
      }),
      () => ({ sso: false, google: false, github: false }),
    ),
  /** Trade a Firebase ID token for a SethuCMS session. */
  firebaseLogin: async (
    idToken: string,
    how: { workspace?: string; open?: boolean } = {},
  ): Promise<{ token: string; expiresAt: string; workspace: string | null }> => {
    // Sign-in always starts at the front door.
    enterWorkspace(null);
    if (how.workspace && WORKSPACE_ID.test(how.workspace)) {
      // An invited person joins the workspace that invited them.
      const r = await request<{ data: { token: string; expiresAt: string } }>(
        'POST',
        `/w/${how.workspace}/v1/auth/firebase`,
        { body: { idToken } },
      );
      return { ...r.data, workspace: how.workspace };
    }
    if (how.open) {
      const r = await request<{
        data: { token: string; expiresAt: string; workspace: string | null };
      }>('POST', '/v1/workspaces/signin', { body: { idToken } });
      return r.data;
    }
    const r = await request<{ data: { token: string; expiresAt: string } }>(
      'POST',
      '/v1/auth/firebase',
      { body: { idToken } },
    );
    return { ...r.data, workspace: null };
  },
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
  /** Store an image or PDF in the connected database. The file itself is the request body. */
  uploadFile: async (
    connectionId: string,
    file: File,
    access: 'public' | 'private' = 'public',
    signal?: AbortSignal,
  ): Promise<UploadedFile> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': file.type,
      'X-File-Name': encodeURIComponent(file.name),
      'X-File-Access': access,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/connections/${enc(connectionId)}/files`, {
        method: 'POST',
        headers,
        body: file,
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      throw new GatewayError(
        'The gateway could not be reached. Check that it is running and try again.',
        0,
        'NETWORK',
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    if (!response.ok) {
      const error = (payload as { error?: { code?: string; message?: string } } | undefined)?.error;
      if (response.status === 401 && token) {
        setToken(null);
        onSignedOut?.();
      }
      throw new GatewayError(
        error?.message ?? `The gateway answered with status ${response.status}.`,
        response.status,
        error?.code ?? 'UNKNOWN',
      );
    }
    const data = (payload as { data: Omit<UploadedFile, 'url'> & { path: string } }).data;
    return {
      id: data.id,
      name: data.name,
      contentType: data.contentType,
      size: data.size,
      url: absoluteUrl(data.path),
      access: data.access === 'private' ? 'private' : 'public',
    };
  },
  /**
   * Download a stored file with the signed-in token (for private files, which
   * a plain link cannot open). Only addresses on this gateway are fetched, so
   * the token is never sent anywhere else.
   */
  fetchFile: async (url: string, signal?: AbortSignal): Promise<Blob> => {
    const target = new URL(url, window.location.href);
    const home = new URL(baseUrl || '/', window.location.href);
    if (target.origin !== home.origin || !target.pathname.startsWith('/v1/files/')) {
      throw new GatewayError('That file is not on this gateway.', 0, 'FOREIGN_FILE');
    }
    const response = await fetch(target.toString(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) {
      throw new GatewayError('The file could not be opened.', response.status, 'FILE');
    }
    return response.blob();
  },
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
  invites: () =>
    request<{ data: InviteInfo[] }>('GET', '/v1/admin/invites').then(
      (r) => r.data,
    ),
  createInvite: (body: { email: string; role: Role }) =>
    request<{ data: InviteInfo }>('POST', '/v1/admin/invites', { body }).then(
      (r) => r.data,
    ),
  removeInvite: (id: string) =>
    request<void>('DELETE', `/v1/admin/invites/${enc(id)}`),
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
