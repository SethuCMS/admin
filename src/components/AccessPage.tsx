/**
 * People (authenticator-app sign-in), roles and API token management (admin
 * only).
 */

import { useState, type FormEvent } from 'react';
import { gateway, type PersonSetup, type Role } from '../api';
import { timeAgo } from '../lib/time';
import { useAsync } from '../useAsync';
import { SetupKey } from './SetupKey';

// Role descriptions; mirror what the gateway enforces.
const ROLES: Array<{ role: Role; label: string; summary: string }> = [
  {
    role: 'admin',
    label: 'Admin',
    summary: 'Everything: connections, tokens, the audit log, and all content.',
  },
  {
    role: 'editor',
    label: 'Editor',
    summary:
      'Read, create, change and delete content. Work with drafts and publish.',
  },
  {
    role: 'viewer',
    label: 'Viewer',
    summary: 'Read published content only. Cannot see drafts.',
  },
];

/**
 * Role overview and API token management. A new token is shown once because the
 * gateway stores only a hash.
 */
export function AccessPage() {
  const { state, reload } = useAsync(() => gateway.tokens(), 'tokens');
  const people = useAsync(() => gateway.people(), 'people');
  const [username, setUsername] = useState('');
  const [personRole, setPersonRole] = useState<Role>('editor');
  const [setup, setSetup] = useState<PersonSetup | null>(null);
  const [personError, setPersonError] = useState<string | null>(null);

  // The setup key is held in memory only until the person is dismissed.
  const addPerson = async (event: FormEvent) => {
    event.preventDefault();
    setPersonError(null);
    try {
      setSetup(await gateway.createPerson({ username, role: personRole }));
      setUsername('');
      people.reload();
    } catch (cause) {
      setPersonError(
        cause instanceof Error ? cause.message : 'The person could not be added.',
      );
    }
  };
  const resetPerson = async (id: string) => {
    setPersonError(null);
    try {
      setSetup(await gateway.resetPerson(id));
      people.reload();
    } catch (cause) {
      setPersonError(
        cause instanceof Error ? cause.message : 'The key could not be reset.',
      );
    }
  };
  const changeRole = async (id: string, next: Role) => {
    setPersonError(null);
    try {
      await gateway.setPersonRole(id, next);
    } catch (cause) {
      setPersonError(
        cause instanceof Error ? cause.message : 'The role could not be changed.',
      );
    }
    people.reload();
  };
  const removePerson = async (id: string) => {
    setPersonError(null);
    try {
      await gateway.removePerson(id);
      people.reload();
    } catch (cause) {
      setPersonError(
        cause instanceof Error ? cause.message : 'The person could not be removed.',
      );
    }
  };
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [expires, setExpires] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keeps the secret only in memory (`created`) until the person dismisses it.
  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await gateway.createToken({
        name,
        role,
        // Omit the field for "never expires".
        ...(expires ? { expiresInDays: Number(expires) } : {}),
      });
      setCreated(result.token);
      setName('');
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The token could not be created.',
      );
    } finally {
      setBusy(false);
    }
  };

  // 60 minutes of overlap lets deployed apps switch to the new token without
  // downtime.
  const rotate = async (id: string) => {
    setError(null);
    try {
      const result = await gateway.rotateToken(id, 60);
      setCreated(result.token);
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The token could not be replaced.',
      );
    }
  };

  const revoke = async (id: string) => {
    setError(null);
    try {
      await gateway.revokeToken(id);
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The token could not be revoked.',
      );
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Roles and access</h1>
      <p className="muted section-lede">
        People sign in with a code from an authenticator app. Apps and websites
        use API tokens. Each person and each token has one role.
      </p>

      <ul className="rows roles">
        {ROLES.map((item) => (
          <li className="row" key={item.role}>
            <div className="row-main">
              <strong>{item.label}</strong>
              <span className="muted small">{item.summary}</span>
            </div>
          </li>
        ))}
      </ul>

      <section className="section" aria-labelledby="people-heading">
        <h2 id="people-heading">People</h2>
        <p className="muted small">
          Add a person, then give them the setup key. In Google Authenticator
          choose <em>Add a code</em>, then <em>Enter a setup key</em>. Their first
          correct code finishes the setup.
        </p>

        <form className="inline-form" onSubmit={addPerson}>
          <label className="field grow">
            <span className="field-label">Username</span>
            <input
              className="input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={3}
              maxLength={40}
              autoCapitalize="none"
              spellCheck={false}
              required
              placeholder="asha"
            />
          </label>
          <label className="field">
            <span className="field-label">Role</span>
            <select
              className="input"
              value={personRole}
              onChange={(event) => setPersonRole(event.target.value as Role)}
            >
              {ROLES.map((item) => (
                <option key={item.role} value={item.role}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            Add person
          </button>
        </form>

        {setup ? (
          <div className="panel secret" role="status">
            <p>
              <strong>Setup key for {setup.username}.</strong> It cannot be shown
              again.
            </p>
            <SetupKey secret={setup.secret} otpauthUri={setup.otpauthUri} />
            <button
              className="button button-small button-quiet"
              type="button"
              onClick={() => setSetup(null)}
            >
              I have added it
            </button>
          </div>
        ) : null}
        {personError ? (
          <p className="form-error" role="alert">
            {personError}
          </p>
        ) : null}

        {people.state.status === 'ready' ? (
          people.state.data.length === 0 ? (
            <p className="muted">No one yet. Add the first person above.</p>
          ) : (
            <ul className="rows">
              {people.state.data.map((person) => (
                <li className="row" key={person.id}>
                  <div className="row-main">
                    <span>
                      {person.username}{' '}
                      <select
                        className="input"
                        aria-label={`Role for ${person.username}`}
                        value={person.role}
                        onChange={(event) =>
                          changeRole(person.id, event.target.value as Role)
                        }
                      >
                        {ROLES.map((item) => (
                          <option key={item.role} value={item.role}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span className="muted small">
                      {person.enabled
                        ? 'Authenticator set up'
                        : 'Waiting for the first code'}{' '}
                      · added {timeAgo(person.createdAt)}
                    </span>
                  </div>
                  <button
                    className="button button-small button-quiet"
                    type="button"
                    onClick={() => resetPerson(person.id)}
                    title="Make a new setup key and sign this person out."
                  >
                    New key
                  </button>
                  <button
                    className="button button-small button-danger-quiet"
                    type="button"
                    onClick={() => removePerson(person.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : people.state.status === 'error' ? (
          <p className="form-error" role="alert">
            {people.state.message}
          </p>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </section>

      <section className="section" aria-labelledby="tokens-heading">
        <h2 id="tokens-heading">API tokens</h2>

        <form className="inline-form" onSubmit={create}>
          <label className="field grow">
            <span className="field-label">Name</span>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              required
              placeholder="Website build"
            />
          </label>
          <label className="field">
            <span className="field-label">Role</span>
            <select
              className="input"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {ROLES.map((item) => (
                <option key={item.role} value={item.role}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Expires</span>
            <select
              className="input"
              value={expires}
              onChange={(event) => setExpires(event.target.value)}
            >
              <option value="">Never</option>
              <option value="30">In 30 days</option>
              <option value="90">In 90 days</option>
              <option value="365">In 1 year</option>
            </select>
          </label>
          <button className="button" type="submit" disabled={busy}>
            Create token
          </button>
        </form>

        {created ? (
          <div className="panel secret" role="status">
            <p>
              <strong>Copy this token now.</strong> It cannot be shown again.
            </p>
            <code className="token-value">{created}</code>
            <button
              className="button button-small button-quiet"
              type="button"
              onClick={() => setCreated(null)}
            >
              I have copied it
            </button>
          </div>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {state.status === 'ready' ? (
          <ul className="rows">
            {state.data.map((token) => (
              <li className="row" key={token.id}>
                <div className="row-main">
                  <span>
                    {token.name}{' '}
                    <span className="muted small">· {token.role}</span>
                  </span>
                  <span className="muted small">
                    <code>{token.id}</code> · created {timeAgo(token.createdAt)}
                    {token.revokedAt
                      ? ` · revoked ${timeAgo(token.revokedAt)}`
                      : token.expiresAt
                        ? Date.parse(token.expiresAt) <= Date.now()
                          ? ` · expired ${timeAgo(token.expiresAt)}`
                          : ` · expires ${timeAgo(token.expiresAt)}`
                        : ''}
                  </span>
                </div>
                {!token.revokedAt &&
                !(
                  token.expiresAt && Date.parse(token.expiresAt) <= Date.now()
                ) ? (
                  <>
                    <button
                      className="button button-small button-quiet"
                      type="button"
                      onClick={() => rotate(token.id)}
                      title="Make a new token. This one keeps working for an hour."
                    >
                      Replace
                    </button>
                    <button
                      className="button button-small button-danger-quiet"
                      type="button"
                      onClick={() => revoke(token.id)}
                    >
                      Revoke
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : state.status === 'error' ? (
          <p className="form-error" role="alert">
            {state.message}
          </p>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </section>
    </div>
  );
}
