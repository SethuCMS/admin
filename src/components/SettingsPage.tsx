/**
 * Settings page.
 */

import { absoluteUrl, usingSampleData } from '../api';
import { useAuth } from '../auth';

/**
 * Shows which gateway the admin talks to and who is signed in.
 */
export function SettingsPage() {
  const { me, signOut } = useAuth();
  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <dl className="facts">
        <div>
          <dt>Gateway</dt>
          <dd>
            <code>
              {usingSampleData ? 'Sample data (no gateway)' : absoluteUrl('/')}
            </code>
          </dd>
        </div>
        {me ? (
          <div>
            <dt>Signed in as</dt>
            <dd>
              {me.name} <span className="muted">· {me.role}</span>
            </dd>
          </div>
        ) : null}
      </dl>
      {me ? (
        <p>
          <button
            className="button button-outline"
            type="button"
            onClick={signOut}
          >
            Sign out
          </button>
        </p>
      ) : null}
    </div>
  );
}
