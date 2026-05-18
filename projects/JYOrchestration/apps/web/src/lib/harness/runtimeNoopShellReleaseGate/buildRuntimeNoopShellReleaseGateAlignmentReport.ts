/**
 * H34.5 — release-gate scope·policy·checklist **alignment report**(read-only; H35 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopShellReleaseGateAlignmentReport,
  RuntimeNoopShellReleaseGateBoundaryViolationReport,
  RuntimeNoopShellReleaseGatePolicy,
  RuntimeNoopShellReleaseGateReadinessChecklist,
  RuntimeNoopShellReleaseGateScope,
  RuntimeNoopShellReleaseGateSummary,
} from "./runtimeNoopShellReleaseGateTypes";

function scopeIncludesForbidden(scope: RuntimeNoopShellReleaseGateScope, fragment: string): boolean {
  return scope.forbiddenReleaseGateOperations.some((op) => op.toLowerCase().includes(fragment.toLowerCase()));
}

function checklistHasLabel(checklist: readonly string[], label: string): boolean {
  return checklist.some((row) => row.startsWith(`${label}:`));
}

export function buildRuntimeNoopShellReleaseGateAlignmentReport(input: {
  readonly summary: RuntimeNoopShellReleaseGateSummary;
  readonly scope: RuntimeNoopShellReleaseGateScope;
  readonly policy: RuntimeNoopShellReleaseGatePolicy;
  readonly checklist: RuntimeNoopShellReleaseGateReadinessChecklist;
  readonly boundaryViolation: RuntimeNoopShellReleaseGateBoundaryViolationReport;
}): RuntimeNoopShellReleaseGateAlignmentReport {
  const { summary, scope, policy, checklist, boundaryViolation } = input;
  const findings: string[] = [];

  if (scope.candidateSourceLayer !== "runtimeNoopShellHardeningFinalSafetyGate") {
    findings.push("scope.candidateSourceLayer must be runtimeNoopShellHardeningFinalSafetyGate");
  }
  if (scope.candidateTargetLayer !== "controlledNoopExecutionShellReleaseGateCandidate") {
    findings.push("scope.candidateTargetLayer must be controlledNoopExecutionShellReleaseGateCandidate");
  }
  if (!scopeIncludesForbidden(scope, "actual no-op shell execution")) {
    findings.push("scope.forbiddenReleaseGateOperations missing actual no-op shell execution");
  }
  if (!scopeIncludesForbidden(scope, "actual execution shell execution")) {
    findings.push("scope.forbiddenReleaseGateOperations missing actual execution shell execution");
  }
  if (!scopeIncludesForbidden(scope, "release enforcement")) {
    findings.push("scope.forbiddenReleaseGateOperations missing release enforcement");
  }
  if (policy.releaseGateAllowedMode !== summary.releaseGateMode) {
    findings.push("policy.releaseGateAllowedMode misaligned with summary.releaseGateMode");
  }
  if (policy.actualReleaseEnforcementForbidden !== true) {
    findings.push("policy.actualReleaseEnforcementForbidden must be true");
  }
  if (policy.actualShellExecutionForbidden !== true) {
    findings.push("policy.actualShellExecutionForbidden must be true");
  }
  if (!checklistHasLabel(checklist.checklist, "no-op shell hardening final gate ready_metadata")) {
    findings.push("readiness checklist missing hardening final gate row");
  }
  if (!checklistHasLabel(checklist.checklist, "h34 entry readiness ready_metadata")) {
    findings.push("readiness checklist missing h34 entry readiness row");
  }
  if (!checklistHasLabel(checklist.checklist, "hardening alignment aligned_metadata")) {
    findings.push("readiness checklist missing hardening alignment row");
  }
  if (
    summary.candidateStatus === "release_gate_metadata_candidate" &&
    boundaryViolation.actualFlagViolations.length > 0
  ) {
    findings.push("release_gate_metadata_candidate requires empty boundary actualFlagViolations");
  }

  let alignmentStatus: RuntimeNoopShellReleaseGateAlignmentReport["alignmentStatus"];
  if (findings.length === 0) {
    alignmentStatus = "aligned_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("actualReleaseEnforcementForbidden") ||
        f.includes("actualShellExecutionForbidden") ||
        f.includes("empty boundary actualFlagViolations")
    )
  ) {
    alignmentStatus = "failed";
  } else {
    alignmentStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(alignmentStatus === "aligned_metadata"
      ? ["H34.5: release-gate alignment aligned_metadata — H35 metadata shell gate 후보(release enforcement 없음)"]
      : []),
    ...(alignmentStatus === "partial"
      ? ["H34.5: release-gate alignment partial — scope·policy·checklist rows 재검토"]
      : []),
    ...(alignmentStatus === "failed"
      ? ["H34.5: release-gate alignment failed — forbidden operations·policy 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_noop_shell_release_gate_alignment_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
