/**
 * Sign-in screen shown when the gateway requires a session.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { SetupKey } from './SetupKey';
import {
  absoluteUrl,
  askForGateway,
  defaultGateway,
  forgetGateway,
  gateway,
  joiningWorkspace,
  savedGateway,
  ssoError,
  type PersonSetup,
  type SocialConfig,
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
  const { signIn, signInWithCode, signInWithFirebase, startSetup } = useAuth();
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [totp, setTotp] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // First-run setup: the one-time token, the new admin's name, then the key.
  const [setupToken, setSetupToken] = useState('');
  const [setupName, setSetupName] = useState('');
  const [made, setMade] = useState<PersonSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [social, setSocial] = useState<SocialConfig>({
    sso: false,
    google: false,
    github: false,
  });

  // Ask the gateway whether SSO is on. Failure is fine; the token form still
  // works.
  useEffect(() => {
    if (usingSampleData) {
      setLoaded(true);
      return;
    }
    const controller = new AbortController();
    void gateway
      .socialConfig(controller.signal)
      .then((config) => setSocial(config));
    void gateway
      .totpConfig(controller.signal)
      .then((config) => setTotp(config.enabled))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
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

  // Google or GitHub through the Firebase popup.
  const continueWith = async (provider: 'google' | 'github') => {
    if (!social.firebase) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithFirebase(social.firebase, provider);
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

  // Create the first admin with the setup token, then show the key to scan.
  const submitSetup = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMade(await startSetup(setupToken, setupName));
      setSetupToken('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Setup failed.');
    } finally {
      setBusy(false);
    }
  };

  const submitSetupCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!made) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithCode(made.username, code);
    } catch (cause) {
      setCode('');
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const setupForm = made ? (
    <form className="signin-code" onSubmit={submitSetupCode}>
      <p>
        <strong>Your admin account is ready.</strong> Add it to your
        authenticator app, then enter the code it shows.
      </p>
      <SetupKey secret={made.secret} otpauthUri={made.otpauthUri} />
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
          maxLength={6}
          placeholder="123456"
          required
        />
      </label>
      <p className="muted small">
        This key is shown once. If you lose it, an admin can make a new one.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button" type="submit" disabled={busy || code.length !== 6}>
        {busy ? 'Signing in…' : 'Finish and sign in'}
      </button>
    </form>
  ) : (
    <form className="signin-code" onSubmit={submitSetup}>
      <p className="muted">
        This gateway has no admin yet. Choose a username, and enter the setup
        token printed when the gateway first started. You use the token once,
        here. After this you sign in with a code from your authenticator app.
      </p>
      <label className="field">
        <span className="field-label">Your username</span>
        <input
          className="input"
          value={setupName}
          onChange={(event) => setSetupName(event.target.value)}
          autoCapitalize="none"
          spellCheck={false}
          pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,39}"
          title="3 to 40 letters, numbers, dots, dashes or underscores"
          required
        />
      </label>
      <label className="field">
        <span className="field-label">Setup token</span>
        <input
          className="input mono"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={setupToken}
          onChange={(event) => setSetupToken(event.target.value)}
          required
        />
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="button"
        type="submit"
        disabled={busy || setupName.trim().length < 3 || setupToken.trim() === ''}
      >
        {busy ? 'Creating…' : 'Create admin account'}
      </button>
    </form>
  );

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

  const codeSection = (
    <>
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
        ) : loaded && !usingSampleData ? (
          setupForm
        ) : null}
    </>
  );

  const hasSocial = Boolean(
    social.firebase || social.google || social.github || social.sso,
  );
  const socialSection = (
    <>
        {social.firebase || social.google || social.github || social.sso ? (
          <div className="social-buttons">
            {social.firebase ? (
              <>
                {social.firebase.providers.includes('google.com') ? (
                  <button
                    className="button button-quiet social-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void continueWith('google')}
                  >
                    <GoogleMark /> Continue with Google
                  </button>
                ) : null}
                {social.firebase.providers.includes('github.com') ? (
                  <button
                    className="button button-quiet social-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void continueWith('github')}
                  >
                    <GithubMark /> Continue with GitHub
                  </button>
                ) : null}
              </>
            ) : (
              <>
                {social.google ? (
                  <a
                    className="button button-quiet social-button"
                    href={absoluteUrl('/v1/auth/oidc/login')}
                  >
                    <GoogleMark /> Continue with Google
                  </a>
                ) : null}
                {social.github ? (
                  <a
                    className="button button-quiet social-button"
                    href={absoluteUrl('/v1/auth/github/login')}
                  >
                    <GithubMark /> Continue with GitHub
                  </a>
                ) : null}
              </>
            )}
            {social.sso && !social.google ? (
              <a
                className="button button-quiet social-button"
                href={absoluteUrl('/v1/auth/oidc/login')}
              >
                Sign in with single sign-on
              </a>
            ) : null}
          </div>
        ) : null}
    </>
  );

  return (
    <div className="signin">
      <div className="signin-card">
        <img className="signin-logo" src={`${import.meta.env.BASE_URL}logo.svg`} width="56" height="56" alt="" />
        <h1>Sign in to SethuCMS</h1>
        {askForGateway && !defaultGateway ? (
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

        {social.firebase?.workspaces ? (
          <>
            <p className="muted small">
              {joiningWorkspace()
                ? 'You have been invited to a workspace. Sign in with the e-mail address you were invited with.'
                : 'Sign in to open your workspace. New here? Signing in creates your own, and you are its admin.'}
            </p>
            {socialSection}
          </>
        ) : hasSocial ? (
          socialSection
        ) : (
          codeSection
        )}

        {/* In workspace mode everyone signs in with Google or GitHub, so the
            API-token form is hidden. Other gateways keep it for recovery. */}
        {loaded && !hasSocial && !social.firebase?.workspaces ? (
          <details className="signin-alt">
            <summary>Use an API token instead</summary>
            {tokenForm}
          </details>
        ) : null}
      </div>
    </div>
  );
}

/** Google's "G", in its four brand colors. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.3 6.5v5.4h6.9c4-3.7 6.7-9.2 6.7-15.9z" />
      <path fill="#34A853" d="M24 46c5.8 0 10.7-1.9 14.3-5.2l-6.9-5.4c-1.9 1.3-4.4 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.7v5.6C8.3 41.1 15.6 46 24 46z" />
      <path fill="#FBBC05" d="M11.8 28.5c-.4-1.3-.7-2.7-.7-4.5s.3-3.2.7-4.5v-5.6H4.7C3.3 16.8 2.5 20.3 2.5 24s.8 7.2 2.2 10.1l7.1-5.6z" />
      <path fill="#EA4335" d="M24 10.5c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.7 3.9 29.8 2 24 2 15.6 2 8.3 6.9 4.7 13.9l7.100 5.600c1.700-5.200 6.500-9 12.200-9z" />
    </svg>
  );
}

/** GitHub's mark; it takes the text color so it works in dark mode. */
function GithubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
