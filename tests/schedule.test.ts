import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pickProblem, suggestedTime, toLocalInput } from '../src/lib/schedule.ts';

describe('toLocalInput', () => {
  it('writes local time the way a datetime-local box expects', () => {
    assert.equal(toLocalInput(new Date(2026, 10, 5, 9, 7)), '2026-11-05T09:07');
    assert.equal(toLocalInput(new Date(2026, 0, 2, 23, 59)), '2026-01-02T23:59');
  });
});

describe('suggestedTime', () => {
  it('is the next whole hour, at least 30 minutes away', () => {
    assert.equal(suggestedTime(new Date(2026, 10, 5, 9, 0)), '2026-11-05T10:00');
    assert.equal(suggestedTime(new Date(2026, 10, 5, 9, 29)), '2026-11-05T10:00');
    assert.equal(suggestedTime(new Date(2026, 10, 5, 9, 31)), '2026-11-05T11:00');
    assert.equal(suggestedTime(new Date(2026, 10, 5, 23, 45)), '2026-11-06T01:00');
  });
});

describe('pickProblem', () => {
  const now = new Date(2026, 10, 5, 9, 0).getTime();
  it('accepts a future time', () => {
    assert.equal(pickProblem('2026-11-05T09:01', now), null);
  });
  it('refuses empty, nonsense and past or present times', () => {
    assert.match(pickProblem('', now) ?? '', /date and time/);
    assert.match(pickProblem('soon', now) ?? '', /date and time/);
    assert.match(pickProblem('2026-11-05T09:00', now) ?? '', /future/);
    assert.match(pickProblem('2020-01-01T10:00', now) ?? '', /future/);
  });
});
