import type { ProjectRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";

export type ProjectMemberListItem = {
  memberId: string;
  projectId: string;
  userId: string | null;
  email: string | null;
  displayName: string;
  role: ProjectRole;
  memberType: "HUMAN" | "AI";
  aiProvider: string | null;
  aiAgentKey: string | null;
  invitedByUserId: string | null;
  invitedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  isOwner: boolean;
};

function buildMemberDisplayName(row: {
  memberType: "HUMAN" | "AI";
  displayName: string | null;
  aiAgentKey: string | null;
  user: { name: string; email: string } | null;
}) {
  if (row.memberType === "AI") {
    return row.displayName?.trim() || row.aiAgentKey?.trim() || "AI Member";
  }
  return row.user?.name?.trim() || row.displayName?.trim() || row.user?.email || "Unknown User";
}

export async function listProjectMembers(projectId: string): Promise<ProjectMemberListItem[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerUserId: true },
  });
  if (!project) {
    return [];
  }

  const rows = await prisma.projectMember.findMany({
    where: { projectId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      projectId: true,
      userId: true,
      memberType: true,
      displayName: true,
      role: true,
      aiProvider: true,
      aiAgentKey: true,
      invitedByUserId: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { name: true, email: true } },
      invitedBy: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    memberId: row.id,
    projectId: row.projectId,
    userId: row.userId,
    email: row.user?.email ?? null,
    displayName: buildMemberDisplayName(row),
    role: row.role as ProjectRole,
    memberType: row.memberType,
    aiProvider: row.aiProvider,
    aiAgentKey: row.aiAgentKey,
    invitedByUserId: row.invitedByUserId,
    invitedByName: row.invitedBy?.name ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isOwner: row.userId === project.ownerUserId || row.role === "OWNER",
  }));
}

export async function findProjectMemberRole(projectId: string, userId: string) {
  const row = await prisma.projectMember.findFirst({
    where: { projectId, userId, memberType: "HUMAN" },
    select: { role: true },
  });
  return row?.role ?? null;
}

export async function requireProjectOwnerMemberAdmin(projectId: string, userId: string, action: string) {
  const role = await requireProjectPermission(projectId, userId, "canChangeGitPolicy", action);
  if (role !== "OWNER") {
    throw new ProjectAccessDeniedError("멤버 관리는 OWNER만 수행할 수 있습니다.");
  }
  return role;
}

export async function inviteHumanProjectMember(input: {
  projectId: string;
  email: string;
  role: ProjectRole;
  invitedByUserId: string;
}) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.trim().toLowerCase() },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    throw new ProjectAccessDeniedError("해당 이메일의 사용자를 찾을 수 없습니다.");
  }
  return prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: input.projectId, userId: user.id } },
    create: {
      projectId: input.projectId,
      userId: user.id,
      memberType: "HUMAN",
      role: input.role,
      displayName: user.name,
      invitedByUserId: input.invitedByUserId,
    },
    update: {
      role: input.role,
      displayName: user.name,
      invitedByUserId: input.invitedByUserId,
    },
  });
}

export async function inviteAiProjectMember(input: {
  projectId: string;
  displayName: string;
  role: ProjectRole;
  aiProvider?: string | null;
  aiAgentKey?: string | null;
  invitedByUserId: string;
}) {
  return prisma.projectMember.create({
    data: {
      projectId: input.projectId,
      memberType: "AI",
      role: input.role,
      displayName: input.displayName.trim(),
      aiProvider: input.aiProvider?.trim() || null,
      aiAgentKey: input.aiAgentKey?.trim() || null,
      invitedByUserId: input.invitedByUserId,
    },
  });
}

export async function updateProjectMember(input: {
  memberId: string;
  role?: ProjectRole;
  displayName?: string | null;
}) {
  const data: { role?: ProjectRole; displayName?: string | null } = {};
  if (input.role) data.role = input.role;
  if (input.displayName !== undefined) data.displayName = input.displayName?.trim() || null;
  return prisma.projectMember.update({
    where: { id: input.memberId },
    data,
  });
}

export async function deleteProjectMember(input: { memberId: string }) {
  return prisma.projectMember.delete({
    where: { id: input.memberId },
  });
}
