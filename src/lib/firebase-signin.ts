/**
 * Firebase sign-in popup. The Firebase web SDK is loaded only when someone
 * clicks "Continue with Google/GitHub", so it adds nothing to the first page
 * load. We keep no Firebase session: the SDK is used once to get an ID token,
 * the gateway swaps it for its own session, and the Firebase user is signed
 * out again.
 */
import type { SocialConfig } from '../api';

type FirebaseSettings = NonNullable<SocialConfig['firebase']>;

/** Messages for the Firebase errors people can fix themselves. */
const FRIENDLY: Record<string, string> = {
  'auth/popup-closed-by-user': 'The sign-in window was closed before it finished.',
  'auth/cancelled-popup-request': 'The sign-in window was closed before it finished.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
  'auth/unauthorized-domain':
    'This site is not on the Firebase project\'s authorized domains. Add it in Firebase Console > Authentication > Settings.',
  'auth/account-exists-with-different-credential':
    'This e-mail already signs in with a different method. Use that one.',
  'auth/operation-not-allowed': 'This sign-in method is not turned on in the Firebase project.',
  'auth/invalid-api-key': 'The Firebase API key is not valid. Check SETHUCMS_FIREBASE_AUTH_API_KEY on the gateway.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The Firebase API key is not valid. Check SETHUCMS_FIREBASE_AUTH_API_KEY on the gateway.',
  'auth/network-request-failed': 'Could not reach Firebase. Check your connection and any blocker extension.',
  'auth/web-storage-unsupported': 'This browser blocks the storage sign-in needs. Try a normal (not private) window, or allow third-party cookies for this site.',
};

/**
 * Open the popup and return a fresh Firebase ID token.
 * @throws Error with a message that can be shown as it is.
 */
export async function firebaseIdToken(
  settings: FirebaseSettings,
  provider: 'google' | 'github',
): Promise<string> {
  const [{ initializeApp, getApps }, auth] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ]);
  const app =
    getApps().find((candidate) => candidate.name === 'sethucms') ??
    initializeApp(
      {
        apiKey: settings.apiKey,
        authDomain: settings.authDomain,
        projectId: settings.projectId,
      },
      'sethucms',
    );
  const instance = auth.getAuth(app);
  // Nothing is kept in the browser by the SDK after this sign-in.
  await auth.setPersistence(instance, auth.inMemoryPersistence);
  const chosen =
    provider === 'google'
      ? new auth.GoogleAuthProvider()
      : new auth.GithubAuthProvider();
  if (provider === 'google') {
    // Always offer the account chooser, so a shared computer does not sign in
    // as whoever was last signed in to Google.
    chosen.setCustomParameters({ prompt: 'select_account' });
  }
  try {
    const result = await auth.signInWithPopup(instance, chosen);
    return await result.user.getIdToken(true);
  } catch (cause) {
    const code = (cause as { code?: string }).code ?? '';
    // Unknown cases show the Firebase code, so it can be looked up or reported.
    throw new Error(
      FRIENDLY[code] ??
        `Sign-in did not finish${code ? ` (${code})` : ''}. Try again.`,
    );
  } finally {
    await auth.signOut(instance).catch(() => undefined);
  }
}
