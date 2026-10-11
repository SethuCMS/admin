/**
 * Sign-in screen shown when the gateway requires a session.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import {
  absoluteUrl,
  askForGateway,
  forgetGateway,
  gateway,
  savedGateway,
  ssoError,
  usingSampleData,
} from '../api';

// Shown after a failed single sign-on redirect; wording avoids leaking why the
// identity provider refused.
const SSO_MESSAGES = {
  denied:
    'Your account is not allowed to use SethuCMS. Ask an administrator to add you to a group.',
  failed:
    'Single sign-on did not work. Try again, or ask an administrator to check the log.',
  expired: 'The sign-in took too long. Start again.',
} as const;

/**
 * Sign-in screen. The main way in is the 6-digit code from an authenticator app
 * (Google Authenticator and similar). Single sign-on shows when the gateway has
 * it, and the API-token form stays available underneath for the first admin and
 * for recovery.
 */
export function SignIn() {
  const { signIn, signInWithCode } = useAuth();
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [totp, setTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sso, setSso] = useState(false);

  // Ask the gateway whether SSO is on. Failure is fine; the token form still
  // works.
  useEffect(() => {
    if (usingSampleData) {
      return;
    }
    const controller = new AbortController();
    void gateway
      .ssoConfig(controller.signal)
      .then((config) => setSso(config.enabled));
    void gateway
      .totpConfig(controller.signal)
      .then((config) => setTotp(config.enabled));
    return () => controller.abort();
  }, []);

  // On success AuthProvider swaps this screen out, so there is no redirect
  // here. `signIn` clears the bad token itself on failure.
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithCode(username, code);
    } catch (cause) {
      setCode('');
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const tokenForm = (
    <form className="signin-token" onSubmit={submit}>
      <p className="muted">
        Paste an API token. The first admin token is printed in the terminal when
        the gateway starts for the first time.
      </p>
      <label className="field">
        <span className="field-label">API token</span>
        <input
          className="input mono"
          type="password"
          // Keep the credential out of browser autofill and password managers.
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={(event) => setToken(event.target.value)}
          required
        />
      </label>
      <button
        className="button"
        type="submit"
        disabled={busy || token.trim().length === 0}
      >
        {busy ? 'Signing in…' : 'Sign in with token'}
      </button>
    </form>
  );

  return (
    <div className="signin">
      <div className="signin-card">
        <img className="signin-logo" src={`${import.meta.env.BASE_URL}logo.svg`} width="56" height="56" alt="" />
        <h1>Sign in to SethuCMS</h1>
        {askForGateway ? (
          <p className="muted small">
            Gateway: <code>{savedGateway()}</code>{' '}
            <button className="button button-small button-quiet" type="button" onClick={forgetGateway}>
              Change
            </button>
          </p>
        ) : null}
        {ssoError ? (
          <p className="form-error" role="alert">
            {SSO_MESSAGES[ssoError]}
          </p>
        ) : null}

        {totp ? (
          <form className="signin-code" onSubmit={submitCode}>
            <label className="field">
              <span className="field-label">Username</span>
              <input
                className="input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">6-digit code</span>
              <input
                className="input mono code-input"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                aria-describedby={error ? 'signin-error' : undefined}
                required
              />
            </label>
            <p className="muted small">
              Open Google Authenticator (or any authenticator app) and enter the
              code shown for SethuCMS.
            </p>
            {error ? (
              <p id="signin-error" className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="button"
              type="submit"
              disabled={busy || username.trim() === '' || code.length !== 6}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <p className="muted">
            No one has set up an authenticator app yet. Sign in with an API token,
            then add people under Roles and access.
          </p>
        )}

        {sso ? (
          <a className="button button-quiet" href={absoluteUrl('/v1/auth/oidc/login')}>
            Sign in with single sign-on
          </a>
        ) : null}

        {totp ? (
          <details className="signin-alt">
            <summary>Use an API token instead</summary>
            {tokenForm}
          </details>
        ) : (
          <>
            {tokenForm}
            {error ? (
              <p id="signin-error" className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
