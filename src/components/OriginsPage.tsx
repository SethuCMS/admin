/**
 * Browser origins allowed to call the gateway (CORS), admin only. Origins set
 * in the gateway's environment are listed but can only be changed there.
 */

import { useState, type FormEvent } from 'react';
import { gateway } from '../api';
import { timeAgo } from '../lib/time';
import { useAsync } from '../useAsync';

export function OriginsPage() {
  const origins = useAsync(() => gateway.origins(), 'origins');
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState<string | null>(null);

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
  const remove = async (id: string) => {
    setError(null);
    try {
      await gateway.removeOrigin(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The origin could not be removed.');
    }
    origins.reload();
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>CORS origins</h1>
        <p className="muted">
          Websites that may call this gateway from a browser, such as a portal
          or a store front. Use the exact address: scheme, host and port, with
          no path and no wildcard.
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
              placeholder="https://portal.example.com"
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

        {origins.state.status === 'ready' ? (
          origins.state.data.length === 0 ? (
            <p className="muted">None added yet. The SethuCMS admin always works. Add the address of any other site of yours that needs to call this gateway from a browser.</p>
          ) : (
            <ul className="rows">
              {origins.state.data.map((item) => (
                <li className="row" key={item.id ?? item.origin}>
                  <div className="row-main">
                    <span>{item.origin}</span>
                    <span className="muted small">
                      {item.id === null
                        ? 'Set in the gateway environment'
                        : `Added ${timeAgo(item.createdAt as string)}`}
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
    </div>
  );
}
