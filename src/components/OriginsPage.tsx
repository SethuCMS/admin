/**
 * Browser origins allowed to call the gateway (CORS), admin only. Origins set
 * in the gateway's environment are listed but can only be changed there.
 *
 * Sites that called the gateway and were refused are listed too, so a blocked
 * site can be allowed with one click instead of typing its address.
 */

import { useState, type FormEvent } from 'react';
import { gateway } from '../api';
import { timeAgo } from '../lib/time';
import { useAsync } from '../useAsync';

/** Words for the "last used" line. The gateway only remembers since its start. */
const lastUsed = (lastSeenAt: string | null): string =>
  lastSeenAt === null
    ? 'Not used since the gateway started'
    : `Last used ${timeAgo(lastSeenAt)}`;

export function OriginsPage() {
  const origins = useAsync(() => gateway.origins(), 'origins');
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The address being allowed from the refused list, so its button can show it.
  const [allowing, setAllowing] = useState<string | null>(null);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await gateway.addOrigin(origin);
      setOrigin('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The origin could not be added.');
    }
    origins.reload();
  };
  const allow = async (address: string) => {
    setError(null);
    setAllowing(address);
    try {
      await gateway.addOrigin(address);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The origin could not be added.');
    }
    setAllowing(null);
    origins.reload();
  };
  const remove = async (id: string) => {
    setError(null);
    try {
      await gateway.removeOrigin(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The origin could not be removed.');
    }
    origins.reload();
  };

  const view = origins.state.status === 'ready' ? origins.state.data : null;

  return (
    <div className="page">
      <header className="page-header">
        <h1>CORS origins</h1>
        <p className="muted">
          Websites that may call this gateway from a browser, such as a portal
          or a store front. Use the exact address: scheme, host and port, with
          no path.{' '}
          {view?.wildcardsEnabled
            ? 'Wildcards are on: https://*.example.com allows one subdomain level on a domain you own.'
            : 'Wildcards are off.'}
        </p>
      </header>

      <section className="section" aria-labelledby="origins-heading">
        <h2 id="origins-heading">Allowed origins</h2>
        <form className="inline-form" onSubmit={add}>
          <label className="field grow">
            <span className="field-label">Origin</span>
            <input
              className="input"
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
              type="url"
              autoCapitalize="none"
              spellCheck={false}
              required
              placeholder={
                view?.wildcardsEnabled
                  ? 'https://portal.example.com or https://*.example.com'
                  : 'https://portal.example.com'
              }
            />
          </label>
          <button className="button" type="submit">
            Add origin
          </button>
        </form>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {view ? (
          view.data.length === 0 ? (
            <p className="muted">None added yet. The SethuCMS admin always works. Add the address of any other site of yours that needs to call this gateway from a browser.</p>
          ) : (
            <ul className="rows">
              {view.data.map((item) => (
                <li className="row" key={item.id ?? item.origin}>
                  <div className="row-main">
                    <span>
                      {item.origin}
                      {item.origin.includes('*') ? (
                        <span className="muted small"> (any one subdomain)</span>
                      ) : null}
                    </span>
                    <span className="muted small">
                      {item.id === null
                        ? 'Set in the gateway environment'
                        : `Added ${timeAgo(item.createdAt as string)}`}
                      {' · '}
                      {lastUsed(item.lastSeenAt)}
                    </span>
                  </div>
                  {item.id === null ? null : (
                    <button
                      className="button button-small button-danger-quiet"
                      type="button"
                      onClick={() => remove(item.id as string)}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : origins.state.status === 'error' ? (
          <p className="form-error" role="alert">
            {origins.state.message}
          </p>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </section>

      {view && view.blocked.length > 0 ? (
        <section className="section" aria-labelledby="blocked-heading">
          <h2 id="blocked-heading">Recently refused</h2>
          <p className="muted small">
            These sites tried to call the gateway from a browser and were
            refused. Anyone can send any address, so allow only sites you own
            or trust. The list is kept in memory and starts empty after a restart.
          </p>
          <ul className="rows">
            {view.blocked.map((item) => (
              <li className="row" key={item.origin}>
                <div className="row-main">
                  <span>{item.origin}</span>
                  <span className="muted small">
                    Refused {item.count} {item.count === 1 ? 'time' : 'times'}, last {timeAgo(item.lastSeenAt)}
                  </span>
                </div>
                <button
                  className="button button-small"
                  type="button"
                  disabled={allowing !== null}
                  onClick={() => allow(item.origin)}
                  aria-label={`Allow ${item.origin}`}
                >
                  {allowing === item.origin ? 'Allowing…' : 'Allow this site'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section" aria-labelledby="help-heading">
        <h2 id="help-heading">If a site does not work</h2>
        <details>
          <summary>What the browser shows, and what to do</summary>
          <ul className="rows">
            <li className="row">
              <div className="row-main">
                <strong>"Blocked by CORS policy", or "Failed to fetch"</strong>
                <span className="muted small">
                  The site is not in the list above. Add its exact address, or
                  use Allow this site if it shows under Recently refused. Also
                  check that the gateway is running and the address is right,
                  and that an https site is not calling an http gateway.
                </span>
              </div>
            </li>
            <li className="row">
              <div className="row-main">
                <strong>401 Unauthorized</strong>
                <span className="muted small">
                  The token is missing, wrong or expired. Sign in again or
                  create a new token under Access. This is not a CORS problem.
                </span>
              </div>
            </li>
            <li className="row">
              <div className="row-main">
                <strong>403 Forbidden</strong>
                <span className="muted small">
                  The token is valid but its role may not do this, or the
                  collection is not exposed. Check the role and the exposed
                  collections. Allowing the site will not change this.
                </span>
              </div>
            </li>
          </ul>
          <p className="muted small">
            Allowing a site only lets its pages read answers in a browser. It
            gives no access: every request still needs a token, and the token's
            role decides what it can do.
          </p>
        </details>
      </section>
    </div>
  );
}
