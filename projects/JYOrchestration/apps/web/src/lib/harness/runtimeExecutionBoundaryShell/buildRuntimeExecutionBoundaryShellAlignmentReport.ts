/**
 * H36.5 — execution boundary shell **alignment report**(read-only; H37 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  shellChecklistHasLabel,
  shellForbiddenIncludes,
} from "./runtimeExecutionBoundaryShellCheckHelpers";
import type {
  RuntimeExecutionBoundaryShellAlignmentReport,
  RuntimeExecutionBoundaryShellBlockerReport,
  RuntimeExecutionBoundaryShellBoundaryViolationReport,
  RuntimeExecutionBoundaryShellPolicy,
  RuntimeExecutionBoundaryShellReadinessChecklist,
  RuntimeExecutionBoundaryShellScope,
  RuntimeExecutionBoundaryShellSummary,
} from "./runtimeExecutionBoundaryShellTypes";

export function buildRuntimeExecutionBoundaryShellAlignmentReport(input: {
  readonly summary: RuntimeExecutionBoundaryShellSummary;
  readonly scope: RuntimeExecutionBoundaryShellScope;
  readonly policy: RuntimeExecutionBoundaryShellPolicy;
  readonly checklist: RuntimeExecutionBoundaryShellReadinessChecklist;
  readonly blockerReport: RuntimeExecutionBoundaryShellBlockerReport;
  readonly boundaryViolation: RuntimeExecutionBoundaryShellBoundaryViolationReport;
}): RuntimeExecutionBoundaryShellAlignmentReport {
  const { summary, scope, policy, checklist, blockerReport, boundaryViolation } = input;
  const findings: string[] = [];

  if (scope.candidateSourceLayer !== "runtimeReleaseGatePreflightFinalSafetyGate") {
    findings.push("scope.candidateSourceLayer must be runtimeReleaseGatePreflightFinalSafetyGate");
  }
  if (scope.candidateTargetLayer !== "executionBoundaryMetadataShellCandidate") {
    findings.push("scope.candidateTargetLayer must be executionBoundaryMetadataShellCandidate");
  }
  if (!shellForbiddenIncludes(scope.forbiddenShellOperations, "actual execution")) {
    findings.push("scope.forbiddenShellOperations missing actual execution");
  }
  if (!shellForbiddenIncludes(scope.forbiddenShellOperations, "actual execution routing")) {
    findings.push("scope.forbiddenShellOperations missing actual execution routing");
  }
  if (!shellForbiddenIncludes(scope.forbiddenShellOperations, "release enforcement")) {
    findings.push("scope.forbiddenShellOperations missing release enforcement");
  }
  if (!shellForbiddenIncludes(scope.forbiddenShellOperations, "provider routing")) {
    findings.push("scope.forbiddenShellOperations missing provider routing");
  }
  if (policy.shellAllowedMode !== summary.shellMode) {
    findings.push("policy.shellAllowedMode misaligned with summary.shellMode");
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
  if (!shellChecklistHasLabel(checklist.checklist, "release-gate preflight final gate ready_metadata")) {
    findings.push("readiness checklist missing preflight final gate row");
  }
  if (!shellChecklistHasLabel(checklist.checklist, "h36 entry readiness ready_metadata")) {
    findings.push("readiness checklist missing h36 entry readiness row");
  }
  if (!shellChecklistHasLabel(checklist.checklist, "preflight alignment aligned_metadata")) {
    findings.push("readiness checklist missing preflight alignment row");
  }
  if (blockerReport.blockers.length > 0) {
    const misaligned = blockerReport.blockers.some((b) => !summary.shellBlockers.includes(b));
    if (misaligned) {
      findings.push("blocker report misaligned with summary.shellBlockers");
    }
  }
  if (
    summary.candidateStatus === "boundary_shell_metadata_candidate" &&
    boundaryViolation.actualFlagViolations.length > 0
  ) {
    findings.push("boundary_shell_metadata_candidate requires empty boundary actual flag violations");
  }

  let alignmentStatus: RuntimeExecutionBoundaryShellAlignmentReport["alignmentStatus"];
  if (findings.length === 0) {
    alignmentStatus = "aligned_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("policy.actualExecutionForbidden") ||
        f.includes("policy.actualExecutionRoutingForbidden") ||
        f.includes("empty boundary actual flag violations") ||
        f.includes("policy.shellAllowedMode misaligned")
    )
  ) {
    alignmentStatus = "failed";
  } else {
    alignmentStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(alignmentStatus === "aligned_metadata"
      ? ["H36.5: execution boundary shell alignment aligned_metadata — H37 entry boundary 후보(집행 없음)"]
      : []),
    ...(alignmentStatus === "partial"
      ? ["H36.5: execution boundary shell alignment partial — scope·forbidden·checklist rows 재검토"]
      : []),
    ...(alignmentStatus === "failed"
      ? ["H36.5: execution boundary shell alignment failed — policy·blocker·violation 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_execution_boundary_shell_alignment_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
