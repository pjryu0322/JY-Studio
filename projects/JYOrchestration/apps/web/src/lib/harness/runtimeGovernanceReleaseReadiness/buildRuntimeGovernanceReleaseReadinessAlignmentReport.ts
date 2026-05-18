/**
 * H38.5 — governance release-readiness **alignment report**(read-only; H39 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { isRuntimeExecutionGovernanceForbiddenProofComplete } from "./buildRuntimeExecutionGovernanceForbiddenProof";
import {
  releaseChecklistHasLabel,
  releaseEnvelopeIncludesRow,
  releaseForbiddenIncludes,
} from "./runtimeGovernanceReleaseReadinessCheckHelpers";
import type {
  RuntimeExecutionGovernanceForbiddenProof,
  RuntimeGovernanceNoEnforcementProof,
  RuntimeGovernanceReleaseBlockerReport,
  RuntimeGovernanceReleaseInputEnvelope,
  RuntimeGovernanceReleaseOutputEnvelope,
  RuntimeGovernanceReleaseReadinessAlignmentReport,
  RuntimeGovernanceReleaseReadinessBoundary,
  RuntimeGovernanceReleaseReadinessChecklist,
  RuntimeGovernanceReleaseReadinessSummary,
  RuntimeGovernanceReleaseReadinessViolationReport,
} from "./runtimeGovernanceReleaseReadinessTypes";

export function buildRuntimeGovernanceReleaseReadinessAlignmentReport(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness;
  readonly summary: RuntimeGovernanceReleaseReadinessSummary;
  readonly boundary: RuntimeGovernanceReleaseReadinessBoundary;
  readonly inputEnvelope: RuntimeGovernanceReleaseInputEnvelope;
  readonly outputEnvelope: RuntimeGovernanceReleaseOutputEnvelope;
  readonly noEnforcementProof: RuntimeGovernanceNoEnforcementProof;
  readonly forbiddenProof: RuntimeExecutionGovernanceForbiddenProof;
  readonly checklist: RuntimeGovernanceReleaseReadinessChecklist;
  readonly blockerReport: RuntimeGovernanceReleaseBlockerReport;
  readonly boundaryViolation: RuntimeGovernanceReleaseReadinessViolationReport;
}): RuntimeGovernanceReleaseReadinessAlignmentReport {
  const {
    reports,
    summary,
    boundary,
    inputEnvelope,
    outputEnvelope,
    noEnforcementProof,
    forbiddenProof,
    checklist,
    blockerReport,
    boundaryViolation,
  } = input;
  const governanceFinalGate = reports.runtimeExecutionGovernanceBoundaryFinalSafetyGate;
  const findings: string[] = [];

  if (
    summary.readinessStatus === "governance_release_metadata_ready" &&
    governanceFinalGate.finalGateStatus !== "ready_metadata"
  ) {
    findings.push("governance boundary final gate misaligned with release-readiness summary");
  }
  if (boundary.boundarySourceLayer !== "runtimeExecutionGovernanceBoundaryFinalSafetyGate") {
    findings.push("boundary.boundarySourceLayer must be runtimeExecutionGovernanceBoundaryFinalSafetyGate");
  }
  if (boundary.boundaryTargetLayer !== "finalExecutionGovernanceReadinessBoundary") {
    findings.push("boundary.boundaryTargetLayer must be finalExecutionGovernanceReadinessBoundary");
  }
  if (!releaseForbiddenIncludes(boundary.forbiddenBoundaryOperations, "actual execution")) {
    findings.push("boundary.forbiddenBoundaryOperations missing actual execution");
  }
  if (!releaseForbiddenIncludes(boundary.forbiddenBoundaryOperations, "release enforcement")) {
    findings.push("boundary.forbiddenBoundaryOperations missing release enforcement");
  }
  if (!releaseForbiddenIncludes(boundary.forbiddenBoundaryOperations, "approval enforcement")) {
    findings.push("boundary.forbiddenBoundaryOperations missing approval enforcement");
  }
  if (!releaseEnvelopeIncludesRow(inputEnvelope.envelopeRows, "runtimeExecutionGovernanceBoundaryFinalSafetyGate")) {
    findings.push("input envelope missing governance boundary final gate row");
  }
  if (!releaseEnvelopeIncludesRow(inputEnvelope.envelopeRows, "runtimeExecutionGovernanceBoundarySummary")) {
    findings.push("input envelope missing governance boundary summary row");
  }
  if (!releaseEnvelopeIncludesRow(inputEnvelope.envelopeRows, "runtimeExecutionGovernanceBoundaryPolicy")) {
    findings.push("input envelope missing governance boundary policy row");
  }
  if (
    !releaseEnvelopeIncludesRow(
      inputEnvelope.envelopeRows,
      "runtimeExecutionGovernanceBoundaryReadinessVerificationReport"
    )
  ) {
    findings.push("input envelope missing governance boundary readiness verification row");
  }
  if (!releaseEnvelopeIncludesRow(inputEnvelope.envelopeRows, "runtimeExecutionGovernanceBoundaryAlignmentReport")) {
    findings.push("input envelope missing governance boundary alignment row");
  }
  if (!releaseEnvelopeIncludesRow(inputEnvelope.envelopeRows, "runtimeExecutionGovernanceBoundaryViolationReport")) {
    findings.push("input envelope missing governance boundary violation row");
  }
  if (!releaseEnvelopeIncludesRow(outputEnvelope.envelopeRows, "noEnforcementProofDiagnosticOnly")) {
    findings.push("output envelope missing no-enforcement proof row");
  }
  if (!releaseEnvelopeIncludesRow(outputEnvelope.envelopeRows, "executionGovernanceForbiddenProof")) {
    findings.push("output envelope missing forbidden proof row");
  }
  if (noEnforcementProof.diagnosticOnly !== true) {
    findings.push("no-enforcement proof diagnosticOnly must be true");
  }
  if (!isRuntimeExecutionGovernanceForbiddenProofComplete(forbiddenProof)) {
    findings.push("execution-governance-forbidden proof incomplete");
  }
  if (!releaseChecklistHasLabel(checklist.checklist, "no-enforcement proof diagnosticOnly")) {
    findings.push("readiness checklist missing no-enforcement proof row");
  }
  if (!releaseChecklistHasLabel(checklist.checklist, "execution-governance-forbidden proof complete")) {
    findings.push("readiness checklist missing forbidden proof row");
  }
  if (blockerReport.blockers.length > 0) {
    const misaligned = blockerReport.blockers.some((b) => !summary.readinessBlockers.includes(b));
    if (misaligned) {
      findings.push("blocker report misaligned with summary.readinessBlockers");
    }
  }
  if (
    summary.readinessStatus === "governance_release_metadata_ready" &&
    (boundaryViolation.actualFlagViolations.length > 0 || boundaryViolation.proofViolations.length > 0)
  ) {
    findings.push("governance_release_metadata_ready requires empty release-readiness violations");
  }

  let alignmentStatus: RuntimeGovernanceReleaseReadinessAlignmentReport["alignmentStatus"];
  if (findings.length === 0) {
    alignmentStatus = "aligned_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("forbidden proof incomplete") ||
        f.includes("diagnosticOnly must be true") ||
        f.includes("empty release-readiness violations") ||
        f.includes("misaligned with release-readiness summary")
    )
  ) {
    alignmentStatus = "failed";
  } else {
    alignmentStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(alignmentStatus === "aligned_metadata"
      ? ["H38.5: governance release-readiness alignment aligned_metadata — H39 entry 후보(enforcement 없음)"]
      : []),
    ...(alignmentStatus === "partial"
      ? ["H38.5: governance release-readiness alignment partial — envelope·forbidden·checklist rows 재검토"]
      : []),
    ...(alignmentStatus === "failed"
      ? ["H38.5: governance release-readiness alignment failed — proof·blocker·violation 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_governance_release_readiness_alignment_report",
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
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations,
  };
}
