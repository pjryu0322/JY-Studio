/**
 * H35.5 — release-gate preflight summary·boundary·envelope·proof **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { isRuntimeReleaseGateOperationForbiddenProofComplete } from "./buildRuntimeReleaseGateOperationForbiddenProof";
import { preflightChecklistHas, preflightEnvelopeIncludes } from "./runtimeReleaseGatePreflightCheckHelpers";
import type {
  RuntimeReleaseGateExecutionReadinessBoundary,
  RuntimeReleaseGateInputEnvelope,
  RuntimeReleaseGateNoExecutionProof,
  RuntimeReleaseGateOperationForbiddenProof,
  RuntimeReleaseGateOutputEnvelope,
  RuntimeReleaseGatePreflightBlockerReport,
  RuntimeReleaseGatePreflightChecklist,
  RuntimeReleaseGatePreflightReadinessVerificationReport,
  RuntimeReleaseGatePreflightSummary,
} from "./runtimeReleaseGatePreflightTypes";

function blockersAligned(
  blockerReport: RuntimeReleaseGatePreflightBlockerReport,
  summary: RuntimeReleaseGatePreflightSummary
): boolean {
  if (blockerReport.blockers.length === 0 && summary.preflightBlockers.length === 0) {
    return true;
  }
  if (blockerReport.blockers.length > 0) {
    return blockerReport.blockers.every((b) => summary.preflightBlockers.includes(b));
  }
  return true;
}

export function verifyRuntimeReleaseGatePreflightReadiness(input: {
  readonly summary: RuntimeReleaseGatePreflightSummary;
  readonly boundary: RuntimeReleaseGateExecutionReadinessBoundary;
  readonly inputEnvelope: RuntimeReleaseGateInputEnvelope;
  readonly outputEnvelope: RuntimeReleaseGateOutputEnvelope;
  readonly noExecutionProof: RuntimeReleaseGateNoExecutionProof;
  readonly operationForbiddenProof: RuntimeReleaseGateOperationForbiddenProof;
  readonly checklist: RuntimeReleaseGatePreflightChecklist;
  readonly blockerReport: RuntimeReleaseGatePreflightBlockerReport;
}): RuntimeReleaseGatePreflightReadinessVerificationReport {
  const {
    summary,
    boundary,
    inputEnvelope,
    outputEnvelope,
    noExecutionProof,
    operationForbiddenProof,
    checklist,
    blockerReport,
  } = input;
  const findings: string[] = [];

  if (
    summary.preflightReadiness === "preflight_metadata_ready" &&
    summary.preflightMode !== "metadata_only"
  ) {
    findings.push("preflight_metadata_ready requires preflightMode metadata_only");
  }
  if (summary.preflightReadiness === "blocked" && summary.preflightBlockers.length === 0) {
    findings.push("blocked preflightReadiness requires preflightBlockers");
  }
  if (boundary.boundarySourceLayer !== "runtimeNoopShellReleaseGateFinalSafetyGate") {
    findings.push("boundary.boundarySourceLayer must be runtimeNoopShellReleaseGateFinalSafetyGate");
  }
  if (boundary.boundaryTargetLayer !== "controlledReleaseGateFinalPreflight") {
    findings.push("boundary.boundaryTargetLayer must be controlledReleaseGateFinalPreflight");
  }
  if (boundary.forbiddenBoundaryOperations.length === 0) {
    findings.push("boundary.forbiddenBoundaryOperations must be non-empty");
  }
  if (!preflightEnvelopeIncludes(inputEnvelope.envelopeRows, "runtimeNoopShellReleaseGateFinalSafetyGate")) {
    findings.push("input envelope missing runtimeNoopShellReleaseGateFinalSafetyGate");
  }
  if (!preflightEnvelopeIncludes(inputEnvelope.envelopeRows, "runtimeNoopShellReleaseGateReadinessVerificationReport")) {
    findings.push("input envelope missing runtimeNoopShellReleaseGateReadinessVerificationReport");
  }
  if (!preflightEnvelopeIncludes(inputEnvelope.envelopeRows, "runtimeNoopShellReleaseGateAlignmentReport")) {
    findings.push("input envelope missing runtimeNoopShellReleaseGateAlignmentReport");
  }
  if (!preflightEnvelopeIncludes(outputEnvelope.envelopeRows, "noExecutionProof")) {
    findings.push("output envelope missing no-execution proof metadata");
  }
  if (!preflightEnvelopeIncludes(outputEnvelope.envelopeRows, "operationForbidden")) {
    findings.push("output envelope missing operation-forbidden proof metadata");
  }
  if (noExecutionProof.diagnosticOnly !== true) {
    findings.push("noExecutionProof.diagnosticOnly must be true");
  }
  if (!isRuntimeReleaseGateOperationForbiddenProofComplete(operationForbiddenProof)) {
    findings.push("operation-forbidden proof incomplete");
  }
  if (!preflightChecklistHas(checklist.checklist, "release-gate final safety gate ready_metadata", true)) {
    findings.push("checklist missing release-gate final safety gate ready_metadata");
  }
  if (!preflightChecklistHas(checklist.checklist, "h35 entry readiness ready_metadata", true)) {
    findings.push("checklist missing h35 entry readiness ready_metadata");
  }
  if (!preflightChecklistHas(checklist.checklist, "no-execution proof diagnosticOnly", true)) {
    findings.push("checklist missing no-execution proof diagnosticOnly");
  }
  if (!preflightChecklistHas(checklist.checklist, "operation-forbidden proof complete", true)) {
    findings.push("checklist missing operation-forbidden proof complete");
  }
  if (!blockersAligned(blockerReport, summary)) {
    findings.push("blocker report and summary.preflightBlockers misaligned");
  }

  let verificationStatus: RuntimeReleaseGatePreflightReadinessVerificationReport["verificationStatus"];
  if (findings.length === 0) {
    verificationStatus = "verified_metadata";
  } else if (
    findings.some(
      (f) =>
        f.includes("operation-forbidden proof incomplete") ||
        f.includes("noExecutionProof.diagnosticOnly") ||
        f.includes("blocked preflightReadiness requires preflightBlockers") ||
        f.includes("preflight_metadata_ready requires preflightMode")
    )
  ) {
    verificationStatus = "failed";
  } else {
    verificationStatus = "partial";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H35.5: preflight readiness verified_metadata — H36 entry boundary 후보(집행 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H35.5: preflight readiness partial — boundary·envelope·checklist 정합성 재검토"]
      : []),
    ...(verificationStatus === "failed"
      ? ["H35.5: preflight readiness failed — proof·blocker·mode alignment 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_release_gate_preflight_readiness_verification_report",
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
