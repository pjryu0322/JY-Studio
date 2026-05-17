/**
 * H38.5 — governance release-readiness **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { isRuntimeExecutionGovernanceForbiddenProofComplete } from "./buildRuntimeExecutionGovernanceForbiddenProof";
import {
  releaseChecklistHas,
  releaseEnvelopeIncludesRow,
} from "./runtimeGovernanceReleaseReadinessCheckHelpers";
import type {
  RuntimeExecutionGovernanceForbiddenProof,
  RuntimeGovernanceNoEnforcementProof,
  RuntimeGovernanceReleaseBlockerReport,
  RuntimeGovernanceReleaseInputEnvelope,
  RuntimeGovernanceReleaseOutputEnvelope,
  RuntimeGovernanceReleaseReadinessBoundary,
  RuntimeGovernanceReleaseReadinessChecklist,
  RuntimeGovernanceReleaseReadinessSummary,
  RuntimeGovernanceReleaseReadinessVerificationReport,
} from "./runtimeGovernanceReleaseReadinessTypes";

function blockersAligned(
  blockerReport: RuntimeGovernanceReleaseBlockerReport,
  summary: RuntimeGovernanceReleaseReadinessSummary
): boolean {
  if (blockerReport.blockers.length === 0 && summary.readinessBlockers.length === 0) {
    return true;
  }
  if (blockerReport.blockers.length > 0) {
    return blockerReport.blockers.every((b) => summary.readinessBlockers.includes(b));
  }
  return true;
}

export function verifyRuntimeGovernanceReleaseReadiness(input: {
  readonly summary: RuntimeGovernanceReleaseReadinessSummary;
  readonly boundary: RuntimeGovernanceReleaseReadinessBoundary;
  readonly inputEnvelope: RuntimeGovernanceReleaseInputEnvelope;
  readonly outputEnvelope: RuntimeGovernanceReleaseOutputEnvelope;
  readonly noEnforcementProof: RuntimeGovernanceNoEnforcementProof;
  readonly forbiddenProof: RuntimeExecutionGovernanceForbiddenProof;
  readonly checklist: RuntimeGovernanceReleaseReadinessChecklist;
  readonly blockerReport: RuntimeGovernanceReleaseBlockerReport;
}): RuntimeGovernanceReleaseReadinessVerificationReport {
  const {
    summary,
    boundary,
    inputEnvelope,
    outputEnvelope,
    noEnforcementProof,
    forbiddenProof,
    checklist,
    blockerReport,
  } = input;
  const findings: string[] = [];

  if (
    summary.readinessStatus === "governance_release_metadata_ready" &&
    summary.readinessMode !== "metadata_only"
  ) {
    findings.push("governance_release_metadata_ready requires readinessMode metadata_only");
  }
  if (summary.readinessStatus === "blocked" && summary.readinessBlockers.length === 0) {
    findings.push("blocked readinessStatus requires readinessBlockers");
  }
  if (boundary.boundarySourceLayer !== "runtimeExecutionGovernanceBoundaryFinalSafetyGate") {
    findings.push("boundary.boundarySourceLayer must be runtimeExecutionGovernanceBoundaryFinalSafetyGate");
  }
  if (boundary.boundaryTargetLayer !== "finalExecutionGovernanceReadinessBoundary") {
    findings.push("boundary.boundaryTargetLayer must be finalExecutionGovernanceReadinessBoundary");
  }
  if (boundary.forbiddenBoundaryOperations.length === 0) {
    findings.push("boundary.forbiddenBoundaryOperations must be non-empty");
  }
  if (!releaseEnvelopeIncludesRow(inputEnvelope.envelopeRows, "runtimeExecutionGovernanceBoundaryFinalSafetyGate")) {
    findings.push("input envelope missing governance boundary final safety gate");
  }
  if (
    !releaseEnvelopeIncludesRow(
      inputEnvelope.envelopeRows,
      "runtimeExecutionGovernanceBoundaryReadinessVerificationReport"
    )
  ) {
    findings.push("input envelope missing governance boundary readiness verification");
  }
  if (
    !releaseEnvelopeIncludesRow(inputEnvelope.envelopeRows, "runtimeExecutionGovernanceBoundaryAlignmentReport")
  ) {
    findings.push("input envelope missing governance boundary alignment report");
  }
  if (!releaseEnvelopeIncludesRow(outputEnvelope.envelopeRows, "noEnforcementProofDiagnosticOnly")) {
    findings.push("output envelope missing no-enforcement proof metadata");
  }
  if (!releaseEnvelopeIncludesRow(outputEnvelope.envelopeRows, "executionGovernanceForbiddenProof")) {
    findings.push("output envelope missing execution-governance-forbidden proof metadata");
  }
  if (noEnforcementProof.diagnosticOnly !== true) {
    findings.push("noEnforcementProof.diagnosticOnly must be true");
  }
  if (!isRuntimeExecutionGovernanceForbiddenProofComplete(forbiddenProof)) {
    findings.push("execution-governance-forbidden proof incomplete");
  }
  if (!releaseChecklistHas(checklist.checklist, "governance boundary final safety gate ready_metadata", true)) {
    findings.push("checklist missing governance boundary final safety gate ready_metadata");
  }
  if (!releaseChecklistHas(checklist.checklist, "h38 entry readiness ready_metadata", true)) {
    findings.push("checklist missing h38 entry readiness ready_metadata");
  }
  if (!releaseChecklistHas(checklist.checklist, "no-enforcement proof diagnosticOnly", true)) {
    findings.push("checklist missing no-enforcement proof diagnosticOnly");
  }
  if (!releaseChecklistHas(checklist.checklist, "execution-governance-forbidden proof complete", true)) {
    findings.push("checklist missing execution-governance-forbidden proof complete");
  }
  if (!blockersAligned(blockerReport, summary)) {
    findings.push("blocker report and summary.readinessBlockers misaligned");
  }
  if (
    summary.readinessStatus === "governance_release_metadata_ready" &&
    (blockerReport.blockers.length > 0 || summary.readinessBlockers.length > 0)
  ) {
    findings.push("governance_release_metadata_ready requires no release-readiness blockers");
  }

  let verificationStatus: RuntimeGovernanceReleaseReadinessVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("readinessMode metadata_only") ||
        f.includes("noEnforcementProof.diagnosticOnly") ||
        f.includes("forbidden proof incomplete") ||
        f.includes("governance_release_metadata_ready requires no release-readiness blockers")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H38.5: governance release-readiness verified_metadata — H39 entry 후보(enforcement 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H38.5: governance release-readiness partial — boundary·envelope·checklist 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H38.5: governance release-readiness failed — proof·blocker·mode alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_governance_release_readiness_verification_report",
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
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
