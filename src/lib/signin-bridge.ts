/**
 * Sign-in for sites that are not on the Firebase project's "authorized
 * domains". Firebase only runs its popup on listed domains, and a list cannot
 * grow by hand every time someone adds a site. So the popup runs on the
 * gateway's own address (always listed), and the Firebase ID token is passed
 * back to the site that asked, but only if the gateway or workspace allows that
 * site (the same CORS origins list people already manage). The token goes to
 * that origin and nowhere else, and only for the window this site opened.
 */
import { gatewayRoot } from '../api';
import { readBridgeRequest, type Provider } from './bridge-request';

export { readBridgeRequest };


const TOKEN = 'sethucms:id-token';
const FAILED = 'sethucms:bridge-error';

/** A random value that ties a reply to the request that asked for it. */
const makeNonce = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

/** True when this page is not served by the gateway, so sign-in may need the bridge. */
export const canUseBridge = (): boolean => {
  try {
    return gatewayRoot() !== '' && new URL(gatewayRoot()).origin !== window.location.origin;
  } catch {
    return false;
  }
};

/**
 * Open the bridge window on the gateway's address and wait for the token. Call
 * this straight from a click, so the browser lets the window open.
 */
export function bridgeIdToken(provider: Provider, workspace: string | null): Promise<string> {
  const root = new URL(gatewayRoot());
  const nonce = makeNonce();
  const params = new URLSearchParams({ provider, origin: window.location.origin, nonce });
  if (workspace) {
    params.set('workspace', workspace);
  }
  const popup = window.open(
    `${root.origin}/#/bridge?${params.toString()}`,
    'sethucms-bridge',
    'popup,width=480,height=680',
  );
  if (!popup) {
    return Promise.reject(
      new Error('Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'),
    );
  }
  return new Promise<string>((resolve, reject) => {
    const done = (finish: () => void) => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(watch);
      finish();
    };
    const onMessage = (event: MessageEvent) => {
      // Only the bridge window we opened, on the gateway's own address.
      if (event.origin !== root.origin || event.source !== popup) {
        return;
      }
      const data = event.data as { type?: string; nonce?: string; idToken?: string; message?: string };
      if (data?.nonce !== nonce) {
        return;
      }
      if (data.type === TOKEN && typeof data.idToken === 'string' && data.idToken !== '') {
        done(() => resolve(data.idToken as string));
      } else if (data.type === FAILED) {
        done(() => reject(new Error(data.message || 'Sign-in did not finish. Try again.')));
      }
    };
    const watch = window.setInterval(() => {
      if (popup.closed) {
        done(() => reject(new Error('The sign-in window was closed before it finished.')));
      }
    }, 500);
    window.addEventListener('message', onMessage);
  });
}

/** Send the answer to the site that opened this window, and to that site only. */
export function replyToOpener(
  origin: string,
  nonce: string,
  message: { idToken: string } | { error: string },
): void {
  window.opener?.postMessage(
    'idToken' in message
      ? { type: TOKEN, nonce, idToken: message.idToken }
      : { type: FAILED, nonce, message: message.error },
    origin,
  );
}

