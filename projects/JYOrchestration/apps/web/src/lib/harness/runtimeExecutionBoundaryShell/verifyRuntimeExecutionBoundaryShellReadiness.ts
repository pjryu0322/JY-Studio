/**
 * H36.5 — execution boundary shell scope·policy·checklist **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { shellChecklistHas } from "./runtimeExecutionBoundaryShellCheckHelpers";
import type {
  RuntimeExecutionBoundaryShellBlockerReport,
  RuntimeExecutionBoundaryShellPolicy,
  RuntimeExecutionBoundaryShellReadinessChecklist,
  RuntimeExecutionBoundaryShellReadinessVerificationReport,
  RuntimeExecutionBoundaryShellScope,
  RuntimeExecutionBoundaryShellSummary,
} from "./runtimeExecutionBoundaryShellTypes";

function blockersAligned(
  blockerReport: RuntimeExecutionBoundaryShellBlockerReport,
  summary: RuntimeExecutionBoundaryShellSummary
): boolean {
  if (blockerReport.blockers.length === 0 && summary.shellBlockers.length === 0) {
    return true;
  }
  if (blockerReport.blockers.length > 0) {
    return blockerReport.blockers.every((b) => summary.shellBlockers.includes(b));
  }
  return true;
}

export function verifyRuntimeExecutionBoundaryShellReadiness(input: {
  readonly summary: RuntimeExecutionBoundaryShellSummary;
  readonly scope: RuntimeExecutionBoundaryShellScope;
  readonly policy: RuntimeExecutionBoundaryShellPolicy;
  readonly checklist: RuntimeExecutionBoundaryShellReadinessChecklist;
  readonly blockerReport: RuntimeExecutionBoundaryShellBlockerReport;
}): RuntimeExecutionBoundaryShellReadinessVerificationReport {
  const { summary, scope, policy, checklist, blockerReport } = input;
  const findings: string[] = [];

  if (scope.candidateSourceLayer !== "runtimeReleaseGatePreflightFinalSafetyGate") {
    findings.push("scope.candidateSourceLayer must be runtimeReleaseGatePreflightFinalSafetyGate");
  }
  if (scope.candidateTargetLayer !== "executionBoundaryMetadataShellCandidate") {
    findings.push("scope.candidateTargetLayer must be executionBoundaryMetadataShellCandidate");
  }
  if (scope.forbiddenShellOperations.length === 0) {
    findings.push("scope.forbiddenShellOperations must be non-empty");
  }
  if (policy.actualExecutionForbidden !== true) {
    findings.push("policy.actualExecutionForbidden must be true");
  }
  if (policy.actualExecutionRoutingForbidden !== true) {
    findings.push("policy.actualExecutionRoutingForbidden must be true");
  }
  if (policy.actualReleaseEnforcementForbidden !== true) {
    findings.push("policy.actualReleaseEnforcementForbidden must be true");
  }
  if (policy.actualShellExecutionForbidden !== true) {
    findings.push("policy.actualShellExecutionForbidden must be true");
  }
  if (policy.actualAdapterInvocationForbidden !== true) {
    findings.push("policy.actualAdapterInvocationForbidden must be true");
  }
  if (policy.shellAllowedMode !== summary.shellMode) {
    findings.push("policy.shellAllowedMode must match summary.shellMode");
  }
  if (!shellChecklistHas(checklist.checklist, "release-gate preflight final gate ready_metadata", true)) {
    findings.push("checklist missing release-gate preflight final gate ready_metadata");
  }
  if (!shellChecklistHas(checklist.checklist, "h36 entry readiness ready_metadata", true)) {
    findings.push("checklist missing h36 entry readiness ready_metadata");
  }
  if (!shellChecklistHas(checklist.checklist, "preflight readiness verification verified_metadata", true)) {
    findings.push("checklist missing preflight readiness verification verified_metadata");
  }
  if (!shellChecklistHas(checklist.checklist, "preflight alignment aligned_metadata", true)) {
    findings.push("checklist missing preflight alignment aligned_metadata");
  }
  if (!shellChecklistHas(checklist.checklist, "actual execution disabled", true)) {
    findings.push("checklist missing actual execution disabled");
  }
  if (!shellChecklistHas(checklist.checklist, "actual release enforcement disabled", true)) {
    findings.push("checklist missing actual release enforcement disabled");
  }
  if (!shellChecklistHas(checklist.checklist, "actual shell execution disabled", true)) {
    findings.push("checklist missing actual shell execution disabled");
  }
  if (!blockersAligned(blockerReport, summary)) {
    findings.push("blocker report and summary.shellBlockers misaligned");
  }
  if (
    summary.candidateStatus === "boundary_shell_metadata_candidate" &&
    (blockerReport.blockers.length > 0 || summary.shellBlockers.length > 0)
  ) {
    findings.push("boundary_shell_metadata_candidate requires no shell blockers");
  }
  if (summary.candidateStatus === "blocked" && blockerReport.blockers.length === 0 && summary.shellBlockers.length === 0) {
    findings.push("blocked candidateStatus requires shell blockers");
  }

  let verificationStatus: RuntimeExecutionBoundaryShellReadinessVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("policy.shellAllowedMode must match") ||
        f.includes("policy.actualExecutionForbidden") ||
        f.includes("policy.actualExecutionRoutingForbidden") ||
        f.includes("blocked candidateStatus requires shell blockers") ||
        f.includes("boundary_shell_metadata_candidate requires no shell blockers")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H36.5: execution boundary shell readiness verified_metadata — H37 entry boundary 후보(집행 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H36.5: execution boundary shell readiness partial — scope·policy·checklist 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H36.5: execution boundary shell readiness failed — policy·blocker·mode alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_execution_boundary_shell_readiness_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
