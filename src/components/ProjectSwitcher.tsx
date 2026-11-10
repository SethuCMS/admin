/**
 * The project picker in the sidebar: see which project you are in, open
 * another, or start a new one. The list opens in place under the button, so it
 * works the same in the narrow menu on a phone.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { GatewayError } from '../api';
import { enterProject, projectsApi, type ProjectInfo } from '../api/projects';
import { useAsync } from '../useAsync';

/** Show a safe message for anything that goes wrong. */
export const problem = (error: unknown): string =>
  error instanceof GatewayError
    ? error.message
    : 'Something went wrong. Try again.';

const ROLE_LABEL = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' } as const;

/** What to show beside a project: owner, or the person's role in a shared one. */
const meta = (project: ProjectInfo): string =>
  project.owner ? 'Owner' : ROLE_LABEL[project.role ?? 'viewer'];

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`project-chevron${open ? ' is-open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

export function ProjectSwitcher({ fallbackName }: { fallbackName?: string }) {
  const { state } = useAsync(async (signal) => {
    // A project we were invited to joins our list the first time we open it.
    await projectsApi.remember(signal).catch(() => undefined);
    return projectsApi.list(signal);
  }, 'projects');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  // The project being opened (its id), or 'new' while one is being made.
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Close on Escape or a click outside, and give focus back to the button.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pending === null) {
        setOpen(false);
        setAdding(false);
        trigger.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (pending === null && root.current && !root.current.contains(event.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, pending]);

  if (state.status !== 'ready') {
    return (
      <div className="workspace-card">
        <span className="workspace-kicker label">Project</span>
        <span className="workspace-name label">
          {state.status === 'error' ? (fallbackName ?? 'Project') : (fallbackName ?? 'Loading…')}
        </span>
      </div>
    );
  }
  const { projects, current, limit } = state.data;
  const here = projects.find((project) => project.id === current);
  const owned = projects.filter((project) => project.owner).length;
  const busy = pending !== null;

  const openProject = async (project: ProjectInfo) => {
    if (project.id === current || busy) {
      return;
    }
    setPending(project.id);
    setError(null);
    try {
      await enterProject(await projectsApi.switchTo(project.id));
    } catch (failure) {
      setError(`${project.name} could not be opened. ${problem(failure)}`);
      setPending(null);
    }
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    setPending('new');
    setError(null);
    try {
      await enterProject(await projectsApi.create(name));
    } catch (failure) {
      setError(`The project could not be created. ${problem(failure)}`);
      setPending(null);
    }
  };

  return (
    <div className="workspace-card project-switcher" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="project-trigger"
        aria-expanded={open}
        aria-controls="project-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="project-trigger-text label">
          <span className="workspace-kicker">Project</span>
          <span className="workspace-name">{here?.name ?? fallbackName ?? 'Project'}</span>
        </span>
        <Chevron open={open} />
      </button>

      {open ? (
        <div id="project-panel" className="project-panel label">
          <ul className="project-list">
            {projects.map((project) => {
              const isCurrent = project.id === current;
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    className={`project-row${isCurrent ? ' is-current' : ''}`}
                    aria-current={isCurrent ? 'true' : undefined}
                    disabled={busy && pending !== project.id}
                    onClick={() => void openProject(project)}
                  >
                    <span className="project-row-name">{project.name}</span>
                    <span className="project-row-meta">
                      {pending === project.id ? 'Opening…' : isCurrent ? <Check /> : meta(project)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {adding ? (
            <form className="project-new" onSubmit={(event) => void create(event)}>
              <input
                className="input"
                value={name}
                maxLength={60}
                required
                autoFocus
                placeholder="Project name"
                aria-label="Project name"
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
              />
              <div className="project-new-actions">
                <button className="button button-small" type="submit" disabled={busy || name.trim() === ''}>
                  {pending === 'new' ? 'Creating…' : 'Create project'}
                </button>
                <button className="link-button" type="button" disabled={busy} onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : owned < limit ? (
            <button className="project-add" type="button" disabled={busy} onClick={() => setAdding(true)}>
              <span aria-hidden="true">+</span> New project
            </button>
          ) : (
            <p className="project-limit">You own {limit} projects, the most allowed.</p>
          )}

          {error ? (
            <p className="project-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
