import type { Prisma, ProjectAiActionApprovalMode, ProjectAiActionApplyMode } from "@prisma/client";
import type { ProjectRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import { platformUserDisplayName } from "@/lib/user/platformProfile";

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
  aiOrchestrationRole: string | null;
  orchestrationStage: string | null;
  aiModelOverride: string | null;
  orchestrationEnabled: boolean;
  aiActionApprovalModeOverride: string | null;
  aiActionApplyModeOverride: string | null;
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
  user: { name: string; email: string; nickname: string | null } | null;
}) {
  if (row.memberType === "AI") {
    return row.displayName?.trim() || row.aiAgentKey?.trim() || "AI Member";
  }
  const fromUser = row.user ? platformUserDisplayName(row.user.nickname, row.user.name) : "";
  return fromUser || row.displayName?.trim() || row.user?.email || "Unknown User";
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
      aiOrchestrationRole: true,
      orchestrationStage: true,
      aiModelOverride: true,
      orchestrationEnabled: true,
      aiActionApprovalModeOverride: true,
      aiActionApplyModeOverride: true,
      invitedByUserId: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { name: true, nickname: true, email: true } },
      invitedBy: { select: { name: true, nickname: true } },
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
    aiOrchestrationRole: row.aiOrchestrationRole,
    orchestrationStage: row.orchestrationStage,
    aiModelOverride: row.aiModelOverride,
    orchestrationEnabled: row.orchestrationEnabled,
    aiActionApprovalModeOverride: row.aiActionApprovalModeOverride,
    aiActionApplyModeOverride: row.aiActionApplyModeOverride,
    invitedByUserId: row.invitedByUserId,
    invitedByName: row.invitedBy
      ? platformUserDisplayName(row.invitedBy.nickname, row.invitedBy.name)
      : null,
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
    select: { id: true, name: true, nickname: true, email: true },
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
      displayName: platformUserDisplayName(user.nickname, user.name),
      invitedByUserId: input.invitedByUserId,
    },
    update: {
      role: input.role,
      displayName: platformUserDisplayName(user.nickname, user.name),
      invitedByUserId: input.invitedByUserId,
    },
  });
}

/**
 * 프로젝트 생성 시 spec 단계 기본 AI(planner) 멤버.
 * `aiOrchestrationRole` + `orchestrationStage` 조합으로 동일 프로젝트 내 중복 생성을 막습니다.
 */
export async function ensureDefaultAiPlannerProjectMember(
  tx: Prisma.TransactionClient,
  input: { projectId: string; invitedByUserId: string }
) {
  const existing = await tx.projectMember.findFirst({
    where: {
      projectId: input.projectId,
      memberType: "AI",
      aiOrchestrationRole: "planner",
      orchestrationStage: "spec",
    },
    select: { id: true },
  });
  if (existing) {
    return existing;
  }
  return tx.projectMember.create({
    data: {
      projectId: input.projectId,
      memberType: "AI",
      role: "EDITOR",
      displayName: getWorkspaceAiMember("ideation")?.title ?? "AI 기획자",
      aiProvider: "openai",
      aiOrchestrationRole: "planner",
      orchestrationStage: "spec",
      orchestrationEnabled: true,
      invitedByUserId: input.invitedByUserId,
    },
    select: { id: true },
  });
}

export async function inviteAiProjectMember(input: {
  projectId: string;
  displayName: string;
  role: ProjectRole;
  aiProvider?: string | null;
  aiAgentKey?: string | null;
  aiOrchestrationRole?: string | null;
  orchestrationStage?: string | null;
  aiModelOverride?: string | null;
  orchestrationEnabled?: boolean;
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
      aiOrchestrationRole: input.aiOrchestrationRole?.trim() || null,
      orchestrationStage: input.orchestrationStage?.trim() || null,
      aiModelOverride: input.aiModelOverride?.trim() || null,
      orchestrationEnabled: input.orchestrationEnabled ?? true,
      invitedByUserId: input.invitedByUserId,
    },
  });
}

export async function updateProjectMember(input: {
  memberId: string;
  role?: ProjectRole;
  displayName?: string | null;
  aiOrchestrationRole?: string | null;
  orchestrationStage?: string | null;
  aiModelOverride?: string | null;
  orchestrationEnabled?: boolean;
  aiActionApprovalModeOverride?: ProjectAiActionApprovalMode | null;
  aiActionApplyModeOverride?: ProjectAiActionApplyMode | null;
}) {
  const data: {
    role?: ProjectRole;
    displayName?: string | null;
    aiOrchestrationRole?: string | null;
    orchestrationStage?: string | null;
    aiModelOverride?: string | null;
    orchestrationEnabled?: boolean;
    aiActionApprovalModeOverride?: ProjectAiActionApprovalMode | null;
    aiActionApplyModeOverride?: ProjectAiActionApplyMode | null;
  } = {};
  if (input.role) data.role = input.role;
  if (input.displayName !== undefined) data.displayName = input.displayName?.trim() || null;
  if (input.aiOrchestrationRole !== undefined) {
    data.aiOrchestrationRole = input.aiOrchestrationRole?.trim() || null;
  }
  if (input.orchestrationStage !== undefined) {
    data.orchestrationStage = input.orchestrationStage?.trim() || null;
  }
  if (input.aiModelOverride !== undefined) {
    data.aiModelOverride = input.aiModelOverride?.trim() || null;
  }
  if (input.orchestrationEnabled !== undefined) data.orchestrationEnabled = input.orchestrationEnabled;
  if (input.aiActionApprovalModeOverride !== undefined) {
    data.aiActionApprovalModeOverride = input.aiActionApprovalModeOverride;
  }
  if (input.aiActionApplyModeOverride !== undefined) {
    data.aiActionApplyModeOverride = input.aiActionApplyModeOverride;
  }
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
