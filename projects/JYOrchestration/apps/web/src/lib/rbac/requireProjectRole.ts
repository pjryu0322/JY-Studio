import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";
import { resolveProjectRole } from "@/lib/rbac/resolveProjectRole";
import type { ProjectRole } from "@/lib/rbac/projectPermissions";

export async function requireProjectRole(
  projectId: string,
  userId: string,
  allowedRoles: readonly ProjectRole[],
  message: string
): Promise<ProjectRole> {
  const role = await resolveProjectRole(projectId, userId);
  if (!allowedRoles.includes(role)) {
    throw new ProjectAccessDeniedError(message);
  }
  return role;
}
