/**
 * The sign-in window other sites open (see lib/signin-bridge.ts). It runs on
 * the gateway's own address, which Firebase already allows, checks that the
 * site that asked is one this gateway or workspace allows, signs the person in
 * with Google or GitHub, and hands the ID token to that site only.
 */

import { useEffect, useState } from 'react';
import { gateway, type SocialConfig } from '../api';
import { firebaseIdToken } from '../lib/firebase-signin';
import { readBridgeRequest, replyToOpener } from '../lib/signin-bridge';

type Firebase = NonNullable<SocialConfig['firebase']>;

export function BridgePage() {
  const request = readBridgeRequest(window.location.hash);
  const [firebase, setFirebase] = useState<Firebase | null>(null);
  const [problem, setProblem] = useState<string | null>(
    !request || !window.opener
      ? 'This window is opened by a site that wants you to sign in. Close it and start again from that site.'
      : null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request || !window.opener) {
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const allowed = await gateway.bridgeAllowed(request.origin, request.workspace);
        if (!allowed) {
          const message = `${request.origin} is not allowed to sign in here. Add it under CORS origins in the workspace, then try again.`;
          setProblem(message);
          replyToOpener(request.origin, request.nonce, { error: message });
          return;
        }
        const config = await gateway.socialConfig(controller.signal);
        if (!config.firebase) {
          setProblem('Sign-in with Google or GitHub is not turned on for this gateway.');
          return;
        }
        setFirebase(config.firebase);
      } catch {
        setProblem('The gateway could not be reached. Close this window and try again.');
      }
    })();
    return () => controller.abort();
    // The request is read once from the address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = async () => {
    if (!request || !firebase) {
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const idToken = await firebaseIdToken(firebase, request.provider);
      replyToOpener(request.origin, request.nonce, { idToken });
      window.close();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Sign-in failed.';
      setProblem(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <div className="signin-card">
        <h1>Sign in to SethuCMS</h1>
        {request && firebase ? (
          <>
            <p className="muted small">
              Signing in for <strong>{request.origin}</strong>. Only continue if you started this from that site.
            </p>
            <button className="button button-quiet social-button" type="button" disabled={busy} onClick={() => void go()}>
              {busy ? 'Waiting…' : `Continue with ${request.provider === 'google' ? 'Google' : 'GitHub'}`}
            </button>
          </>
        ) : problem ? null : (
          <p className="muted">Checking…</p>
        )}
        {problem ? (
          <p className="form-error" role="alert">
            {problem}
          </p>
        ) : null}
      </div>
    </div>
  );
}
