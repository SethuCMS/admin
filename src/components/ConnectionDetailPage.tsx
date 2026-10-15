/**
 * Detail page for one connection (admin only).
 */

import { useState, type FormEvent } from 'react';
import { gateway, type ConnectionDetail } from '../api';
import { capabilityCells } from '../lib/capabilities';
import { timeAgo } from '../lib/time';
import { contentHref, navigate } from '../router';
import { useAsync } from '../useAsync';

/**
 * One connection: health, which collections are exposed, capabilities and
 * settings. All actions reload the data afterwards so the page always shows
 * what the gateway holds.
 */
export function ConnectionDetailPage({
  connectionId,
}: {
  connectionId: string;
}) {
  const { state, reload } = useAsync(
    (signal) => gateway.connection(connectionId, signal),
    `connection:${connectionId}`,
  );
  const [notice, setNotice] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);
  // Name of the running action; disables other buttons so actions cannot
  // overlap.
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The "create a collection" form.
  const [newName, setNewName] = useState('');
  const [newFields, setNewFields] = useState('');

  if (state.status === 'loading') {
    return (
      <div className="page" aria-busy="true">
        <p className="muted">Loading connection…</p>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="page">
        <h1 className="page-title">Connection</h1>
        <p className="form-error" role="alert">
          {state.message}
        </p>
        <a className="button button-quiet" href="#/connections">
          Back to connections
        </a>
      </div>
    );
  }
  const connection = state.data;

  // Shared wrapper: tracks busy state and turns failures into a visible
  // message.
  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(label);
    setNotice(null);
    try {
      await work();
    } catch (cause) {
      setNotice({
        kind: 'error',
        text: cause instanceof Error ? cause.message : 'That did not work.',
      });
    } finally {
      setBusy(null);
    }
  };

  // A failed test is reported as a notice, not thrown, because it is an
  // expected outcome.
  const test = () =>
    run('test', async () => {
      const result = await gateway.testConnection(connection.id);
      setNotice({
        kind: result.ok ? 'ok' : 'error',
        text: result.ok
          ? `Connected. Found ${result.collections ?? 0} collections.`
          : result.message,
      });
      reload();
    });
  const refresh = () =>
    run('refresh', async () => {
      await gateway.refreshConnection(connection.id);
      setNotice({ kind: 'ok', text: 'Structure read again.' });
      reload();
    });
  // Toggles between read-only and read/write.
  const changeMode = () =>
    run('mode', async () => {
      const next = connection.mode === 'read_only' ? 'read_write' : 'read_only';
      await gateway.updateConnection(connection.id, { mode: next });
      setNotice({
        kind: 'ok',
        text:
          next === 'read_write'
            ? 'Editors can now change data in this database.'
            : 'This connection is now read-only.',
      });
      reload();
    });
  // Exposing a collection makes it reachable through the API.
  const toggle = (name: string, exposed: boolean) =>
    run(`expose:${name}`, async () => {
      await gateway.setExposed(connection.id, name, exposed);
      reload();
    });
  // Declares a new, empty collection. The database makes it with its first
  // record; only the definition is saved now.
  const create = (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    const fields = parseFields(newFields);
    if (typeof fields === 'string') {
      setNotice({ kind: 'error', text: fields });
      return;
    }
    return run('create', async () => {
      await gateway.createCollection(connection.id, { name, fields });
      setNewName('');
      setNewFields('');
      setNotice({
        kind: 'ok',
        text: `Created ${name}. It is switched on, so editors and the API can use it.`,
      });
      reload();
    });
  };
  // Removes only the connection and its drafts; the database itself is
  // untouched.
  const remove = () =>
    run('delete', async () => {
      await gateway.deleteConnection(connection.id);
      navigate('#/connections');
    });

  // The capability helper expects a list-shaped summary; fill the unused parts
  // with neutral values. The casts narrow loosely typed gateway strings.
  const cells = capabilityCells({
    id: connection.id,
    name: connection.name,
    adapter: connection.adapter,
    adapterLabel: connection.adapterLabel,
    mode: connection.mode,
    health: 'healthy',
    lastCheckedAt: connection.lastCheckedAt,
    collections: { exposed: 0, total: 0 },
    capabilities: {
      ...connection.capabilities,
      transactions: connection.capabilities.transactions as 'none',
      inequality: connection.capabilities.inequality as 'none',
    },
  });

  return (
    <div className="page">
      <p className="crumbs small">
        <a href="#/connections">Connections</a>
      </p>
      <header className="page-head">
        <div>
          <h1 className="page-title">{connection.name}</h1>
          <div className="meta-line muted small">
            <span>{connection.adapterLabel}</span>
            <span className={`mode mode-${connection.mode}`}>
              {connection.mode === 'read_only' ? 'Read-only' : 'Read and write'}
            </span>
            <span>checked {timeAgo(connection.lastCheckedAt)}</span>
          </div>
        </div>
        <div className="head-actions">
          <button
            className="button button-outline"
            type="button"
            onClick={test}
            disabled={busy !== null}
          >
            {busy === 'test' ? 'Testing…' : 'Test connection'}
          </button>
          <button
            className="button button-outline"
            type="button"
            onClick={refresh}
            disabled={busy !== null}
          >
            {busy === 'refresh' ? 'Reading…' : 'Read structure again'}
          </button>
        </div>
      </header>

      <HealthLine connection={connection} />
      {notice ? (
        <p
          className={notice.kind === 'ok' ? 'notice' : 'form-error'}
          role={notice.kind === 'ok' ? 'status' : 'alert'}
        >
          {notice.text}
        </p>
      ) : null}

      <section className="section" aria-labelledby="collections-heading">
        <h2 id="collections-heading">Collections</h2>
        <p className="muted section-lede">
          Only collections you turn on are available to editors and the API.
        </p>
        {connection.canCreateCollections ? (
          <form className="inline-form" onSubmit={create}>
            <label className="field">
              <span className="field-label">New collection</span>
              <input
                className="input"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                maxLength={63}
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder="projects"
              />
            </label>
            <label className="field grow">
              <span className="field-label">Fields</span>
              <input
                className="input"
                value={newFields}
                onChange={(event) => setNewFields(event.target.value)}
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder="title:string, summary:text, year:integer"
              />
            </label>
            <button className="button" type="submit" disabled={busy !== null}>
              {busy === 'create' ? 'Creating…' : 'Create collection'}
            </button>
          </form>
        ) : null}
        {connection.canCreateCollections ? (
          <p className="field-hint">
            Fields are name and type, separated by commas. Types:{' '}
            {FIELD_TYPES.join(', ')}. The database makes the collection when
            its first record is saved.
          </p>
        ) : null}
        {connection.collections.length === 0 ? (
          <p className="empty">
            {connection.canCreateCollections
              ? 'This database has no collections yet. Create the first one above.'
              : 'No collections were found in this database.'}
          </p>
        ) : (
          <ul className="rows">
            {connection.collections.map((collection) => (
              <li className="row" key={collection.name}>
                <div className="row-main">
                  <code>{collection.name}</code>
                  <span className="muted small">
                    {collection.fields} fields
                    {collection.primaryKey
                      ? `, key ${collection.primaryKey}`
                      : ', no primary key'}
                    {!collection.reviewed ? ' · needs review' : ''}
                  </span>
                </div>
                <div className="row-actions">
                  {collection.exposed ? (
                    <a
                      className="button button-small button-quiet"
                      href={contentHref(connection.id, collection.name)}
                    >
                      Open in content
                    </a>
                  ) : null}
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={collection.exposed}
                      // A collection without a primary key cannot be addressed
                      // by record, so it cannot be exposed.
                      disabled={busy !== null || !collection.primaryKey}
                      onChange={(event) =>
                        toggle(collection.name, event.target.checked)
                      }
                      aria-label={`Show ${collection.name} in the API`}
                    />
                    <span>{collection.exposed ? 'In the API' : 'Hidden'}</span>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="can-heading">
        <h2 id="can-heading">What this database can do</h2>
        <ul className="can-list">
          {cells.map((cell) => (
            <li key={cell.key} className={`can can-${cell.state}`}>
              <span className="can-label">{cell.label}</span>
              <span className="muted small">{cell.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" aria-labelledby="settings-heading">
        <h2 id="settings-heading">Settings</h2>
        <dl className="facts">
          {Object.entries(connection.config)
            // Hide the internal collection list from the settings table.
            .filter(([key]) => key !== 'collections')
            .map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>
                  <code>{String(value)}</code>
                </dd>
              </div>
            ))}
          <div>
            <dt>credentials</dt>
            <dd>
              {connection.hasCredentials
                ? 'Saved (encrypted, never shown)'
                : 'None'}
            </dd>
          </div>
        </dl>
        <div className="form-actions">
          <button
            className="button button-outline"
            type="button"
            onClick={changeMode}
            disabled={busy !== null}
          >
            {connection.mode === 'read_only'
              ? 'Allow editors to change data'
              : 'Make read-only'}
          </button>
          {!confirmingDelete ? (
            <button
              className="button button-danger-quiet"
              type="button"
              onClick={() => setConfirmingDelete(true)}
            >
              Remove connection
            </button>
          ) : (
            <span className="confirm">
              <span>
                This also deletes its unpublished drafts. Your database is not
                touched.
              </span>
              <button
                className="button button-danger"
                type="button"
                onClick={remove}
                disabled={busy !== null}
              >
                Remove {connection.name}
              </button>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setConfirmingDelete(false)}
              >
                Keep
              </button>
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

const FIELD_TYPES = [
  'string',
  'text',
  'integer',
  'decimal',
  'boolean',
  'datetime',
  'date',
  'json',
  'array',
];

/**
 * Read "title:string, year:integer" into fields. Returns a message the person
 * can act on when something is wrong. The gateway checks everything again.
 */
function parseFields(text: string): Array<{ name: string; type: string }> | string {
  const parts = text
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return 'Add at least one field, for example title:string.';
  }
  const seen = new Set<string>();
  const fields: Array<{ name: string; type: string }> = [];
  for (const part of parts) {
    const [name, rawType = 'string', ...extra] = part
      .split(':')
      .map((piece) => piece.trim());
    if (
      name === undefined ||
      extra.length > 0 ||
      !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(name)
    ) {
      return `"${part}" is not a valid field. Use name:type, for example title:string.`;
    }
    const type = rawType.toLowerCase();
    if (!FIELD_TYPES.includes(type)) {
      return `"${rawType}" is not a field type. Use one of: ${FIELD_TYPES.join(', ')}.`;
    }
    if (seen.has(name)) {
      return `The field "${name}" appears twice.`;
    }
    seen.add(name);
    fields.push({ name, type });
  }
  return fields;
}

/** Health status as dot plus text, with the gateway's explanation if any. */
function HealthLine({ connection }: { connection: ConnectionDetail }) {
  const label =
    connection.health === 'healthy'
      ? 'Healthy'
      : connection.health === 'error'
        ? 'Not working'
        : 'Not checked yet';
  return (
    <p>
      <span className={`health health-${connection.health}`}>
        <span className="health-dot" aria-hidden="true" />
        {label}
      </span>
      {connection.healthNote ? (
        <span className="health-note"> {connection.healthNote}</span>
      ) : null}
    </p>
  );
}
