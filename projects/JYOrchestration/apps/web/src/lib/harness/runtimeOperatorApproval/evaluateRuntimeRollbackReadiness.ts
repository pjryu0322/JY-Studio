/**
 * H23.5 — **Rollback readiness** 메타(read-only; 실제 rollback 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeOperatorApproval } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeRollbackReadiness, RuntimeRollbackReadinessSummary } from "./runtimeOperatorApprovalTypes";

export function evaluateRuntimeRollbackReadiness(
  reports: RuntimeSemanticPlanningReportsBeforeOperatorApproval
): RuntimeRollbackReadinessSummary {
  const ecs = reports.runtimeExecutionCandidateSummary;
  const b = reports.runtimeControlBoundarySummary;
  const drift = reports.runtimeAllocationTrialDriftSummary;

  let rollbackReadiness: RuntimeRollbackReadiness;
  if (ecs.candidateStatus === "blocked" || b.boundaryRisk === "blocked") {
    rollbackReadiness = "blocked";
  } else if (ecs.candidateStatus === "not_candidate" && b.boundaryLevel === "read_only") {
    rollbackReadiness = "not_applicable";
  } else if (
    ecs.candidateRisk === "watch" ||
    ecs.candidateRisk === "elevated" ||
    drift.driftLevel === "watch" ||
    drift.driftLevel === "elevated"
  ) {
    rollbackReadiness = "metadata_watch";
  } else {
    rollbackReadiness = "metadata_ready";
  }

  const rollbackPrerequisites = mergeSortedUniqueKo([
    ...ecs.rollbackPrerequisites,
    "decision·trial 비교 요약은 rollback 메타 근거로만 사용(실제 merge·rollback 없음)",
  ]);

  const rollbackBlockers =
    rollbackReadiness === "blocked"
      ? mergeSortedUniqueKo([...ecs.candidateBlockers, ...(b.boundaryRisk === "blocked" ? ["boundary blocked(메타)"] : [])])
      : [];

  const rollbackAuditTrailHints = mergeSortedUniqueKo([
    "runtimeDecisionLineage·trial comparison은 진단 serialization 경로에서 제공",
    "governance·allocation alignment는 rollback 전제 메타로만 참조",
  ]);

  const recommendations = mergeSortedUniqueKo([
    ...ecs.recommendations,
    ...(rollbackReadiness === "metadata_watch"
      ? ["rollback 메타 주시 — drift·candidate risk 확인"]
      : []),
    ...(rollbackReadiness === "blocked" ? ["rollback 준비 메타 차단 — 선행 차단 해소 후 재평가"] : []),
  ]);

  return {
    mode: "runtime_rollback_readiness_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualApprovalEnforcementEnabled: false,
    actualRollbackExecutionEnabled: false,
    rollbackReadiness,
    rollbackPrerequisites,
    rollbackBlockers,
    rollbackAuditTrailHints,
    recommendations,
  };
}
