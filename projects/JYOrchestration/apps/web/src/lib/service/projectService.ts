/**
 * Project CRUD / 설정 (API 레이어에서 호출).
 */
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
  return prisma.project.create({
    data: {
      name: input.name,
      description: input.description,
      projectType: input.projectType,
      repoUrl: input.repoUrl,
      defaultBranch: input.defaultBranch,
      status: "ACTIVE",
    },
  });
}

export async function projectIdExists(id: string): Promise<boolean> {
  const row = await prisma.project.findUnique({
    where: { id },
    select: { id: true },
  });
  return Boolean(row);
}
