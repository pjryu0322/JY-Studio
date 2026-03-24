import { getProjectMembersMock } from "@/lib/rbac/mockProjectContext";
import type { ProjectRole } from "@/lib/rbac/projectPermissions";
import { prisma } from "@/lib/prisma";
import { findProjectMemberRole } from "@/lib/service/projectMemberService";

/**
 * Project owner, then DB membership, then (dev only) mock member list.
 * Returns null when the user has no access (no anonymous/legacy-wide OWNER fallback).
 */
export async function resolveProjectRole(
  projectId: string,
  userId: string
): Promise<ProjectRole | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerUserId: true },
  });
  if (!project) {
    return null;
  }
  if (project.ownerUserId === userId) {
    return "OWNER";
  }
  const dbRole = await findProjectMemberRole(projectId, userId);
  if (dbRole) {
    return dbRole as ProjectRole;
  }
  if (process.env.NODE_ENV !== "production") {
    const mockRow = getProjectMembersMock(projectId).find((m) => m.userId === userId);
    if (mockRow) {
      return mockRow.role;
    }
  }
  return null;
}

/** Alias for policy docs / callers that expect this name. */
export async function getProjectMemberRole(
  projectId: string,
  userId: string
): Promise<ProjectRole | null> {
  return resolveProjectRole(projectId, userId);
}
