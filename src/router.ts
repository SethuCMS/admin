/**
 * Hash-based routing: maps `#/section/...` addresses to typed routes.
 */

import { useEffect, useState } from 'react';

/**
 * Every page the admin can show. The route lives in the URL hash so that links,
 * reloads and the back button work without a server-side router.
 */
export type Route =
  | { name: 'home' }
  | { name: 'connections' }
  | { name: 'connection'; connectionId: string }
  | {
      name: 'content';
      connectionId?: string;
      collection?: string;
      recordId?: string;
    }
  | { name: 'dashboard' }
  | { name: 'designwear' }
  | { name: 'access' }
  | { name: 'audit' }
  | { name: 'migrate' }
  | { name: 'settings' };

/** Read the current address (`#/content/conn_1/articles/42`) into a route. */
export function parseRoute(hash: string): Route {
  // Segments are percent-decoded so ids containing "/" or spaces round-trip; a
  // malformed escape is kept as-is instead of throwing.
  const parts = hash
    .replace(/^#/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
  const [first, a, b, c] = parts;
  switch (first) {
    case 'connections':
      return a
        ? { name: 'connection', connectionId: a }
        : { name: 'connections' };
    case 'content':
      return {
        name: 'content',
        ...(a ? { connectionId: a } : {}),
        ...(b ? { collection: b } : {}),
        ...(c ? { recordId: c } : {}),
      };
    case 'dashboard':
      return { name: 'dashboard' };
    case 'designwear':
      return { name: 'designwear' };
    case 'access':
      return { name: 'access' };
    case 'audit':
      return { name: 'audit' };
    case 'migrate':
      return { name: 'migrate' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'home' };
  }
}

/**
 * Build the address of a content page. Segments are optional but ordered, so a
 * record id is only included after its collection.
 */
export const contentHref = (
  connectionId?: string,
  collection?: string,
  recordId?: string,
): string =>
  '#/content' +
  [connectionId, collection, recordId]
    .filter((part): part is string => Boolean(part))
    .map((part) => `/${encodeURIComponent(part)}`)
    .join('');

/**
 * Go to another page. Setting the hash (not pushState) fires `hashchange`,
 * which `useRoute` listens for.
 */
export function navigate(hash: string): void {
  window.location.hash = hash.replace(/^#/, '');
}

/**
 * Subscribe to the current route and re-render when the hash changes.
 */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.hash),
  );
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
