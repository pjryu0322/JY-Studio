/**
 * H29.5 — runner invocation scope/policy/checklist **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeRunnerInvocationBlockerReport,
  RuntimeRunnerInvocationPolicy,
  RuntimeRunnerInvocationReadinessChecklist,
  RuntimeRunnerInvocationReadinessVerificationReport,
  RuntimeRunnerInvocationScope,
  RuntimeRunnerInvocationSummary,
} from "./runtimeRunnerInvocationTypes";

function checklistHas(checklist: readonly string[], prefix: string): boolean {
  return checklist.some((row) => row.startsWith(prefix));
}

function blockersAligned(
  summary: RuntimeRunnerInvocationSummary,
  blockerReport: RuntimeRunnerInvocationBlockerReport
): boolean {
  if (blockerReport.blockers.length === 0) {
    return summary.invocationBlockers.length === 0;
  }
  return blockerReport.blockers.every((b) => summary.invocationBlockers.includes(b));
}

export function verifyRuntimeRunnerInvocationReadiness(input: {
  readonly summary: RuntimeRunnerInvocationSummary;
  readonly scope: RuntimeRunnerInvocationScope;
  readonly policy: RuntimeRunnerInvocationPolicy;
  readonly checklist: RuntimeRunnerInvocationReadinessChecklist;
  readonly blockerReport: RuntimeRunnerInvocationBlockerReport;
}): RuntimeRunnerInvocationReadinessVerificationReport {
  const { summary, scope, policy, checklist, blockerReport } = input;
  const findings: string[] = [];

  if (scope.forbiddenInvocationOperations.length === 0) {
    findings.push("scope.forbiddenInvocationOperations empty");
  }
  if (policy.actualInvocationForbidden !== true) {
    findings.push("policy.actualInvocationForbidden not true");
  }
  if (policy.invocationAllowedMode !== summary.invocationMode) {
    findings.push(
      `policy.invocationAllowedMode(${policy.invocationAllowedMode}) !== summary.invocationMode(${summary.invocationMode})`
    );
  }
  if (!checklistHas(checklist.checklist, "pilot skeleton preflight ready_metadata:")) {
    findings.push("checklist missing pilot skeleton preflight row");
  }
  if (!checklistHas(checklist.checklist, "runner contract verification verified_metadata:")) {
    findings.push("checklist missing runner contract verification row");
  }
  if (!checklistHas(checklist.checklist, "no runner boundary violations:")) {
    findings.push("checklist missing runner boundary violations row");
  }
  if (!checklistHas(checklist.checklist, "runner no-execution result diagnosticOnly:")) {
    findings.push("checklist missing no-execution result row");
  }
  if (!blockersAligned(summary, blockerReport)) {
    findings.push("blocker report and summary invocationBlockers misaligned");
  }
  if (summary.candidateStatus === "invocation_metadata_candidate" && blockerReport.blockers.length > 0) {
    findings.push("invocation_metadata_candidate requires empty blocker report");
  }
  if (summary.candidateStatus === "blocked" && blockerReport.blockers.length === 0) {
    findings.push("blocked candidateStatus requires blockers");
  }

  let verificationStatus: RuntimeRunnerInvocationReadinessVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("actualInvocationForbidden") ||
        f.includes("invocationAllowedMode") ||
        f.includes("invocation_metadata_candidate") ||
        f.includes("blocked candidateStatus")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H29.5: runner invocation readiness verified_metadata — H30 entry gate 후보(invocation 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H29.5: runner invocation readiness partial — scope·policy·checklist 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H29.5: runner invocation readiness failed — blocker·mode·forbidden alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_runner_invocation_readiness_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
