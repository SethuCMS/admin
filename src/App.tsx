/**
 * App root: authentication gate, shell layout and page routing.
 */

import { useEffect } from 'react';
import { needsGateway, usingSampleData } from './api';
import { AuthProvider, useAuth, useGatewayEvents } from './auth';
import { AccessPage } from './components/AccessPage';
import { AuditPage } from './components/AuditPage';
import { MigratePage } from './components/MigratePage';
import { ComingNext } from './components/ComingNext';
import { ConnectGateway } from './components/ConnectGateway';
import { ConnectionDetailPage } from './components/ConnectionDetailPage';
import { ConnectionsPage } from './components/ConnectionsPage';
import { ContentPage } from './components/ContentPage';
import { HomePage } from './components/HomePage';
import { SettingsPage } from './components/SettingsPage';
import { Shell } from './components/Shell';
import { SignIn } from './components/SignIn';
import { contentOnly } from './lib/mode';
import { useRoute, type Route } from './router';
import { useOverview } from './useOverview';

// Page names, also used for the browser tab title.
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

/** Root component: wraps everything in the auth session. */
export function App() {
  if (needsGateway) {
    return <ConnectGateway />;
  }
  return (
    <AuthProvider>
      <Frame />
    </AuthProvider>
  );
}

/**
 * Chooses between sign-in and the app shell, and owns the overview data shared
 * by the shell and the home page.
 */
function Frame() {
  const { me, signOut } = useAuth();
  const route = useRoute();
  // Keyed by user so signing in as someone else refetches.
  const { state, reload } = useOverview(me?.id ?? 'sample');
  const overview = state.status === 'ready' ? state.overview : undefined;

  useEffect(() => {
    document.title = `${TITLES[route.name]} · SethuCMS admin`;
  }, [route.name]);

  // Keep the home page's numbers fresh when connections change.
  useGatewayEvents((event) => {
    if (event.type === 'connection.changed') {
      reload();
    }
  });

  // Content is edited at /sethu on the website, not in this panel, so a
  // content address here goes back to Home.
  useEffect(() => {
    if (!contentOnly && route.name === 'content') {
      window.location.hash = '#/';
    }
  }, [route.name]);

  // The editor-only build (served at /sethu) shows nothing but Content.
  useEffect(() => {
    if (contentOnly && route.name !== 'content') {
      window.location.hash = '#/content';
    }
  }, [route.name]);

  // Real gateway mode requires a session; sample mode is open.
  if (!usingSampleData && !me) {
    return <SignIn />;
  }

  // Client-side check only to hide pages; the gateway enforces roles.
  const isAdmin = usingSampleData || me?.role === 'admin';

  return (
    <Shell
      route={route}
      workspaceName={overview?.workspaceName}
      userName={overview?.userName ?? me?.name}
      isAdmin={isAdmin}
      onSignOut={usingSampleData ? undefined : signOut}
    >
      <Page
        route={route}
        isAdmin={isAdmin}
        homeState={state}
        reloadHome={reload}
      />
    </Shell>
  );
}

interface PageProps {
  route: Route;
  isAdmin: boolean;
  homeState: ReturnType<typeof useOverview>['state'];
  reloadHome: () => void;
}

/**
 * Render the page for a route, applying the sample-data and admin-only guards
 * first.
 */
function Page({ route, isAdmin, homeState, reloadHome }: PageProps) {
  if (contentOnly && route.name !== 'content') {
    return null; // the redirect to Content is already under way
  }
  if (!contentOnly && route.name === 'content') {
    return null; // the redirect to Home is already under way
  }
  // This panel is for administrators. People who only edit content use /sethu.
  if (!contentOnly && !usingSampleData && !isAdmin) {
    return (
      <ComingNext
        title="Admin panel"
        message="This panel is for administrators. To edit content, open /sethu on your website."
      />
    );
  }
  if (route.name === 'home') {
    return <HomePage state={homeState} onRetry={reloadHome} />;
  }

  // Only the home page works against sample data.
  if (usingSampleData) {
    return (
      <ComingNext
        title={TITLES[route.name]}
        message="This page needs a running gateway. Set VITE_API_URL when building the admin, or open the admin from the gateway itself."
      />
    );
  }

  if (
    !isAdmin &&
    ['connections', 'connection', 'access', 'audit', 'migrate'].includes(
      route.name,
    )
  ) {
    return (
      <ComingNext
        title={TITLES[route.name]}
        message="Only administrators can open this page."
      />
    );
  }

  switch (route.name) {
    case 'connections':
      return <ConnectionsPage />;
    case 'connection':
      return <ConnectionDetailPage connectionId={route.connectionId} />;
    case 'content':
      return <ContentPage route={route} />;
    case 'access':
      return <AccessPage />;
    case 'audit':
      return <AuditPage />;
    case 'migrate':
      return <MigratePage />;
    case 'settings':
      return <SettingsPage />;
  }
}
