/**
 * H27.5 — activation scope/policy/checklist **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimePilotActivationBlockerReport,
  RuntimePilotActivationPolicy,
  RuntimePilotActivationReadinessChecklist,
  RuntimePilotActivationReadinessVerificationReport,
  RuntimePilotActivationScope,
  RuntimePilotActivationSummary,
} from "./runtimePilotActivationTypes";

function checklistHas(checklist: readonly string[], prefix: string): boolean {
  return checklist.some((row) => row.startsWith(prefix));
}

function blockersAligned(summary: RuntimePilotActivationSummary, blockerReport: RuntimePilotActivationBlockerReport): boolean {
  if (blockerReport.blockers.length === 0) {
    return summary.activationBlockers.length === 0;
  }
  return blockerReport.blockers.every((b) => summary.activationBlockers.includes(b));
}

export function verifyRuntimePilotActivationReadiness(input: {
  readonly summary: RuntimePilotActivationSummary;
  readonly scope: RuntimePilotActivationScope;
  readonly policy: RuntimePilotActivationPolicy;
  readonly checklist: RuntimePilotActivationReadinessChecklist;
  readonly blockerReport: RuntimePilotActivationBlockerReport;
}): RuntimePilotActivationReadinessVerificationReport {
  const { summary, scope, policy, checklist, blockerReport } = input;
  const findings: string[] = [];

  if (scope.forbiddenActivationOperations.length === 0) {
    findings.push("scope.forbiddenActivationOperations empty");
  }
  if (policy.actualActivationForbidden !== true) {
    findings.push("policy.actualActivationForbidden not true");
  }
  if (policy.activationAllowedMode !== summary.activationMode) {
    findings.push(
      `policy.activationAllowedMode(${policy.activationAllowedMode}) !== summary.activationMode(${summary.activationMode})`
    );
  }
  if (!checklistHas(checklist.checklist, "sandbox preflight ready_metadata:")) {
    findings.push("checklist missing sandbox preflight row");
  }
  if (!checklistHas(checklist.checklist, "sandbox envelope verified_metadata:")) {
    findings.push("checklist missing sandbox envelope row");
  }
  if (!checklistHas(checklist.checklist, "no sandbox boundary violations:")) {
    findings.push("checklist missing boundary violations row");
  }
  if (!blockersAligned(summary, blockerReport)) {
    findings.push("blocker report and summary activationBlockers misaligned");
  }
  if (summary.candidateStatus === "activation_metadata_candidate" && blockerReport.blockers.length > 0) {
    findings.push("activation_metadata_candidate requires empty blocker report");
  }
  if (summary.candidateStatus === "blocked" && blockerReport.blockers.length === 0) {
    findings.push("blocked candidateStatus requires blockers");
  }

  let verificationStatus: RuntimePilotActivationReadinessVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some((f) =>
      f.includes("actualActivationForbidden") ||
      f.includes("activationAllowedMode") ||
      f.includes("activation_metadata_candidate") ||
      f.includes("blocked candidateStatus")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H27.5: activation readiness verified_metadata — H28 entry gate 후보(activation 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H27.5: activation readiness partial — scope·policy·checklist 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H27.5: activation readiness failed — blocker·mode·forbidden alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_pilot_activation_readiness_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
