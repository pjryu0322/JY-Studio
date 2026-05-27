import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import { sanitizeUserFacingOrchestrationText } from "@/lib/ui/userFacingOrchestrationText";

export const STATUS_REVIEW_USER_COPY = {
  candidate: "사용자 확인 후 확정이 필요합니다.",
  needsReview: "보완 또는 재검토가 필요합니다.",
} as const;

export function appendStatusReviewUserLines(
  status: "confirmed" | "candidate" | "needs_review" | "deferred",
  target: string[],
): void {
  if (status === "candidate") target.push(STATUS_REVIEW_USER_COPY.candidate);
  if (status === "needs_review") target.push(STATUS_REVIEW_USER_COPY.needsReview);
}

export type ImplementationSeedUserSummary = Readonly<{
  readonly status: "confirmed" | "candidate" | "needs_review";
  readonly summary: string;
  readonly reasons: readonly string[];
  readonly unresolvedItems: readonly string[];
  readonly nextActions: readonly string[];
}>;

export function summarizeImplementationSeedForUser(seed: ImplementationSeedV1): ImplementationSeedUserSummary {
  const status: ImplementationSeedUserSummary["status"] =
    seed.lifecycleStatus === "confirmed"
      ? "confirmed"
      : seed.lifecycleStatus === "candidate"
        ? "candidate"
        : "needs_review";
  const unresolved: string[] = [];
  for (const k of seed.readiness.missing) {
    const line = `준비 항목: ${k}`.trim();
    if (line && !unresolved.includes(line)) unresolved.push(line);
  }
  appendStatusReviewUserLines(status, unresolved);
  return {
    status,
    summary:
      seed.readiness.ready
        ? "기획 산출물을 바탕으로 구현 준비정보가 정리되었습니다."
        : "구현 준비정보가 생성되었으나 일부 항목이 더 필요합니다.",
    reasons: [
      `준비도 ${Math.round(seed.readiness.score * 100)}%`,
      "기획 산출물과 슬롯을 기준으로 구현 관점으로 정리했습니다.",
    ],
    unresolvedItems: unresolved,
    nextActions:
      status === "candidate"
        ? ["사용자 확정 후 구현 작업안 생성"]
        : status === "needs_review"
          ? ["부족 항목을 보완하세요."]
          : [],
  };
}

export type ImplementationWorkPlanDraftUserSummary = Readonly<{
  readonly status: "confirmed" | "candidate";
  readonly summary: string;
  readonly reasons: readonly string[];
  readonly unresolvedItems: readonly string[];
  readonly nextActions: readonly string[];
}>;

export function summarizeImplementationWorkPlanDraftForUser(
  draft: ImplementationWorkPlanDraftV1,
): ImplementationWorkPlanDraftUserSummary {
  const status: ImplementationWorkPlanDraftUserSummary["status"] =
    draft.status === "confirmed" ? "confirmed" : "candidate";
  const unresolved = draft.blockers
    .map((b) => sanitizeUserFacingOrchestrationText(b, 120))
    .filter(Boolean);
  appendStatusReviewUserLines(status, unresolved);
  return {
    status,
    summary: `구현 범위 ${draft.implementationScope.length}건을 작업안으로 정리했습니다.`,
    reasons: draft.implementationApproach
      .slice(0, 3)
      .map((s) => sanitizeUserFacingOrchestrationText(s, 120))
      .filter(Boolean),
    unresolvedItems: unresolved,
    nextActions: draft.status === "draft" ? ["구현 작업안 확정", "구현 작업안 초안을 확인하세요."] : [],
  };
}
