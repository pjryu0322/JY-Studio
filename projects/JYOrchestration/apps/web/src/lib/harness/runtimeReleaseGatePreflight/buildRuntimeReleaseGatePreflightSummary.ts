/**
 * H35 — release-gate final preflight **summary**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { resolveRuntimeReleaseGatePreflightMode } from "./resolveRuntimeReleaseGatePreflightMode";
import type {
  RuntimeReleaseGateNoExecutionProof,
  RuntimeReleaseGateOperationForbiddenProof,
  RuntimeReleaseGatePreflightBlockerReport,
  RuntimeReleaseGatePreflightReadiness,
  RuntimeReleaseGatePreflightSummary,
} from "./runtimeReleaseGatePreflightTypes";
import { isRuntimeReleaseGateOperationForbiddenProofComplete } from "./buildRuntimeReleaseGateOperationForbiddenProof";

function preflightRationaleKo(readiness: RuntimeReleaseGatePreflightReadiness): string {
  switch (readiness) {
    case "preflight_metadata_ready":
      return "controlled release-gate final preflight metadata 준비 — H36 entry 후보(실제 release enforcement·execution 없음).";
    case "watch":
      return "release-gate preflight 주시 — release-gate watch·partial verification(release enforcement 금지).";
    case "blocked":
      return "release-gate preflight 차단 — final gate·blocker·proof 정렬 필요.";
    default:
      return "release-gate preflight 미준비 — H34.5 release-gate final safety gate 선행.";
  }
}

export function buildRuntimeReleaseGatePreflightSummary(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight;
  readonly blockerReport: RuntimeReleaseGatePreflightBlockerReport;
  readonly noExecutionProof: RuntimeReleaseGateNoExecutionProof;
  readonly operationForbiddenProof: RuntimeReleaseGateOperationForbiddenProof;
}): RuntimeReleaseGatePreflightSummary {
  const { reports, blockerReport, noExecutionProof, operationForbiddenProof } = input;
  const finalGate = reports.runtimeNoopShellReleaseGateFinalSafetyGate;
  const readinessVerification = reports.runtimeNoopShellReleaseGateReadinessVerificationReport;
  const alignment = reports.runtimeNoopShellReleaseGateAlignmentReport;
  const boundary = reports.runtimeNoopShellReleaseGateBoundaryViolationReport;
  const releaseSummary = reports.runtimeNoopShellReleaseGateSummary;

  const preflightBlockers: string[] = [];
  if (blockerReport.blockers.length > 0) {
    preflightBlockers.push(...blockerReport.blockers.slice(0, 3));
  }
  if (releaseSummary.releaseGateBlockers.length > 0) {
    preflightBlockers.push(...releaseSummary.releaseGateBlockers.slice(0, 2));
  }
  if (noExecutionProof.diagnosticOnly !== true) {
    preflightBlockers.push("no-execution proof diagnosticOnly must be true");
  }
  if (!isRuntimeReleaseGateOperationForbiddenProofComplete(operationForbiddenProof)) {
    preflightBlockers.push("operation-forbidden proof incomplete");
  }

  let preflightReadiness: RuntimeReleaseGatePreflightReadiness;
  if (
    finalGate.finalGateStatus === "blocked" ||
    finalGate.h35EntryReadiness === "blocked" ||
    readinessVerification.verificationStatus === "failed" ||
    alignment.alignmentStatus === "failed" ||
    boundary.actualFlagViolations.length > 0 ||
    blockerReport.blockers.length > 0 ||
    releaseSummary.releaseGateBlockers.length > 0 ||
    noExecutionProof.diagnosticOnly !== true ||
    !isRuntimeReleaseGateOperationForbiddenProofComplete(operationForbiddenProof)
  ) {
    preflightReadiness = "blocked";
  } else if (
    finalGate.finalGateStatus === "watch" ||
    finalGate.h35EntryReadiness === "watch" ||
    readinessVerification.verificationStatus === "partial" ||
    alignment.alignmentStatus === "partial" ||
    boundary.wordingRiskFindings.length > 0
  ) {
    preflightReadiness = "watch";
  } else if (
    finalGate.finalGateStatus === "ready_metadata" &&
    finalGate.h35EntryReadiness === "ready_metadata" &&
    readinessVerification.verificationStatus === "verified_metadata" &&
    alignment.alignmentStatus === "aligned_metadata" &&
    boundary.actualFlagViolations.length === 0 &&
    blockerReport.blockers.length === 0 &&
    releaseSummary.releaseGateBlockers.length === 0 &&
    noExecutionProof.diagnosticOnly === true &&
    isRuntimeReleaseGateOperationForbiddenProofComplete(operationForbiddenProof)
  ) {
    preflightReadiness = "preflight_metadata_ready";
  } else {
    preflightReadiness = "not_ready";
  }

  const preflightMode = resolveRuntimeReleaseGatePreflightMode(preflightReadiness);

  const recommendations = mergeSortedUniqueKo([
    ...(preflightReadiness === "preflight_metadata_ready"
      ? ["H35: release-gate preflight ready_metadata — H36 execution readiness boundary 후보(release enforcement 없음)"]
      : []),
    ...(preflightReadiness === "watch"
      ? ["H35: release-gate preflight watch — final gate·alignment·wording risk 재검토"]
      : []),
    ...(preflightReadiness === "blocked"
      ? ["H35: release-gate preflight blocked — blocker·proof·verification 정렬"]
      : []),
    ...(preflightReadiness === "not_ready"
      ? ["H35: release-gate preflight not_ready — H34.5 final safety gate 선행"]
      : []),
  ]);

  return {
    mode: "runtime_release_gate_preflight_summary",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    preflightReadiness,
    preflightMode,
    rationaleKo: preflightRationaleKo(preflightReadiness),
    preflightBlockers: mergeSortedUniqueKo(preflightBlockers),
    recommendations,
  };
}
