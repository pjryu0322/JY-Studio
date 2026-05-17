/**
 * H35.5 — release-gate preflight **alignment report**(read-only; H36 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { isRuntimeReleaseGateOperationForbiddenProofComplete } from "./buildRuntimeReleaseGateOperationForbiddenProof";
import {
  preflightBoundaryIncludesForbidden,
  preflightChecklistHasLabel,
  preflightEnvelopeIncludes,
} from "./runtimeReleaseGatePreflightCheckHelpers";
import type {
  RuntimeReleaseGateExecutionReadinessBoundary,
  RuntimeReleaseGateInputEnvelope,
  RuntimeReleaseGateNoExecutionProof,
  RuntimeReleaseGateOperationForbiddenProof,
  RuntimeReleaseGateOutputEnvelope,
  RuntimeReleaseGatePreflightAlignmentReport,
  RuntimeReleaseGatePreflightBlockerReport,
  RuntimeReleaseGatePreflightBoundaryViolationReport,
  RuntimeReleaseGatePreflightChecklist,
  RuntimeReleaseGatePreflightSummary,
} from "./runtimeReleaseGatePreflightTypes";

export function buildRuntimeReleaseGatePreflightAlignmentReport(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight;
  readonly summary: RuntimeReleaseGatePreflightSummary;
  readonly boundary: RuntimeReleaseGateExecutionReadinessBoundary;
  readonly inputEnvelope: RuntimeReleaseGateInputEnvelope;
  readonly outputEnvelope: RuntimeReleaseGateOutputEnvelope;
  readonly noExecutionProof: RuntimeReleaseGateNoExecutionProof;
  readonly operationForbiddenProof: RuntimeReleaseGateOperationForbiddenProof;
  readonly checklist: RuntimeReleaseGatePreflightChecklist;
  readonly blockerReport: RuntimeReleaseGatePreflightBlockerReport;
  readonly boundaryViolation: RuntimeReleaseGatePreflightBoundaryViolationReport;
}): RuntimeReleaseGatePreflightAlignmentReport {
  const {
    reports,
    summary,
    boundary,
    inputEnvelope,
    outputEnvelope,
    noExecutionProof,
    operationForbiddenProof,
    checklist,
    blockerReport,
    boundaryViolation,
  } = input;
  const releaseFinalGate = reports.runtimeNoopShellReleaseGateFinalSafetyGate;
  const findings: string[] = [];

  if (
    releaseFinalGate.finalGateStatus === "ready_metadata" &&
    summary.preflightReadiness !== "preflight_metadata_ready"
  ) {
    findings.push("release-gate final safety gate ready_metadata misaligned with preflight readiness");
  }
  if (
    summary.preflightReadiness === "preflight_metadata_ready" &&
    releaseFinalGate.finalGateStatus !== "ready_metadata"
  ) {
    findings.push("preflight_metadata_ready requires release-gate final gate ready_metadata");
  }
  if (
    operationForbiddenProof.actualReleaseEnforcementForbidden === true &&
    !preflightBoundaryIncludesForbidden(boundary, "release enforcement")
  ) {
    findings.push("execution readiness boundary missing release enforcement forbidden operation");
  }
  if (
    operationForbiddenProof.actualShellExecutionForbidden === true &&
    !preflightBoundaryIncludesForbidden(boundary, "no-op shell execution")
  ) {
    findings.push("execution readiness boundary missing no-op shell execution forbidden operation");
  }
  if (!preflightEnvelopeIncludes(inputEnvelope.envelopeRows, "runtimeNoopShellReleaseGateFinalSafetyGate")) {
    findings.push("input envelope missing release-gate final safety gate");
  }
  if (!preflightEnvelopeIncludes(inputEnvelope.envelopeRows, "runtimeNoopShellReleaseGateSummary")) {
    findings.push("input envelope missing release-gate summary");
  }
  if (!preflightEnvelopeIncludes(inputEnvelope.envelopeRows, "runtimeNoopShellReleaseGatePolicy")) {
    findings.push("input envelope missing release-gate policy");
  }
  if (!preflightEnvelopeIncludes(inputEnvelope.envelopeRows, "ReadinessVerification")) {
    findings.push("input envelope missing release-gate readiness verification");
  }
  if (!preflightEnvelopeIncludes(inputEnvelope.envelopeRows, "AlignmentReport")) {
    findings.push("input envelope missing release-gate alignment report");
  }
  if (!preflightEnvelopeIncludes(inputEnvelope.envelopeRows, "BoundaryViolationReport")) {
    findings.push("input envelope missing release-gate boundary violation report");
  }
  if (!preflightEnvelopeIncludes(outputEnvelope.envelopeRows, "noExecutionProof")) {
    findings.push("output envelope missing no-execution proof");
  }
  if (!preflightEnvelopeIncludes(outputEnvelope.envelopeRows, "operationForbidden")) {
    findings.push("output envelope missing operation-forbidden proof");
  }
  if (!preflightEnvelopeIncludes(outputEnvelope.envelopeRows, "auditTrace")) {
    findings.push("output envelope missing audit trace metadata");
  }
  if (noExecutionProof.diagnosticOnly !== true) {
    findings.push("no-execution proof diagnosticOnly must be true");
  }
  if (!isRuntimeReleaseGateOperationForbiddenProofComplete(operationForbiddenProof)) {
    findings.push("operation-forbidden proof incomplete");
  }
  if (!preflightChecklistHasLabel(checklist.checklist, "no-execution proof diagnosticOnly")) {
    findings.push("preflight checklist missing no-execution proof row");
  }
  if (!preflightChecklistHasLabel(checklist.checklist, "operation-forbidden proof complete")) {
    findings.push("preflight checklist missing operation-forbidden proof row");
  }
  if (blockerReport.blockers.length > 0) {
    const misaligned = blockerReport.blockers.some((b) => !summary.preflightBlockers.includes(b));
    if (misaligned) {
      findings.push("blocker report misaligned with summary.preflightBlockers");
    }
  }
  if (
    summary.preflightReadiness === "preflight_metadata_ready" &&
    (boundaryViolation.actualFlagViolations.length > 0 || boundaryViolation.proofViolations.length > 0)
  ) {
    findings.push("preflight_metadata_ready requires empty boundary violations");
  }

  let alignmentStatus: RuntimeReleaseGatePreflightAlignmentReport["alignmentStatus"];
  if (findings.length === 0) {
    alignmentStatus = "aligned_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("operation-forbidden proof incomplete") ||
        f.includes("diagnosticOnly must be true") ||
        f.includes("empty boundary violations") ||
        f.includes("misaligned with preflight readiness")
    )
  ) {
    alignmentStatus = "failed";
  } else {
    alignmentStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(alignmentStatus === "aligned_metadata"
      ? ["H35.5: preflight alignment aligned_metadata — H36 execution boundary metadata shell 후보(집행 없음)"]
      : []),
    ...(alignmentStatus === "partial"
      ? ["H35.5: preflight alignment partial — envelope·boundary·checklist rows 재검토"]
      : []),
    ...(alignmentStatus === "failed"
      ? ["H35.5: preflight alignment failed — release-gate final gate·proof·blocker 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_release_gate_preflight_alignment_report",
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
