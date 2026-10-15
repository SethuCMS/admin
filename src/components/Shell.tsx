/**
 * App layout: collapsible sidebar, top bar and main content area.
 */

import { useEffect, useState, type ReactNode } from 'react';
import type { Route } from '../router';

/**
 * Sidebar items. `adminOnly` hides them from non-admins; the gateway still
 * enforces access. `icon` is a 24x24 path drawn with a 2px stroke.
 */
const NAV: Array<{
  name: Route['name'];
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}> = [
  { name: 'home', href: '#/', label: 'Home', icon: 'M3 11l9-8 9 8M5 10v10h14V10', adminOnly: true },
  { name: 'content', href: '#/content', label: 'Content', icon: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6' },
  { name: 'connections', href: '#/connections', label: 'Connections', icon: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6', adminOnly: true },
  { name: 'migrate', href: '#/migrate', label: 'Move data', icon: 'M4 8h13l-3-3M20 16H7l3 3', adminOnly: true },
  { name: 'access', href: '#/access', label: 'Roles and access', icon: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 010 6M18 14c1.8.6 3 2.4 3 4.5', adminOnly: true },
  { name: 'audit', href: '#/audit', label: 'Audit log', icon: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3', adminOnly: true },
  { name: 'settings', href: '#/settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-1-3-2 .5-1.5-1.5L17 5l-3-1-1 2h-2L10 4 7 5l.5 2.5L6 9l-2-.5-1 3 2 1v2l-2 1 1 3 2-.5L7.5 18 7 20l3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z' },
];

const TITLES: Record<Route['name'], string> = {
  home: 'Home',
  connections: 'Connections',
  connection: 'Connection',
  content: 'Content',
  access: 'Roles and access',
  audit: 'Audit log',
  migrate: 'Move data',
  settings: 'Settings',
};

const COLLAPSE_KEY = 'sethucms.sidebar';

/** The SethuCMS bridge logo (same file as the favicon). */
function Mark() {
  return (
    <img
      className="mark"
      src={`${import.meta.env.BASE_URL}logo.svg`}
      width="34"
      height="34"
      alt=""
    />
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/** Two letters for the avatar: "Kasinadh Sarma" gives "KS". */
function initials(name: string | undefined): string {
  const parts = (name ?? '').split(/[\s._-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? '');
  return (letters.join('') || '?').toUpperCase();
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
 * App chrome: sidebar navigation, a top bar with the page title, and the main
 * content area. The sidebar collapses to icons on wide screens and slides in
 * on narrow ones.
 */
export function Shell({
  route,
  workspaceName,
  userName,
  isAdmin,
  onSignOut,
  children,
}: ShellProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === 'collapsed';
    } catch {
      return false; // storage can be blocked; start expanded
    }
  });
  const [drawer, setDrawer] = useState(false);

  // A route change closes the mobile drawer.
  useEffect(() => setDrawer(false), [route.name]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, value ? 'expanded' : 'collapsed');
      } catch {
        /* the choice just is not remembered */
      }
      return !value;
    });
  };

  // "connection" (one connection's page) highlights the Connections item.
  const active: Route['name'] =
    route.name === 'connection' ? 'connections' : route.name;

  const today = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className={`shell${collapsed ? ' shell-collapsed' : ''}${drawer ? ' shell-drawer' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Sidebar">
        <div className="sidebar-top">
          <a className="brand" href="#/">
            <Mark />
            <span className="label">sethucms</span>
          </a>
          <button
            type="button"
            className="icon-button sidebar-collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon path={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
          </button>
          <button
            type="button"
            className="icon-button sidebar-close"
            onClick={() => setDrawer(false)}
            aria-label="Close menu"
          >
            <Icon path="M6 6l12 12M18 6L6 18" />
          </button>
        </div>

        <div className="workspace-card">
          <span className="workspace-kicker label">Workspace</span>
          <span className="workspace-name label">{workspaceName ?? 'Workspace'}</span>
        </div>

        <nav aria-label="Main">
          <ul className="nav-list">
            {NAV.filter((item) => isAdmin || !item.adminOnly).map((item) => (
              <li key={item.name}>
                <a
                  href={item.href}
                  className="nav-link"
                  title={collapsed ? item.label : undefined}
                  aria-current={item.name === active ? 'page' : undefined}
                >
                  <Icon path={item.icon} />
                  <span className="label">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-foot">
          {userName ? (
            <div className="user label">Signed in as {userName}</div>
          ) : null}
          {onSignOut ? (
            <button type="button" className="link-button label" onClick={onSignOut}>
              Sign out
            </button>
          ) : null}
        </div>
      </aside>
      <button
        type="button"
        className="scrim"
        aria-label="Close menu"
        onClick={() => setDrawer(false)}
      />

      <div className="column">
        <header className="topbar">
          <button
            type="button"
            className="icon-button menu-button"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
          >
            <Icon path="M4 7h16M4 12h16M4 17h16" />
          </button>
          <div className="topbar-title">
            <div className="topbar-date">{today}</div>
            <div className="topbar-page">{TITLES[route.name]}</div>
          </div>
          <div className="avatar" title={userName} aria-hidden="true">
            {initials(userName)}
          </div>
        </header>

        <main id="main" className="main">
          {children}
        </main>
      </div>
    </div>
  );
}
