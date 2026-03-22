/**
 * Project membership (DB). UI still uses mock lists until read API is exposed.
 */
import { getProjectMembersMock } from "@/lib/rbac/mockProjectContext";
import type { ProjectRole } from "@/lib/rbac/projectPermissions";
import { prisma } from "@/lib/prisma";

export type ProjectMemberListItem = {
  userId: string;
  role: ProjectRole;
  source: "db" | "mock";
};

export async function getProjectMembers(projectId: string) {
  return prisma.projectMember.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
}

/** DB rows when present; otherwise mock members for empty projects (dev / RBAC parity). */
export async function listProjectMembers(projectId: string): Promise<ProjectMemberListItem[]> {
  const rows = await prisma.projectMember.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: { userId: true, role: true },
  });
  if (rows.length > 0) {
    return rows.map((r) => ({
      userId: r.userId,
      role: r.role as ProjectRole,
      source: "db" as const,
    }));
  }
  return getProjectMembersMock(projectId).map((m) => ({
    userId: m.userId,
    role: m.role,
    source: "mock" as const,
  }));
}

/** Returns null when no membership row exists (caller may default to OWNER for legacy projects). */
export async function findProjectMemberRole(projectId: string, userId: string) {
  const row = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
    select: { role: true },
  });
  return row?.role ?? null;
}
