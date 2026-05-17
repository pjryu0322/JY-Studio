/**
 * H38 — governance release-readiness **summary**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { isRuntimeExecutionGovernanceForbiddenProofComplete } from "./buildRuntimeExecutionGovernanceForbiddenProof";
import { resolveRuntimeGovernanceReleaseReadinessMode } from "./resolveRuntimeGovernanceReleaseReadinessMode";
import type {
  RuntimeGovernanceNoEnforcementProof,
  RuntimeExecutionGovernanceForbiddenProof,
  RuntimeGovernanceReleaseBlockerReport,
  RuntimeGovernanceReleaseReadinessStatus,
  RuntimeGovernanceReleaseReadinessSummary,
} from "./runtimeGovernanceReleaseReadinessTypes";

function readinessRationaleKo(status: RuntimeGovernanceReleaseReadinessStatus): string {
  switch (status) {
    case "governance_release_metadata_ready":
      return "governance release-readiness metadata 준비 — final execution governance readiness boundary 후보(실제 enforcement 없음).";
    case "watch":
      return "governance release-readiness 주시 — governance boundary watch·partial verification(enforcement 금지).";
    case "blocked":
      return "governance release-readiness 차단 — final gate·blocker·proof 정렬 필요.";
    default:
      return "governance release-readiness 미준비 — H37.5 governance boundary final safety gate 선행.";
  }
}

export function buildRuntimeGovernanceReleaseReadinessSummary(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness;
  readonly blockerReport: RuntimeGovernanceReleaseBlockerReport;
  readonly noEnforcementProof: RuntimeGovernanceNoEnforcementProof;
  readonly forbiddenProof: RuntimeExecutionGovernanceForbiddenProof;
}): RuntimeGovernanceReleaseReadinessSummary {
  const { reports, blockerReport, noEnforcementProof, forbiddenProof } = input;
  const governanceFinalGate = reports.runtimeExecutionGovernanceBoundaryFinalSafetyGate;
  const governanceReadiness = reports.runtimeExecutionGovernanceBoundaryReadinessVerificationReport;
  const governanceAlignment = reports.runtimeExecutionGovernanceBoundaryAlignmentReport;
  const governanceBoundaryViolation = reports.runtimeExecutionGovernanceBoundaryViolationReport;
  const governanceSummary = reports.runtimeExecutionGovernanceBoundarySummary;

  const readinessBlockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    readinessBlockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (governanceSummary.governanceBlockers.length > 0) {
    readinessBlockers.push(...governanceSummary.governanceBlockers.slice(0, 2));
  }
  if (noEnforcementProof.diagnosticOnly !== true) {
    readinessBlockers.push("no-enforcement proof diagnosticOnly must be true");
  }
  if (!isRuntimeExecutionGovernanceForbiddenProofComplete(forbiddenProof)) {
    readinessBlockers.push("execution-governance-forbidden proof incomplete");
  }

  let readinessStatus: RuntimeGovernanceReleaseReadinessStatus;
  if (
    governanceFinalGate.finalGateStatus === "blocked" ||
    governanceFinalGate.h38EntryReadiness === "blocked" ||
    governanceReadiness.verificationStatus === "failed" ||
    governanceAlignment.alignmentStatus === "failed" ||
    governanceBoundaryViolation.actualFlagViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    governanceSummary.governanceBlockers.length > 0 ||
    noEnforcementProof.diagnosticOnly !== true ||
    !isRuntimeExecutionGovernanceForbiddenProofComplete(forbiddenProof)
  ) {
    readinessStatus = "blocked";
  } else if (
    governanceFinalGate.finalGateStatus === "watch" ||
    governanceFinalGate.h38EntryReadiness === "watch" ||
    governanceReadiness.verificationStatus === "partial" ||
    governanceAlignment.alignmentStatus === "partial" ||
    governanceBoundaryViolation.wordingRiskFindings.length > 0
  ) {
    readinessStatus = "watch";
  } else if (
    governanceFinalGate.finalGateStatus === "ready_metadata" &&
    governanceFinalGate.h38EntryReadiness === "ready_metadata" &&
    governanceReadiness.verificationStatus === "verified_metadata" &&
    governanceAlignment.alignmentStatus === "aligned_metadata" &&
    governanceBoundaryViolation.actualFlagViolations.length === 0 &&
    blockerReport.blockers.length === 0 &&
    governanceSummary.governanceBlockers.length === 0 &&
    noEnforcementProof.diagnosticOnly === true &&
    isRuntimeExecutionGovernanceForbiddenProofComplete(forbiddenProof)
  ) {
    readinessStatus = "governance_release_metadata_ready";
  } else {
    readinessStatus = "not_ready";
  }

  const readinessMode = resolveRuntimeGovernanceReleaseReadinessMode(readinessStatus);

  const recommendations = mergeSortedUniqueKo([
    ...(readinessStatus === "governance_release_metadata_ready"
      ? ["H38: governance release-readiness ready — final execution governance readiness boundary 후보(enforcement 없음)"]
      : []),
    ...(readinessStatus === "watch"
      ? ["H38: governance release-readiness watch — final gate·alignment·wording risk 재검토"]
      : []),
    ...(readinessStatus === "blocked"
      ? ["H38: governance release-readiness blocked — blocker·proof·verification 정렬"]
      : []),
    ...(readinessStatus === "not_ready"
      ? ["H38: governance release-readiness not_ready — H37.5 governance boundary final gate 선행"]
      : []),
  ]);

  return {
    mode: "runtime_governance_release_readiness_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualExecutionRoutingEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    actualApprovalEnforcementEnabled: false,
    readinessStatus,
    readinessMode,
    rationaleKo: readinessRationaleKo(readinessStatus),
    readinessBlockers: mergeSortedUniqueKo(readinessBlockers),
    recommendations,
  };
}
