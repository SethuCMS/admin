/**
 * First screen of the hosted admin: ask which gateway to use.
 */

import { useState, type FormEvent } from 'react';
import { normalizeGatewayUrl, saveGateway } from '../api';

/**
 * The person types the address of the gateway they run next to their own
 * database. The address is checked, then remembered in this browser only.
 */
export function ConnectGateway() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    let url: string;
    try {
      url = normalizeGatewayUrl(address);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Check the address.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${url}/v1/health`, { credentials: 'omit' });
      if (!response.ok) {
        throw new Error('not ok');
      }
      saveGateway(url);
      window.location.reload();
    } catch {
      setError(
        `Could not reach ${url}. Check that the gateway is running and the address is right. ` +
          `If it is, add ${window.location.origin} to SETHUCMS_ALLOWED_ORIGINS on the gateway and restart it.`,
      );
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <div className="signin-card">
        <img
          className="signin-logo"
          src={`${import.meta.env.BASE_URL}logo.svg`}
          width="56"
          height="56"
          alt=""
        />
        <h1>Connect to your gateway</h1>
        <p className="muted">
          SethuCMS runs next to your database, on your machine or server. Enter
          its address. Your content goes from your gateway to this page and
          never through us.
        </p>
        <form className="signin-token" onSubmit={submit}>
          <label className="field">
            <span className="field-label">Gateway address</span>
            <input
              className="input mono"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="https://cms.example.com"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="button" type="submit" disabled={busy || address.trim() === ''}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
