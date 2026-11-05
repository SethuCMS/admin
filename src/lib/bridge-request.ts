/** Reading the bridge window's request from its address (no app imports, so it can be tested). */

export type Provider = 'google' | 'github';

/** What the bridge window reads from its own address. */
export function readBridgeRequest(hash: string): {
  provider: Provider;
  origin: string;
  nonce: string;
  workspace: string | null;
} | null {
  const query = hash.split('?')[1] ?? '';
  const params = new URLSearchParams(query);
  const provider = params.get('provider');
  const origin = params.get('origin') ?? '';
  const nonce = params.get('nonce') ?? '';
  if ((provider !== 'google' && provider !== 'github') || !/^[0-9a-f]{32}$/.test(nonce)) {
    return null;
  }
  try {
    const url = new URL(origin);
    if (url.origin !== origin) {
      return null;
    }
  } catch {
    return null;
  }
  return { provider, origin, nonce, workspace: params.get('workspace') };
}

