import type { AiMemberActionType, ProjectAiActionApprovalMode, ProjectAiActionApplyMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AiMemberActionTypeId } from "@/lib/ai-member/aiMemberActionTypes";

export type ResolvedAiActionPolicy = {
  approvalMode: ProjectAiActionApprovalMode;
  applyMode: ProjectAiActionApplyMode;
};

const ALL_ACTION_TYPES: AiMemberActionType[] = [
  "REVIEW_REQUEST",
  "TASK_DRAFT_REQUEST",
  "QA_CHECK_REQUEST",
  "SUMMARY_REQUEST",
];

/** DB 행이 없을 때: 승인 자동, 적용 수동 */
export const DEFAULT_AI_ACTION_POLICY: ResolvedAiActionPolicy = {
  approvalMode: "AUTO_APPROVE",
  applyMode: "MANUAL_APPLY",
};

export async function resolveAiActionPolicyModes(
  projectId: string,
  actionType: AiMemberActionType | AiMemberActionTypeId,
  _projectMemberId?: string | null
): Promise<ResolvedAiActionPolicy> {
  void _projectMemberId;
  const row = await prisma.projectAiActionPolicy.findUnique({
    where: {
      projectId_actionType: { projectId, actionType: actionType as AiMemberActionType },
    },
    select: { approvalMode: true, applyMode: true },
  });
  if (!row) {
    return { ...DEFAULT_AI_ACTION_POLICY };
  }
  return { approvalMode: row.approvalMode, applyMode: row.applyMode };
}

export function isAiActionAutoApprove(policy: ResolvedAiActionPolicy): boolean {
  return policy.approvalMode === "AUTO_APPROVE";
}

export async function getProjectAiActionPolicies(projectId: string) {
  const rows = await prisma.projectAiActionPolicy.findMany({
    where: { projectId },
    orderBy: { actionType: "asc" },
  });
  const byType = new Map(rows.map((r) => [r.actionType, r]));
  return ALL_ACTION_TYPES.map((actionType) => {
    const r = byType.get(actionType);
    return {
      projectId,
      actionType,
      approvalMode: r?.approvalMode ?? DEFAULT_AI_ACTION_POLICY.approvalMode,
      applyMode: r?.applyMode ?? DEFAULT_AI_ACTION_POLICY.applyMode,
      persisted: Boolean(r),
    };
  });
}

export function parseProjectAiActionApprovalMode(v: unknown): ProjectAiActionApprovalMode | null {
  if (v === "AUTO_APPROVE" || v === "MANUAL_REVIEW") {
    return v;
  }
  return null;
}

export function parseProjectAiActionApplyMode(v: unknown): ProjectAiActionApplyMode | null {
  if (v === "AUTO_APPLY" || v === "MANUAL_APPLY") {
    return v;
  }
  return null;
}

export async function upsertProjectAiActionPolicy(input: {
  projectId: string;
  actionType: AiMemberActionType | AiMemberActionTypeId;
  approvalMode: ProjectAiActionApprovalMode;
  applyMode: ProjectAiActionApplyMode;
}) {
  return prisma.projectAiActionPolicy.upsert({
    where: {
      projectId_actionType: {
        projectId: input.projectId,
        actionType: input.actionType as AiMemberActionType,
      },
    },
    create: {
      projectId: input.projectId,
      actionType: input.actionType as AiMemberActionType,
      approvalMode: input.approvalMode,
      applyMode: input.applyMode,
    },
    update: {
      approvalMode: input.approvalMode,
      applyMode: input.applyMode,
    },
  });
}
