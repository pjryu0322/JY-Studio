import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationWorkItemPreflightSummaryV1 } from "@/lib/prototype/implementationPlanningReadiness";

export type ImplementationPlanningReadinessRefreshReason =
  | "force_refresh"
  | "missing_code_task_plan"
  | "missing_work_items"
  | "missing_preflight_summary"
  | "missing_code_task_validation"
  | "validation_failed"
  | "preflight_failed"
  | "ready_reusable";

export type ImplementationPlanningReadinessRefreshDecision = Readonly<{
  readonly refresh: boolean;
  readonly reason: ImplementationPlanningReadinessRefreshReason;
}>;

export function shouldRefreshImplementationPlanningReadiness(input: {
  readonly existingCodeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly existingCursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly existingPreflightSummary?: ImplementationWorkItemPreflightSummaryV1 | null;
  readonly forceRefresh?: boolean;
}): ImplementationPlanningReadinessRefreshDecision {
  if (input.forceRefresh === true) {
    return { refresh: true, reason: "force_refresh" };
  }

  const hasCodeTaskPlan = Boolean(input.existingCodeTaskPlan?.tasks?.length);
  if (!hasCodeTaskPlan) {
    return { refresh: true, reason: "missing_code_task_plan" };
  }

  const hasWorkItems = (input.existingCursorWorkItems?.length ?? 0) > 0;
  if (!hasWorkItems) {
    return { refresh: true, reason: "missing_work_items" };
  }

  if (!input.existingPreflightSummary) {
    return { refresh: true, reason: "missing_preflight_summary" };
  }

  if (input.existingPreflightSummary.status === "failed") {
    return { refresh: true, reason: "preflight_failed" };
  }

  const validationStatus = input.existingCodeTaskPlan?.validationReport?.status;
  if (!validationStatus) {
    return { refresh: true, reason: "missing_code_task_validation" };
  }

  if (validationStatus === "failed") {
    return { refresh: true, reason: "validation_failed" };
  }

  if (input.existingPreflightSummary.status !== "passed") {
    return { refresh: true, reason: "preflight_failed" };
  }

  return { refresh: false, reason: "ready_reusable" };
}
