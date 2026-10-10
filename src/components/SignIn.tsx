/**
 * Sign-in screen shown when the gateway requires a session.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { absoluteUrl, gateway, ssoError, usingSampleData } from '../api';

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
 * Sign-in screen: API token form, plus a single sign-on button when the gateway
 * has SSO enabled.
 */
export function SignIn() {
  const { signIn } = useAuth();
  const [token, setToken] = useState('');
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

  return (
    <div className="signin">
      <form className="signin-card" onSubmit={submit}>
        <h1>Sign in to SethuCMS</h1>
        {ssoError ? (
          <p className="form-error" role="alert">
            {SSO_MESSAGES[ssoError]}
          </p>
        ) : null}
        {sso ? (
          <>
            <a className="button" href={absoluteUrl('/v1/auth/oidc/login')}>
              Sign in with single sign-on
            </a>
            <p className="muted">Or use an API token:</p>
          </>
        ) : null}
        <p className="muted">
          Paste your API token. The first admin token is printed in the terminal
          when the gateway starts for the first time.
        </p>
        <label className="field">
          <span className="field-label">API token</span>
          <input
            className="input mono"
            type="password"
            // Keep the credential out of browser autofill and password
            // managers.
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'signin-error' : undefined}
            required
          />
        </label>
        {error ? (
          <p id="signin-error" className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="button"
          type="submit"
          disabled={busy || token.trim().length === 0}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
