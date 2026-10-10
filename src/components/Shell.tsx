/**
 * App layout: sidebar navigation and main content area.
 */

import type { ReactNode } from 'react';
import type { Route } from '../router';

/**
 * Sidebar items. `adminOnly` hides them from non-admins; the gateway still
 * enforces access.
 */
const NAV: Array<{
  name: Route['name'];
  href: string;
  label: string;
  adminOnly?: boolean;
}> = [
  { name: 'home', href: '#/', label: 'Home' },
  { name: 'content', href: '#/content', label: 'Content' },
  {
    name: 'connections',
    href: '#/connections',
    label: 'Connections',
    adminOnly: true,
  },
  { name: 'migrate', href: '#/migrate', label: 'Move data', adminOnly: true },
  {
    name: 'access',
    href: '#/access',
    label: 'Roles and access',
    adminOnly: true,
  },
  { name: 'audit', href: '#/audit', label: 'Audit log', adminOnly: true },
  { name: 'settings', href: '#/settings', label: 'Settings' },
];

/**
 * The four-square mark: one filled square, three open ones. Echoes the
 * capability grid.
 */
function Mark() {
  return (
    <svg
      className="mark"
      viewBox="0 0 32 32"
      width="26"
      height="26"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="12" height="12" fill="currentColor" />
      <rect
        x="17"
        y="3"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <rect
        x="3"
        y="17"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <rect
        x="17"
        y="17"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  );
}

/** Page route plus signed-in context for the sidebar. */
interface ShellProps {
  route: Route;
  workspaceName?: string | undefined;
  userName?: string | undefined;
  isAdmin: boolean;
  onSignOut?: (() => void) | undefined;
  children: ReactNode;
}

/**
 * App chrome: sidebar navigation and the main content area.
 */
export function Shell({
  route,
  workspaceName,
  userName,
  isAdmin,
  onSignOut,
  children,
}: ShellProps) {
  // "connection" (one connection's page) highlights the Connections item.
  // Detail pages keep their parent nav item highlighted.
  const active: Route['name'] =
    route.name === 'connection' ? 'connections' : route.name;

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="sidebar">
        <a className="brand" href="#/">
          <Mark />
          <span>sethucms</span>
        </a>

        <nav aria-label="Main">
          <ul className="nav-list">
            {NAV.filter((item) => isAdmin || !item.adminOnly).map((item) => (
              <li key={item.name}>
                <a
                  href={item.href}
                  className="nav-link"
                  aria-current={item.name === active ? 'page' : undefined}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-foot">
          <div className="workspace">{workspaceName ?? 'Workspace'}</div>
          {userName ? (
            <div className="user">Signed in as {userName}</div>
          ) : null}
          {onSignOut ? (
            <button type="button" className="link-button" onClick={onSignOut}>
              Sign out
            </button>
          ) : null}
        </div>
      </aside>

      <main id="main" className="main">
        {children}
      </main>
    </div>
  );
}
