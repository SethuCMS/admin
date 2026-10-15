/**
 * Plain-language wording for the home headline and audit activity.
 */

import type { Overview } from '../api';

// Spelled out for small counts so headlines read like sentences.
const WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
];

function word(n: number, capital: boolean): string {
  const w = WORDS[n] ?? String(n);
  return capital ? w : w.toLowerCase();
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The headline sentence: what the person needs to know before anything else.
 */
export function summarize(overview: Overview): {
  headline: string;
  allClear: boolean;
} {
  const total = overview.connections.length;
  const healthy = overview.connections.filter(
    (c) => c.health === 'healthy',
  ).length;
  const waiting = overview.reviewQueue.length;

  if (total === 0) {
    return { headline: 'Connect a database to get started.', allClear: false };
  }

  // "No of one connection is healthy" reads badly, so zero has its own wording.
  const unchecked = overview.connections.filter(
    (c) => c.health === 'pending',
  ).length;
  const first =
    healthy === total
      ? `${total === 1 ? 'Your connection is' : `All ${word(total, false)} connections are`} healthy.`
      : healthy === 0
        ? total === 1
          ? unchecked === 1
            ? 'Your connection has not been checked yet.'
            : 'Your connection is not healthy.'
          : `None of your ${word(total, false)} connections are healthy yet.`
        : `${word(healthy, true)} of ${word(total, false)} ${plural(total, 'connection is', 'connections are')} healthy.`;

  const second =
    waiting === 0
      ? 'Nothing is waiting for review.'
      : `${word(waiting, true)} ${plural(waiting, 'collection is', 'collections are')} waiting for review.`;

  return {
    headline: `${first} ${second}`,
    allClear: healthy === total && waiting === 0,
  };
}

// Audit operation ids mapped to plain phrases that complete "<actor> ...".
const OPERATION_PHRASES: Record<string, string> = {
  'record.create': 'created a record in',
  'record.update': 'edited a record in',
  'record.delete': 'deleted a record from',
  'connection.create': 'added the connection',
  'permission.change': 'changed permissions:',
  'secret.read': 'viewed the credentials for',
  'connection.update': 'changed the connection',
  'connection.delete': 'removed the connection',
  'connection.refresh': 'refreshed the structure of',
  'collection.expose': 'added to the API:',
  'collection.hide': 'removed from the API:',
  'draft.create': 'started a draft of',
  'draft.update': 'edited a draft of',
  'draft.discard': 'discarded a draft of',
  'draft.publish': 'published draft',
  'record.publish': 'published a record in',
  'preview.create': 'shared a preview of',
  'token.create': 'created an API token',
  'token.revoke': 'revoked an API token',
  'migration.start': 'started moving data:',
  'migration.finish': 'finished moving data:',
  'migration.cancel': 'stopped moving data:',
};

/**
 * Phrase an audit operation for the activity feed. Unknown operations degrade
 * to a readable form instead of failing.
 */
export function describeOperation(operation: string): string {
  return OPERATION_PHRASES[operation] ?? operation.replace('.', ' ');
}
