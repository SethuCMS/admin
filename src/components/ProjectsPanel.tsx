/**
 * Settings: the person's projects, with rename and delete for the ones they
 * own. Deleting locks a project (nobody can sign in to it any more); its data
 * stays in its database until the owner removes it there.
 */
import { useState } from 'react';
import { projectsApi, type ProjectInfo } from '../api/projects';
import { useAsync } from '../useAsync';
import { problem } from './ProjectSwitcher';

/** One project row: name, role and the owner's rename and delete controls. */
function ProjectRow({
  project,
  first,
  onChanged,
}: {
  project: ProjectInfo;
  first: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(done);
      onChanged();
    } catch (failure) {
      setMessage(problem(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="schema-collection project-row">
      <summary>
        {project.name}
        <span className="small muted">
          {' '}
          {project.owner ? 'you own it' : (project.role ?? 'member')}
          {project.current ? ', open now' : ''}
        </span>
      </summary>
      {project.owner ? (
        <div className="project-actions">
          <label className="field">
            <span>Name</span>
            <input
              className="input"
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button
            className="button button-outline"
            type="button"
            disabled={busy || name.trim() === '' || name === project.name}
            onClick={() =>
              void run(() => projectsApi.rename(project.id, name), 'Renamed.')
            }
          >
            Save name
          </button>
          {first ? (
            <p className="small muted">Your first project cannot be deleted.</p>
          ) : (
            <>
              <label className="field">
                <span>Type “{project.name}” to delete it</span>
                <input
                  className="input"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </label>
              <button
                className="button button-outline"
                type="button"
                disabled={busy || confirm !== project.name || project.current}
                onClick={() =>
                  void run(
                    () => projectsApi.remove(project.id, confirm),
                    'Deleted.',
                  )
                }
              >
                Delete project
              </button>
              {project.current ? (
                <p className="small muted">Switch to another project first.</p>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <p className="small muted">
          Only the person who created this project can rename or delete it.
        </p>
      )}
      {message ? <p className="small" role="status">{message}</p> : null}
    </details>
  );
}

export function ProjectsPanel() {
  const { state, reload } = useAsync(
    (signal) => projectsApi.list(signal),
    'projects-panel',
  );
  if (state.status === 'error') {
    return null;
  }
  if (state.status !== 'ready') {
    return <p className="muted">Loading projects…</p>;
  }
  const { projects, limit } = state.data;
  const owned = projects.filter((project) => project.owner).length;
  return (
    <section className="schema-panel" aria-label="Projects">
      <h2>Projects</h2>
      <p className="muted">
        You own {owned} of {limit} projects. Each has its own database
        connections, people and content. Use the project menu in the sidebar to
        switch or start a new one.
      </p>
      {projects.map((project, index) => (
        <ProjectRow
          key={`${project.id}:${project.name}`}
          project={project}
          first={index === 0}
          onChanged={reload}
        />
      ))}
    </section>
  );
}
