/**
 * The project picker in the sidebar: switch between projects and start a new
 * one. Where a person has a single project it is just a name.
 */
import { useState, type FormEvent } from 'react';
import { GatewayError } from '../api';
import { enterProject, projectsApi } from '../api/projects';
import { useAsync } from '../useAsync';

/** Show a safe message for anything that goes wrong. */
export const problem = (error: unknown): string =>
  error instanceof GatewayError
    ? error.message
    : 'Something went wrong. Try again.';

export function ProjectSwitcher({ fallbackName }: { fallbackName?: string }) {
  const { state } = useAsync(async (signal) => {
    // A project we were invited to joins our list the first time we open it.
    await projectsApi.remember(signal).catch(() => undefined);
    return projectsApi.list(signal);
  }, 'projects');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status !== 'ready') {
    return (
      <div className="workspace-card">
        <span className="workspace-kicker label">Project</span>
        <span className="workspace-name label">{fallbackName ?? 'Project'}</span>
      </div>
    );
  }
  const { projects, current, limit } = state.data;
  const owned = projects.filter((project) => project.owner).length;

  const open = async (id: string) => {
    if (id === current) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      enterProject(await projectsApi.switchTo(id));
    } catch (failure) {
      setError(problem(failure));
      setBusy(false);
    }
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      enterProject(await projectsApi.create(name));
    } catch (failure) {
      setError(problem(failure));
      setBusy(false);
    }
  };

  return (
    <div className="workspace-card project-switcher">
      <label className="workspace-kicker label" htmlFor="project-select">
        Project
      </label>
      <select
        id="project-select"
        className="input label"
        value={current}
        disabled={busy}
        onChange={(event) => void open(event.target.value)}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
            {project.owner ? '' : ` (${project.role ?? 'member'})`}
          </option>
        ))}
      </select>
      {adding ? (
        <form className="project-new label" onSubmit={(event) => void create(event)}>
          <input
            className="input"
            value={name}
            maxLength={60}
            required
            autoFocus
            placeholder="Project name"
            aria-label="Project name"
            onChange={(event) => setName(event.target.value)}
          />
          <button className="button" type="submit" disabled={busy || name.trim() === ''}>
            Create
          </button>
          <button
            className="link-button"
            type="button"
            onClick={() => setAdding(false)}
          >
            Cancel
          </button>
        </form>
      ) : owned < limit ? (
        <button
          className="link-button label project-add"
          type="button"
          disabled={busy}
          onClick={() => setAdding(true)}
        >
          New project
        </button>
      ) : (
        <span className="small muted label">
          You own {limit} projects, the most allowed.
        </span>
      )}
      {error ? <span className="field-error label">{error}</span> : null}
    </div>
  );
}
