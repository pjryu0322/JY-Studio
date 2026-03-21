/**
 * Project CRUD / 설정 (API 레이어에서 호출).
 */
import { MOCK_PROJECT_CREATOR_USER_ID } from "@/lib/rbac/constants";
import { prisma } from "@/lib/prisma";

export async function listProjectsOrderedByCreatedDesc() {
  return prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export type CreateProjectInput = {
  name: string;
  description: string | null;
  projectType: string;
  repoUrl: string | null;
  defaultBranch: string;
};

export async function createProject(input: CreateProjectInput) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: input.name,
        description: input.description,
        projectType: input.projectType,
        repoUrl: input.repoUrl,
        defaultBranch: input.defaultBranch,
        status: "ACTIVE",
      },
    });
    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: MOCK_PROJECT_CREATOR_USER_ID,
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
