/**
 * Projects: one person can have several, each a workspace of its own. The
 * gateway keeps the list; this file only asks for it and switches between them.
 */
import { currentWorkspace, enterWorkspace, request, setToken } from './client';
import type { Role } from './wire';

/** One project in a person's list. */
export interface ProjectInfo {
  id: string;
  name: string;
  /** True when this person created it (and may rename or delete it). */
  owner: boolean;
  role: Role | null;
  /** The one open right now. */
  current: boolean;
}

/** The list, with how many projects one person may own. */
export interface ProjectList {
  current: string;
  limit: number;
  projects: ProjectInfo[];
}

/** A session in another project, as the gateway hands it out. */
export interface EnteredProject {
  id: string;
  name?: string;
  role: Role;
  token: string;
  expiresAt: string;
  workspace: string;
}

/** True when this sign-in has projects (workspaces are on). */
export const hasProjects = (): boolean => currentWorkspace() !== null;

export const projectsApi = {
  list: (signal?: AbortSignal) =>
    request<{ data: ProjectList }>('GET', '/v1/projects', { signal }).then(
      (r) => r.data,
    ),
  /** Add the project we are in to our own list (for projects we joined). */
  remember: (signal?: AbortSignal) =>
    request<unknown>('POST', '/v1/projects/remember', { signal }),
  create: (name: string) =>
    request<{ data: EnteredProject }>('POST', '/v1/projects', {
      body: { name },
    }).then((r) => r.data),
  switchTo: (id: string) =>
    request<{ data: EnteredProject }>('POST', `/v1/projects/${id}/switch`).then(
      (r) => r.data,
    ),
  rename: (id: string, name: string) =>
    request<unknown>('PATCH', `/v1/projects/${id}`, { body: { name } }),
  remove: (id: string, confirm: string) =>
    request<unknown>('DELETE', `/v1/projects/${id}`, { body: { confirm } }),
};

/**
 * Work in another project: use its session, then reload so every page starts
 * clean (nothing from the old project stays on screen).
 */
export function enterProject(entered: EnteredProject): void {
  enterWorkspace(entered.workspace);
  setToken(entered.token);
  window.location.hash = entered.role === 'admin' ? '#/' : '#/content';
  window.location.reload();
}
