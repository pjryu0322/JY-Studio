/**
 * Project CRUD / 설정 (API 레이어에서 호출).
 */
import type { Project } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { PROJECT_LIFECYCLE_ACTIVE, PROJECT_LIFECYCLE_DELETED } from "@/lib/project/projectLifecycle";

/** @deprecated 이름 보존용 — 내부적으로 소유 또는 HUMAN 멤버십 프로젝트를 반환합니다. */
export async function listProjectsOrderedByCreatedDesc(
  userId: string,
  options?: { includeDeleted?: boolean }
) {
  return listProjectsAccessibleToUser(userId, options);
}

/** 소유 프로젝트 또는 HUMAN 멤버로 참여 중인 프로젝트(시드·협업 테스트 포함). */
export async function listProjectsAccessibleToUser(
  userId: string,
  options?: { includeDeleted?: boolean }
) {
  const includeDeleted = options?.includeDeleted === true;
  return prisma.project.findMany({
    where: {
      AND: [
        ...(includeDeleted ? [] : [{ status: { not: PROJECT_LIFECYCLE_DELETED } }]),
        {
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
        status: PROJECT_LIFECYCLE_ACTIVE,
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

export type SoftDeletePreviewCounts = {
  taskCount: number;
  aiActionCount: number;
  gitRequestCount: number;
  hasGitWork: boolean;
};

export async function getSoftDeletePreviewCounts(projectId: string): Promise<SoftDeletePreviewCounts> {
  const [taskCount, aiActionCount, gitRequestCount] = await Promise.all([
    prisma.task.count({ where: { projectId } }),
    prisma.projectMemberAction.count({ where: { projectId } }),
    prisma.gitChangeRequest.count({ where: { projectId } }),
  ]);
  return {
    taskCount,
    aiActionCount,
    gitRequestCount,
    hasGitWork: gitRequestCount > 0,
  };
}

export type SoftDeleteProjectResult =
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" }
  | { ok: true; project: Project; alreadyDeleted: boolean };

/** OWNER만 호출. 이미 DELETED면 변경 없이 행 반환. */
export async function softDeleteProjectByOwner(
  projectId: string,
  ownerUserId: string
): Promise<SoftDeleteProjectResult> {
  const row = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerUserId: true, status: true },
  });
  if (!row) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (row.ownerUserId !== ownerUserId) {
    return { ok: false, code: "FORBIDDEN" };
  }
  if (row.status === PROJECT_LIFECYCLE_DELETED) {
    const existing = await prisma.project.findUnique({ where: { id: projectId } });
    if (!existing) {
      return { ok: false, code: "NOT_FOUND" };
    }
    return { ok: true, project: existing, alreadyDeleted: true };
  }
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      status: PROJECT_LIFECYCLE_DELETED,
      deletedAt: new Date(),
      deletedByUserId: ownerUserId,
    },
  });
  return { ok: true, project, alreadyDeleted: false };
}
