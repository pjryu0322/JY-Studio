import type { ProjectAiActionApprovalMode, ProjectAiActionApplyMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ResolvedAiActionPolicy = {
  approvalMode: ProjectAiActionApprovalMode;
  applyMode: ProjectAiActionApplyMode;
};

/** 리뷰어(멤버)에 설정이 없을 때: 승인 자동 실행, 적용 검토 후 실행 */
export const DEFAULT_AI_ACTION_POLICY: ResolvedAiActionPolicy = {
  approvalMode: "AUTO_APPROVE",
  applyMode: "MANUAL_APPLY",
};

export async function resolveAiActionPolicyModes(
  projectId: string,
  _actionType: unknown,
  projectMemberId?: string | null
): Promise<ResolvedAiActionPolicy> {
  const mid = projectMemberId?.trim();
  if (!mid) {
    return { ...DEFAULT_AI_ACTION_POLICY };
  }

  const pm = await prisma.projectMember.findFirst({
    where: { id: mid, projectId },
    select: { aiActionApprovalModeOverride: true, aiActionApplyModeOverride: true },
  });
  if (!pm) {
    return { ...DEFAULT_AI_ACTION_POLICY };
  }

  return {
    approvalMode: pm.aiActionApprovalModeOverride ?? DEFAULT_AI_ACTION_POLICY.approvalMode,
    applyMode: pm.aiActionApplyModeOverride ?? DEFAULT_AI_ACTION_POLICY.applyMode,
  };
}

export function isAiActionAutoApprove(policy: ResolvedAiActionPolicy): boolean {
  return policy.approvalMode === "AUTO_APPROVE";
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

