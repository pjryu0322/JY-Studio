/**
 * H24 — Pilot **fallback** 요구 메타(read-only; 실제 rollback·fallback 실행 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeControlledPilot } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeControlledPilotFallbackPlan } from "./runtimeControlledPilotTypes";

export function buildRuntimeControlledPilotFallbackPlan(
  reports: RuntimeSemanticPlanningReportsBeforeControlledPilot
): RuntimeControlledPilotFallbackPlan {
  const r = reports.runtimeRollbackReadinessSummary;
  const u = reports.runtimeAuditReadinessSummary;
  const a = reports.runtimeOperatorApprovalSummary;
  const b = reports.runtimeControlBoundarySummary;

  const fallbackPrerequisites = mergeSortedUniqueKo([
    "rollback readiness 메타 링크(실제 rollback 없음)",
    ...r.rollbackPrerequisites,
    "audit readiness 메타 링크(실제 감사 집행 없음)",
    ...u.auditFindings.slice(0, 3),
    "operator review 메타 링크(실제 승인 없음)",
    ...a.requiredReviewItems.slice(0, 3),
    "control boundary fallback: metadata-only 유지(실제 control 없음)",
    b.rationaleKo ? `boundary rationale 참조: ${b.rationaleKo.slice(0, 120)}` : "boundary rationale 없음(메타)",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...r.recommendations,
    ...u.recommendations,
    "fallback 메타만 — 자동 복구·merge 차단·routing 없음",
  ]);

  return {
    mode: "runtime_controlled_pilot_fallback_plan",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualRollbackExecutionEnabled: false,
    fallbackPrerequisites,
    recommendations,
  };
}
