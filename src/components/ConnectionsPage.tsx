/**
 * Connections list and the add-connection form (admin only).
 */

import { useState, type FormEvent } from 'react';
import { gateway, type ConnectionListItem } from '../api';
import { navigate } from '../router';
import {
  ADAPTER_FORMS,
  buildSettings,
  initialValues,
  type FormField,
} from '../lib/adapterForms';
import { useAsync } from '../useAsync';

/**
 * Admin list of connections, with an inline form to add one.
 */
export function ConnectionsPage() {
  // Reuses the overview endpoint, which already lists every connection.
  const { state, reload } = useAsync(
    (signal) => gateway.overview(signal),
    'connections',
  );
  const [adding, setAdding] = useState(false);

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Connections</h1>
        {!adding ? (
          <button
            className="button"
            type="button"
            onClick={() => setAdding(true)}
          >
            Add connection
          </button>
        ) : null}
      </header>
      <p className="muted section-lede">
        Each connection is one database. They all work at the same time. New
        connections start read-only, and nothing is exposed until you choose it.
      </p>

      {adding ? (
        <AddConnection
          onCancel={() => setAdding(false)}
          onCreated={(id) => {
            reload();
            navigate(`#/connections/${encodeURIComponent(id)}`);
          }}
        />
      ) : null}

      {state.status === 'loading' ? (
        <p className="muted" aria-busy="true">
          Loading connections…
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === 'ready' &&
      state.data.connections.length === 0 &&
      !adding ? (
        <p className="empty">
          No connections yet. Add one to start managing content.
        </p>
      ) : null}
      {state.status === 'ready' ? (
        <ul className="card-list">
          {state.data.connections.map((connection) => (
            <li key={connection.id}>
              <a
                className="card"
                href={`#/connections/${encodeURIComponent(connection.id)}`}
              >
                <span className="card-title">{connection.name}</span>
                <span className="meta-line muted small">
                  <span>{connection.adapterLabel}</span>
                  <span className={`mode mode-${connection.mode}`}>
                    {connection.mode === 'read_only'
                      ? 'Read-only'
                      : 'Read and write'}
                  </span>
                </span>
                <span className={`health health-${connection.health}`}>
                  <span className="health-dot" aria-hidden="true" />
                  {connection.health === 'healthy'
                    ? 'Healthy'
                    : connection.health === 'error'
                      ? 'Not working'
                      : 'Not checked yet'}
                </span>
                {connection.healthNote ? (
                  <span className="health-note">{connection.healthNote}</span>
                ) : null}
                <span className="muted small">
                  {connection.collections.exposed} of{' '}
                  {connection.collections.total} collections in the API
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Form for a new connection. Fields come from `ADAPTER_FORMS`; secrets are sent
 * as `credentials` and never shown again. New connections default to read-only
 * with nothing exposed.
 */
function AddConnection({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const adapters = useAsync(() => gateway.adapters(), 'adapters');
  const [adapter, setAdapter] = useState('postgres');
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    initialValues(ADAPTER_FORMS['postgres']),
  );
  const [writable, setWritable] = useState(false);
  const [exposeAll, setExposeAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const form = ADAPTER_FORMS[adapter];

  // Reset values on switch so one database type's settings never leak into
  // another's request.
  const chooseAdapter = (id: string) => {
    setAdapter(id);
    setValues(initialValues(ADAPTER_FORMS[id]));
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    // `config` and `credentials` are added below only when the adapter has a
    // form.
    const body: Record<string, unknown> = {
      name,
      adapter,
      mode: writable ? 'read_write' : 'read_only',
      expose: exposeAll ? 'all' : 'none',
    };
    if (form) {
      const { config, credentials } = buildSettings(form, values);
      body['config'] = config;
      if (Object.keys(credentials).length > 0) {
        body['credentials'] = credentials;
      }
    }
    try {
      // The gateway tests the connection while creating it, so an error here
      // means it could not connect.
      const created = await gateway.createConnection(body);
      onCreated(created.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The connection could not be created.',
      );
    } finally {
      setBusy(false);
    }
  };

  // Fallback list so the form works while (or if) the adapter list fails to
  // load.
  const options =
    adapters.state.status === 'ready'
      ? adapters.state.data
      : [
          { id: 'postgres', label: 'PostgreSQL' },
          { id: 'memory', label: 'In-memory (demo)' },
        ];

  // Fields marked `pair` share a row with the one after them.
  // Group fields into rows; checkboxes never join a row.
  const rows: FormField[][] = [];
  for (const field of form?.fields ?? []) {
    const last = rows[rows.length - 1];
    if (last && last[last.length - 1]?.pair && field.kind !== 'check') {
      last.push(field);
    } else {
      rows.push([field]);
    }
  }

  return (
    <form
      className="panel form"
      onSubmit={submit}
      aria-labelledby="add-heading"
    >
      <h2 id="add-heading">Add a connection</h2>

      <label className="field">
        <span className="field-label">Database type</span>
        <select
          className="input"
          value={adapter}
          onChange={(event) => chooseAdapter(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">Name</span>
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          required
          placeholder="Orders (production)"
        />
      </label>

      {form ? (
        <>
          {form.intro ? <p className="muted small">{form.intro}</p> : null}
          {rows.map((row) => (
            <div
              className={row.length > 1 ? 'field-row' : undefined}
              key={row.map((field) => field.key).join('+')}
            >
              {row.map((field) => (
                <SettingInput
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? ''}
                  grow={row.length > 1 && field !== row[row.length - 1]}
                  onChange={(value) =>
                    setValues((current) => ({ ...current, [field.key]: value }))
                  }
                />
              ))}
            </div>
          ))}
        </>
      ) : (
        <p className="muted">
          A small demo database with sample articles and authors. It lives in
          the gateway&rsquo;s memory and is reset on restart.
        </p>
      )}

      <label className="check">
        <input
          type="checkbox"
          checked={writable}
          onChange={(event) => setWritable(event.target.checked)}
        />
        <span>
          Let editors change data. Leave off to keep this connection read-only.
        </span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={exposeAll}
          onChange={(event) => setExposeAll(event.target.checked)}
        />
        <span>
          Show every collection in the API right away. Leave off to review them
          first.
        </span>
      </label>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="form-actions">
        <button className="button" type="submit" disabled={busy}>
          {busy ? 'Connecting…' : 'Test and add connection'}
        </button>
        <button
          className="button button-quiet"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Renders one adapter form field by kind. Secrets use autocomplete="new-
 * password"/"off" to stay out of browser storage.
 */
function SettingInput({
  field,
  value,
  grow,
  onChange,
}: {
  field: FormField;
  value: string | boolean;
  grow: boolean;
  onChange: (value: string | boolean) => void;
}) {
  if (field.kind === 'check') {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    );
  }
  const text = typeof value === 'string' ? value : '';
  const className = `input${field.mono ? ' mono' : ''}`;
  return (
    <label
      className={`field${grow ? ' grow' : field.kind === 'number' ? ' narrow' : ''}`}
    >
      <span className="field-label">{field.label}</span>
      {field.kind === 'secret-text' ? (
        <textarea
          className={className}
          rows={5}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          autoComplete="off"
          spellCheck={false}
        />
      ) : (
        <input
          className={className}
          type={field.kind === 'password' ? 'password' : 'text'}
          inputMode={field.kind === 'number' ? 'numeric' : undefined}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          placeholder={field.placeholder}
          autoComplete={field.kind === 'password' ? 'new-password' : 'off'}
        />
      )}
      {field.hint ? <span className="field-hint">{field.hint}</span> : null}
    </label>
  );
}

// Re-exported for callers that import the type from this module.
export type { ConnectionListItem };
