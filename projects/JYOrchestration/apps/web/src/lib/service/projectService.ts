/**
 * Project CRUD / 설정 (API 레이어에서 호출).
 */
import { prisma } from "@/lib/prisma";
import { requireProjectOwnedByUser } from "@/lib/service/taskOwnershipGuard";

export async function listProjectsOrderedByCreatedDesc(ownerUserId: string) {
  return prisma.project.findMany({
    where: { ownerUserId },
    orderBy: { createdAt: "desc" },
  });
}

export type CreateProjectInput = {
  name: string;
  description: string | null;
  projectType: string;
  repoUrl: string | null;
  defaultBranch: string;
  ownerUserId: string;
};

export async function createProject(input: CreateProjectInput) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: input.name,
        description: input.description,
        ownerUserId: input.ownerUserId,
        projectType: input.projectType,
        repoUrl: input.repoUrl,
        defaultBranch: input.defaultBranch,
        status: "ACTIVE",
      },
    });
    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: input.ownerUserId,
        role: "OWNER",
      },
    });
    return project;
  });
}

export async function projectIdExists(id: string): Promise<boolean> {
  const row = await prisma.project.findUnique({
    where: { id },
    select: { id: true },
  });
  return Boolean(row);
}

export async function requireOwnedProject(projectId: string, userId: string, action: string) {
  return requireProjectOwnedByUser(projectId, userId, action);
}
