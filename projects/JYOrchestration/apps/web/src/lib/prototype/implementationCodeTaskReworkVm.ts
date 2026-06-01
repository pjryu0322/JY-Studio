import type { ImplementationCodeTaskFailureCauseLayer } from "@/lib/prototype/implementationCodeTaskFailureDiagnosis";
import type { ImplementationCodeTaskExecutionFeedbackV1 } from "@/lib/prototype/implementationCodeTaskExecutionFeedback";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

export type ImplementationCodeTaskReworkRecommendedAction =
  | "rerun_task"
  | "sync_planning_readiness"
  | "fix_work_items"
  | "check_github"
  | "review_security"
  | "manual_review";

export type ImplementationCodeTaskReworkCandidateV1 = Readonly<{
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly title?: string;
  readonly status: "failed" | "blocked" | "warning";
  readonly causeLayer?: ImplementationCodeTaskFailureCauseLayer;
  readonly failureReason?: string;
  readonly diagnosisMessage?: string;
  readonly workItemIds: readonly string[];
  readonly recommendedAction: ImplementationCodeTaskReworkRecommendedAction;
}>;

export type ImplementationCodeTaskReworkVmV1 = Readonly<{
  readonly candidateCount: number;
  readonly candidates: readonly ImplementationCodeTaskReworkCandidateV1[];
  readonly latestCauseLayer?: ImplementationCodeTaskFailureCauseLayer;
}>;

export function resolveCodeTaskReworkRecommendedAction(
  causeLayer?: ImplementationCodeTaskFailureCauseLayer | null,
): ImplementationCodeTaskReworkRecommendedAction {
  switch (causeLayer) {
    case "work_item_preflight":
      return "fix_work_items";
    case "github_verify":
      return "check_github";
    case "cursor_execution":
      return "rerun_task";
    case "code_task_quality":
      return "sync_planning_readiness";
    case "review_security":
      return "review_security";
    default:
      return "manual_review";
  }
}

export function formatCodeTaskReworkRecommendedActionKo(
  action: ImplementationCodeTaskReworkRecommendedAction,
): string {
  switch (action) {
    case "rerun_task":
      return "Task 재실행";
    case "sync_planning_readiness":
      return "구현 준비 산출물 동기화";
    case "fix_work_items":
      return "WorkItem 보완";
    case "check_github":
      return "GitHub 검증 확인";
    case "review_security":
      return "검수/보안 확인";
    default:
      return "수동 확인";
  }
}

export function buildImplementationCodeTaskReworkVm(input: {
  readonly feedback?: ImplementationCodeTaskExecutionFeedbackV1 | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
}): ImplementationCodeTaskReworkVmV1 | null {
  const titleByCodeTaskId = new Map(
    (input.codeTaskPlan?.tasks ?? []).map((task) => [task.codeTaskId, task.title]),
  );
  const candidates: ImplementationCodeTaskReworkCandidateV1[] = [];

  for (const entry of Object.values(input.feedback?.feedbackByCodeTaskId ?? {})) {
    if (entry.status !== "failed" && entry.status !== "blocked") continue;
    candidates.push({
      codeTaskId: entry.codeTaskId,
      parentTaskId: entry.parentTaskId,
      ...(titleByCodeTaskId.get(entry.codeTaskId)
        ? { title: titleByCodeTaskId.get(entry.codeTaskId) }
        : {}),
      status: entry.status,
      ...(entry.lastCauseLayer ? { causeLayer: entry.lastCauseLayer } : {}),
      ...(entry.lastFailureReason ? { failureReason: entry.lastFailureReason } : {}),
      ...(entry.lastDiagnosisMessage ? { diagnosisMessage: entry.lastDiagnosisMessage } : {}),
      workItemIds: entry.workItemIds,
      recommendedAction: resolveCodeTaskReworkRecommendedAction(entry.lastCauseLayer),
    });
  }

  if (!candidates.length) return null;

  const sorted = candidates.sort((a, b) => a.codeTaskId.localeCompare(b.codeTaskId));
  const latestCauseLayer = sorted.find((candidate) => candidate.causeLayer)?.causeLayer;

  return {
    candidateCount: sorted.length,
    candidates: sorted,
    ...(latestCauseLayer ? { latestCauseLayer } : {}),
  };
}

export function formatCodeTaskReworkBoardSummaryLine(
  reworkVm: ImplementationCodeTaskReworkVmV1 | null | undefined,
): string | null {
  if (!reworkVm?.candidateCount) return null;
  const parts = [`재작업 후보 ${reworkVm.candidateCount}개`];
  const causeLayers = [
    ...new Set(
      reworkVm.candidates
        .map((candidate) => candidate.causeLayer)
        .filter((layer): layer is ImplementationCodeTaskFailureCauseLayer => Boolean(layer)),
    ),
  ];
  if (causeLayers.length) {
    parts.push(`최근 원인: ${causeLayers.slice(0, 3).join(" / ")}`);
  } else if (reworkVm.latestCauseLayer) {
    parts.push(`최근 원인: ${reworkVm.latestCauseLayer}`);
  }
  return parts.join(" · ");
}
