import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { linkLabel, linksIn } from '../src/components/fields/links.ts';

describe('linksIn', () => {
  it('finds web addresses, drops trailing punctuation and repeats', () => {
    const text = [
      'Sunrise (T-Shirt) (M) x2: https://api.example.com/v1/print/DW1-1?sig=abc123.',
      'See (https://example.com/a), and https://example.com/a again',
    ].join('\n');
    assert.deepEqual(linksIn(text), [
      'https://api.example.com/v1/print/DW1-1?sig=abc123',
      'https://example.com/a',
    ]);
  });

  it('never turns anything but http and https into a link', () => {
    assert.deepEqual(linksIn('javascript:alert(1) data:text/html,<b> file:///etc/passwd ftp://x.test/a'), []);
    assert.deepEqual(linksIn('<a href="javascript:alert(1)">x</a> https://ok.test/x'), ['https://ok.test/x']);
  });

  it('keeps the list short and ignores text without addresses', () => {
    const many = Array.from({ length: 50 }, (_, i) => `https://e.test/${i}`).join(' ');
    assert.equal(linksIn(many, 5).length, 5);
    assert.deepEqual(linksIn('no links here, not even http:/ broken'), []);
    assert.deepEqual(linksIn(''), []);
  });
});

describe('linkLabel', () => {
  it('shows the host and path but not the query, which can hold a key', () => {
    assert.equal(linkLabel('https://api.example.com/v1/print/DW1-1?sig=SECRET'), 'api.example.com/v1/print/DW1-1');
    assert.equal(linkLabel('https://example.com/'), 'example.com');
    assert.ok(linkLabel(`https://example.com/${'a'.repeat(100)}`).endsWith('…'));
  });
});
