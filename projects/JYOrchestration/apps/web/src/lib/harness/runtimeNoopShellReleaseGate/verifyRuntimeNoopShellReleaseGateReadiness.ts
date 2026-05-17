/**
 * H34.5 — release-gate scope·policy·checklist **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopShellReleaseGateBlockerReport,
  RuntimeNoopShellReleaseGatePolicy,
  RuntimeNoopShellReleaseGateReadinessChecklist,
  RuntimeNoopShellReleaseGateReadinessVerificationReport,
  RuntimeNoopShellReleaseGateScope,
  RuntimeNoopShellReleaseGateSummary,
} from "./runtimeNoopShellReleaseGateTypes";

function checklistHas(checklist: readonly string[], label: string, ok: boolean): boolean {
  return checklist.some((row) => row === `${label}:${ok}`);
}

function blockersAligned(blockerReport: RuntimeNoopShellReleaseGateBlockerReport, summary: RuntimeNoopShellReleaseGateSummary): boolean {
  if (blockerReport.blockers.length === 0 && summary.releaseGateBlockers.length === 0) {
    return true;
  }
  if (blockerReport.blockers.length > 0) {
    return blockerReport.blockers.every((b) => summary.releaseGateBlockers.includes(b));
  }
  return true;
}

export function verifyRuntimeNoopShellReleaseGateReadiness(input: {
  readonly summary: RuntimeNoopShellReleaseGateSummary;
  readonly scope: RuntimeNoopShellReleaseGateScope;
  readonly policy: RuntimeNoopShellReleaseGatePolicy;
  readonly checklist: RuntimeNoopShellReleaseGateReadinessChecklist;
  readonly blockerReport: RuntimeNoopShellReleaseGateBlockerReport;
}): RuntimeNoopShellReleaseGateReadinessVerificationReport {
  const { summary, scope, policy, checklist, blockerReport } = input;
  const findings: string[] = [];

  if (scope.forbiddenReleaseGateOperations.length === 0) {
    findings.push("scope.forbiddenReleaseGateOperations must be non-empty");
  }
  if (policy.actualReleaseEnforcementForbidden !== true) {
    findings.push("policy.actualReleaseEnforcementForbidden must be true");
  }
  if (policy.actualShellExecutionForbidden !== true) {
    findings.push("policy.actualShellExecutionForbidden must be true");
  }
  if (policy.actualExecutionForbidden !== true) {
    findings.push("policy.actualExecutionForbidden must be true");
  }
  if (policy.actualAdapterInvocationForbidden !== true) {
    findings.push("policy.actualAdapterInvocationForbidden must be true");
  }
  if (policy.releaseGateAllowedMode !== summary.releaseGateMode) {
    findings.push("policy.releaseGateAllowedMode must match summary.releaseGateMode");
  }
  if (!checklistHas(checklist.checklist, "no-op shell hardening final gate ready_metadata", true)) {
    findings.push("checklist missing no-op shell hardening final gate ready_metadata");
  }
  if (!checklistHas(checklist.checklist, "h34 entry readiness ready_metadata", true)) {
    findings.push("checklist missing h34 entry readiness ready_metadata");
  }
  if (!checklistHas(checklist.checklist, "hardening readiness verification verified_metadata", true)) {
    findings.push("checklist missing hardening readiness verification verified_metadata");
  }
  if (!checklistHas(checklist.checklist, "hardening alignment aligned_metadata", true)) {
    findings.push("checklist missing hardening alignment aligned_metadata");
  }
  if (!checklistHas(checklist.checklist, "actual release enforcement disabled", true)) {
    findings.push("checklist missing actual release enforcement disabled");
  }
  if (!checklistHas(checklist.checklist, "actual shell execution disabled", true)) {
    findings.push("checklist missing actual shell execution disabled");
  }
  if (!blockersAligned(blockerReport, summary)) {
    findings.push("blocker report and summary.releaseGateBlockers misaligned");
  }
  if (
    summary.candidateStatus === "release_gate_metadata_candidate" &&
    (blockerReport.blockers.length > 0 || summary.releaseGateBlockers.length > 0)
  ) {
    findings.push("release_gate_metadata_candidate requires no blockers");
  }
  if (summary.candidateStatus === "blocked" && blockerReport.blockers.length === 0 && summary.releaseGateBlockers.length === 0) {
    findings.push("blocked candidateStatus requires blockers");
  }

  let verificationStatus: RuntimeNoopShellReleaseGateReadinessVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("actualReleaseEnforcementForbidden") ||
        f.includes("actualShellExecutionForbidden") ||
        f.includes("release_gate_metadata_candidate requires no blockers") ||
        f.includes("blocked candidateStatus requires blockers")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H34.5: release-gate readiness verified_metadata — H35 entry gate 후보(release enforcement 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H34.5: release-gate readiness partial — scope·policy·checklist 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H34.5: release-gate readiness failed — blocker·policy·checklist alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_noop_shell_release_gate_readiness_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
