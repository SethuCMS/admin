/**
 * Session handling: authenticator-code and token sign-in, sign-out and live
 * gateway events.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  enterWorkspace,
  gateway,
  hasToken,
  joiningWorkspace,
  onSessionEnded,
  setToken,
  usingSampleData,
  type GatewayEvent,
  type Me,
  type PersonSetup,
  type SocialConfig,
} from './api';
import { firebaseIdToken } from './lib/firebase-signin';

/** What components get from `useAuth`; `me` is null when signed out. */
interface AuthValue {
  me: Me | null;
  signIn(token: string): Promise<void>;
  /** Sign in with an authenticator-app code. */
  signInWithCode(username: string, code: string): Promise<void>;
  /** Sign in through the Firebase Google or GitHub popup. */
  signInWithFirebase(
    firebase: NonNullable<SocialConfig['firebase']>,
    provider: 'google' | 'github',
  ): Promise<void>;
  /**
   * First start: use the one-time setup token to create the first admin
   * account. The token is not kept; the person then signs in with a code.
   */
  startSetup(setupToken: string, username: string): Promise<PersonSetup>;
  signOut(): void;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Access the signed-in user and sign-in/out actions. Throws outside
 * AuthProvider so a missing provider fails fast.
 */
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}

// "checking" blocks rendering while a stored token is verified.
type Phase = 'checking' | 'ready';

/**
 * Holds the session. On load it verifies any stored token with the gateway
 * before rendering, so the UI never flashes signed-in content for a dead
 * session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [phase, setPhase] = useState<Phase>(
    // Nothing to verify: sample mode or no stored token.
    usingSampleData || !hasToken() ? 'ready' : 'checking',
  );

  const signOut = useCallback(() => {
    // Best effort and not awaited: local sign-out must succeed even if the
    // gateway is unreachable.
    void gateway.logout(); // ends a single sign-on session on the gateway (an API token is left alone)
    setToken(null);
    setMe(null);
  }, []);

  useEffect(() => {
    // The API layer calls this when any request gets a 401, so an expired
    // session drops back to the sign-in screen.
    onSessionEnded(() => setMe(null));
    if (usingSampleData || !hasToken()) {
      return () => onSessionEnded(null);
    }
    gateway
      .me()
      .then(setMe)
      // A rejected stored token just means signed out.
      .catch(() => setMe(null))
      // Always leave "checking", success or not.
      .finally(() => setPhase('ready'));
    return () => onSessionEnded(null);
  }, []);

  const signIn = useCallback(async (token: string) => {
    // Store first because `gateway.me()` reads the token from storage.
    setToken(token.trim());
    try {
      setMe(await gateway.me());
    } catch (error) {
      // Roll back so a bad token is not kept; the caller shows the error.
      setToken(null);
      throw error;
    }
  }, []);

  const signInWithCode = useCallback(async (username: string, code: string) => {
    const session = await gateway.totpLogin(username.trim(), code.trim());
    setToken(session.token);
    try {
      setMe(await gateway.me());
    } catch (error) {
      setToken(null);
      throw error;
    }
  }, []);

  const signInWithFirebase = useCallback(
    async (
      firebase: NonNullable<SocialConfig['firebase']>,
      provider: 'google' | 'github',
    ) => {
      const idToken = await firebaseIdToken(firebase, provider);
      // An invitation link joins that workspace; otherwise, where workspaces
      // are on, everyone signs in to a workspace of their own.
      const joining = joiningWorkspace();
      const session = await gateway.firebaseLogin(
        idToken,
        joining ? { workspace: joining } : firebase.workspaces ? { open: true } : {},
      );
      // Calls from here on go to the person's workspace.
      enterWorkspace(session.workspace);
      setToken(session.token);
      try {
        setMe(await gateway.me());
      } catch (error) {
        setToken(null);
        throw error;
      }
    },
    [],
  );

  const startSetup = useCallback(async (setupToken: string, username: string) => {
    // The token is used for this one request and then dropped.
    setToken(setupToken.trim());
    try {
      return await gateway.createPerson({
        username: username.trim().toLowerCase(),
        role: 'admin',
      });
    } finally {
      setToken(null);
    }
  }, []);

  const value = useMemo(
    () => ({ me, signIn, signInWithCode, signInWithFirebase, startSetup, signOut }),
    [me, signIn, signInWithCode, signInWithFirebase, startSetup, signOut],
  );
  if (phase === 'checking') {
    return (
      <div className="boot" aria-busy="true">
        Signing you in…
      </div>
    );
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Calls `onEvent` for changes made through the gateway. Reconnects with a short
 * delay.
 */
/**
 * Subscribe to live change events from the gateway (server-sent stream). Only
 * runs for a signed-in user, and reconnects after a short delay when the stream
 * drops.
 */
export function useGatewayEvents(
  onEvent: (event: GatewayEvent) => void,
  enabled = true,
): void {
  const { me } = useAuth();
  // Ref keeps the stream open while always calling the newest handler.
  const latest = useRef(onEvent);
  latest.current = onEvent;
  useEffect(() => {
    if (!enabled || !me || usingSampleData) {
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A gateway that cannot stream (serverless answers 501) is not asked again.
    let unsupported = false;

    const connect = () => {
      gateway
        .streamEvents((event) => latest.current(event), controller.signal)
        // Drops are expected (network, deploys); the reconnect below handles
        // them.
        .catch((error: unknown) => {
          const status = (error as { status?: number } | null)?.status;
          unsupported = status === 501 || status === 404;
        })
        .finally(() => {
          // Do not reconnect after cleanup, or when streaming is unsupported.
          if (!controller.signal.aborted && !unsupported) {
            timer = setTimeout(connect, 3000);
          }
        });
    };
    connect();

    return () => {
      controller.abort();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [me, enabled]);
}
