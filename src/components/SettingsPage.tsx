import { absoluteUrl, askForGateway, forgetGateway, usingSampleData } from '../api';
import { useAuth } from '../auth';
import { hasProjects } from '../api/projects';
import { ProjectsPanel } from './ProjectsPanel';
import { SchemaPanel } from './SchemaPanel';

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
      {hasProjects() && !usingSampleData ? <ProjectsPanel /> : null}
      {me?.role === 'admin' && !usingSampleData ? <SchemaPanel /> : null}
      {askForGateway ? (
        <p>
          <button className="button button-outline" type="button" onClick={forgetGateway}>
            Use a different gateway
          </button>
        </p>
      ) : null}
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
