/**
 * Web addresses inside a text field, so they can be opened with one click. Only http and
 * https are ever returned: a `javascript:` or `data:` address in a record must never
 * become a link.
 */

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING = /[.,;:!?)\]}]+$/;

/** The distinct http(s) addresses in `text`, in order, at most `max`. */
export function linksIn(text: string, max = 20): string[] {
  const found: string[] = [];
  for (const raw of text.match(URL_PATTERN) ?? []) {
    const candidate = raw.replace(TRAILING, '');
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        continue;
      }
      if (!found.includes(url.href)) {
        found.push(url.href);
      }
    } catch {
      // Not a usable address; leave it as plain text.
    }
    if (found.length >= max) {
      break;
    }
  }
  return found;
}

/** A short label for a link: the host and the first part of the path, without the query. */
export function linkLabel(href: string): string {
  const url = new URL(href);
  const path = url.pathname === '/' ? '' : url.pathname;
  const label = `${url.host}${path}`;
  return label.length > 48 ? `${label.slice(0, 47)}…` : label;
}
