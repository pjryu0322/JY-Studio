/**
 * Project membership (DB). UI still uses mock lists until read API is exposed.
 */
import { prisma } from "@/lib/prisma";

export async function getProjectMembers(projectId: string) {
  return prisma.projectMember.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
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
