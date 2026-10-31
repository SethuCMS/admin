/**
 * Clickable links for the web addresses in a text field. Shown under the field, so the text
 * itself stays exactly as stored and editable.
 */

import { linkLabel, linksIn } from './links';

export function LinkList({ value }: { value: unknown }) {
  const links = typeof value === 'string' ? linksIn(value) : [];
  if (links.length === 0) {
    return null;
  }
  return (
    <ul className="field-links" aria-label="Links in this field">
      {links.map((href) => (
        <li key={href}>
          {/* noreferrer: an address can carry a private key in its query; keep it off other sites. */}
          <a href={href} target="_blank" rel="noopener noreferrer">
            {linkLabel(href)}
          </a>
        </li>
      ))}
    </ul>
  );
}
