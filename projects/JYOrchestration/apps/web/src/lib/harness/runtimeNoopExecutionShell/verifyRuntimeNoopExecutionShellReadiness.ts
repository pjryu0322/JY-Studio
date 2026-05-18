/**
 * H31.5 — no-op execution shell scope/policy/checklist **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeNoopExecutionShellBlockerReport,
  RuntimeNoopExecutionShellPolicy,
  RuntimeNoopExecutionShellReadinessChecklist,
  RuntimeNoopExecutionShellReadinessVerificationReport,
  RuntimeNoopExecutionShellScope,
  RuntimeNoopExecutionShellSummary,
} from "./runtimeNoopExecutionShellTypes";

function checklistHas(checklist: readonly string[], prefix: string): boolean {
  return checklist.some((row) => row.startsWith(prefix));
}

function blockersAligned(
  summary: RuntimeNoopExecutionShellSummary,
  blockerReport: RuntimeNoopExecutionShellBlockerReport
): boolean {
  if (blockerReport.blockers.length === 0) {
    return true;
  }
  return blockerReport.blockers.every((b) => summary.shellBlockers.includes(b));
}

export function verifyRuntimeNoopExecutionShellReadiness(input: {
  readonly summary: RuntimeNoopExecutionShellSummary;
  readonly scope: RuntimeNoopExecutionShellScope;
  readonly policy: RuntimeNoopExecutionShellPolicy;
  readonly checklist: RuntimeNoopExecutionShellReadinessChecklist;
  readonly blockerReport: RuntimeNoopExecutionShellBlockerReport;
}): RuntimeNoopExecutionShellReadinessVerificationReport {
  const { summary, scope, policy, checklist, blockerReport } = input;
  const findings: string[] = [];

  if (scope.forbiddenShellOperations.length === 0) {
    findings.push("scope.forbiddenShellOperations empty");
  }
  if (policy.actualShellExecutionForbidden !== true) {
    findings.push("policy.actualShellExecutionForbidden not true");
  }
  if (policy.actualExecutionForbidden !== true) {
    findings.push("policy.actualExecutionForbidden not true");
  }
  if (policy.actualAdapterInvocationForbidden !== true) {
    findings.push("policy.actualAdapterInvocationForbidden not true");
  }
  if (policy.actualRunnerInvocationForbidden !== true) {
    findings.push("policy.actualRunnerInvocationForbidden not true");
  }
  if (policy.shellAllowedMode !== summary.shellMode) {
    findings.push(
      `policy.shellAllowedMode(${policy.shellAllowedMode}) !== summary.shellMode(${summary.shellMode})`
    );
  }
  if (!checklistHas(checklist.checklist, "runner no-op harness final gate ready_metadata:")) {
    findings.push("checklist missing runner no-op harness final gate row");
  }
  if (!checklistHas(checklist.checklist, "h31 entry readiness ready_metadata:")) {
    findings.push("checklist missing H31 entry readiness row");
  }
  if (!checklistHas(checklist.checklist, "harness readiness verification verified_metadata:")) {
    findings.push("checklist missing harness readiness verification row");
  }
  if (!checklistHas(checklist.checklist, "harness alignment aligned_metadata:")) {
    findings.push("checklist missing harness alignment row");
  }
  if (!checklistHas(checklist.checklist, "no harness boundary violations:")) {
    findings.push("checklist missing harness boundary violations row");
  }
  if (!checklistHas(checklist.checklist, "harness no-op result diagnosticOnly:")) {
    findings.push("checklist missing harness no-op result diagnosticOnly row");
  }
  if (!checklistHas(checklist.checklist, "actual shell execution disabled:")) {
    findings.push("checklist missing actual shell execution disabled row");
  }
  if (!blockersAligned(summary, blockerReport)) {
    findings.push("blocker report and summary shellBlockers misaligned");
  }
  if (summary.candidateStatus === "shell_metadata_candidate" && blockerReport.blockers.length > 0) {
    findings.push("shell_metadata_candidate requires empty blocker report");
  }
  if (summary.candidateStatus === "blocked" && blockerReport.blockers.length === 0) {
    findings.push("blocked candidateStatus requires blockers");
  }

  let verificationStatus: RuntimeNoopExecutionShellReadinessVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("actualShellExecutionForbidden") ||
        f.includes("actualExecutionForbidden") ||
        f.includes("shellAllowedMode") ||
        f.includes("shell_metadata_candidate") ||
        f.includes("blocked candidateStatus")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H31.5: execution shell readiness verified_metadata — H32 entry gate 후보(shell execution 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H31.5: execution shell readiness partial — scope·policy·checklist 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H31.5: execution shell readiness failed — blocker·mode·forbidden alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_noop_execution_shell_readiness_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
