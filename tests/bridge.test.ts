import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readBridgeRequest } from '../src/lib/bridge-request.ts';

const nonce = 'a'.repeat(32);

describe('readBridgeRequest', () => {
  it('reads a good request', () => {
    const r = readBridgeRequest(`#/bridge?provider=google&origin=${encodeURIComponent('https://shop.test')}&nonce=${nonce}`);
    assert.deepEqual(r, { provider: 'google', origin: 'https://shop.test', nonce, workspace: null });
  });

  it('refuses a missing nonce, an unknown provider, or an origin with a path', () => {
    assert.equal(readBridgeRequest(`#/bridge?provider=google&origin=https%3A%2F%2Fa.test`), null);
    assert.equal(readBridgeRequest(`#/bridge?provider=evil&origin=https%3A%2F%2Fa.test&nonce=${nonce}`), null);
    assert.equal(readBridgeRequest(`#/bridge?provider=github&origin=${encodeURIComponent('https://a.test/x')}&nonce=${nonce}`), null);
    assert.equal(readBridgeRequest(`#/bridge?provider=github&origin=nonsense&nonce=${nonce}`), null);
  });
});
