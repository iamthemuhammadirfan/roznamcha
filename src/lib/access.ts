// Which projects a munshi works on. The owner chooses "All projects" (every project,
// new ones too) or a list. Owners always have every project. The server enforces the
// same rule (private.can_access_project), so this only decides what the screens show.

export interface ProjectAccess {
  all: boolean;
  /** Picked project ids; kept while `all` is on, so switching it off restores them. */
  ids: string[];
}

export const NO_ACCESS: ProjectAccess = { all: false, ids: [] };

/** A member's access from their membership row and the picks synced for them. */
export function accessOf(
  member: { id: string; role: string; all_projects: boolean | null },
  picks: { membership_id: string; project_id: string }[],
): ProjectAccess {
  return {
    all: member.role === 'owner' || Boolean(member.all_projects),
    ids: picks.filter((p) => p.membership_id === member.id).map((p) => p.project_id),
  };
}

export function canSee(access: ProjectAccess, projectId: string) {
  return access.all || access.ids.includes(projectId);
}

/** The project ids to add and remove to turn `before` into `after`. */
export function pickChanges(before: string[], after: string[]) {
  const was = new Set(before);
  const now = new Set(after);
  return {
    add: [...now].filter((id) => !was.has(id)),
    remove: [...was].filter((id) => !now.has(id)),
  };
}

/** Toggle one project in a list of picks. */
export function togglePick(ids: string[], projectId: string) {
  return ids.includes(projectId) ? ids.filter((id) => id !== projectId) : [...ids, projectId];
}

/**
 * How many projects the access covers, counting only projects that exist on this phone
 * (a pick for a project the owner later deleted doesn't count). `all` for everything.
 */
export function accessCount(access: ProjectAccess, projectIds: string[]): number | 'all' {
  if (access.all) return 'all';
  const picked = new Set(access.ids);
  return projectIds.filter((id) => picked.has(id)).length;
}
