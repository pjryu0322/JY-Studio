/**
 * H23.5 — **Audit readiness** 메타(read-only; 감사 집행 없음).
 */

import type { RuntimeSemanticPlanningReportsBeforeOperatorApproval } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeAuditReadiness, RuntimeAuditReadinessSummary } from "./runtimeOperatorApprovalTypes";

export function evaluateRuntimeAuditReadiness(
  reports: RuntimeSemanticPlanningReportsBeforeOperatorApproval
): RuntimeAuditReadinessSummary {
  const ecs = reports.runtimeExecutionCandidateSummary;
  const b = reports.runtimeControlBoundarySummary;
  const lineage = reports.runtimeDecisionLineage;
  const pre = reports.runtimeExecutionCandidatePreconditions;
  const nodeCount = lineage?.nodes?.length ?? 0;

  const auditFindings: string[] = [];
  if (nodeCount > 0) {
    auditFindings.push("decision lineage 메타 존재");
  } else {
    auditFindings.push("decision lineage 비어 있음(감사 메타 주시)");
  }

  if (String(ecs.rationaleKo ?? "").trim().length >= 8) {
    auditFindings.push("execution candidate rationale 메타 존재");
  } else {
    auditFindings.push("execution candidate rationale 메타 짧음");
  }

  if (ecs.candidatePreconditions.length > 0) {
    auditFindings.push("candidate precondition 메타 존재");
  } else {
    auditFindings.push("candidate precondition 목록 없음");
  }

  if (pre.preconditions.length > 0) {
    auditFindings.push("preconditions 리포트 메타 존재");
  }

  if (ecs.candidateBlockers.length > 0) {
    auditFindings.push("candidate blocker 메타 있음(집행 아님)");
  }

  let auditReadiness: RuntimeAuditReadiness;
  if (ecs.candidateStatus === "blocked" || b.boundaryRisk === "blocked") {
    auditReadiness = "blocked";
  } else if (nodeCount === 0 || String(ecs.rationaleKo ?? "").trim().length < 8) {
    auditReadiness = "minimal";
  } else if (ecs.candidateBlockers.length > 0 || pre.preconditions.length === 0) {
    auditReadiness = "watch";
  } else {
    auditReadiness = "sufficient_metadata";
  }

  const recommendations = mergeSortedUniqueKo([
    ...ecs.recommendations,
    ...(auditReadiness === "minimal" ? ["감사 메타 보강 — lineage·rationale 정렬(실제 감사 집행 없음)"] : []),
    ...(auditReadiness === "watch" ? ["감사 메타 주시 — blocker·precondition 정합성 확인"] : []),
  ]);

  return {
    mode: "runtime_audit_readiness_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualApprovalEnforcementEnabled: false,
    actualRollbackExecutionEnabled: false,
    auditReadiness,
    auditFindings: mergeSortedUniqueKo(auditFindings),
    recommendations,
  };
}
