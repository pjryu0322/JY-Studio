/**
 * Project CRUD / 설정 (API 레이어에서 호출).
 */
import { prisma } from "@/lib/prisma";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";

/** @deprecated 이름 보존용 — 내부적으로 소유 또는 HUMAN 멤버십 프로젝트를 반환합니다. */
export async function listProjectsOrderedByCreatedDesc(userId: string) {
  return listProjectsAccessibleToUser(userId);
}

/** 소유 프로젝트 또는 HUMAN 멤버로 참여 중인 프로젝트(시드·협업 테스트 포함). */
export async function listProjectsAccessibleToUser(userId: string) {
  return prisma.project.findMany({
    where: {
      OR: [
        { ownerUserId: userId },
        {
          members: {
            some: {
              userId,
              memberType: "HUMAN",
            },
          },
        },
      ],
    },
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
  return requireProjectPermission(projectId, userId, "canEditProject", action);
}
