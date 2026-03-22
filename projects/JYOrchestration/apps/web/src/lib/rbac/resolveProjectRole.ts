import { findProjectMemberRole } from "@/lib/service/projectMemberService";
import { getProjectMembersMock } from "@/lib/rbac/mockProjectContext";
import type { ProjectRole } from "@/lib/rbac/projectPermissions";

/**
 * DB membership first, then mock member list (dev parity with UI), else OWNER for legacy projects.
 */
export async function resolveProjectRole(projectId: string, userId: string): Promise<ProjectRole> {
  const dbRole = await findProjectMemberRole(projectId, userId);
  if (dbRole) {
    return dbRole as ProjectRole;
  }
  const mockRow = getProjectMembersMock(projectId).find((m) => m.userId === userId);
  if (mockRow) {
    return mockRow.role;
  }
  return "OWNER";
}

/** Alias for policy docs / callers that expect this name. */
export async function getProjectMemberRole(
  projectId: string,
  userId: string
): Promise<ProjectRole> {
  return resolveProjectRole(projectId, userId);
}
