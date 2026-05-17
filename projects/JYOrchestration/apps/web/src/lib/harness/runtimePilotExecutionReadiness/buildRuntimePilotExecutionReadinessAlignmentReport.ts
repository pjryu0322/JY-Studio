/**
 * H44.5 — pilot execution readiness **alignment report**(read-only; H45 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  PILOT_EXECUTION_READINESS_ALIGNMENT_CHECKLIST_LABEL_ROWS,
  RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
} from "./runtimePilotExecutionReadinessConstants";
import {
  envelopeIncludes,
  isRuntimeFinalPilotExecutionForbiddenProofComplete,
  isRuntimeFinalPilotNoExecutionProofValid,
  pilotExecutionReadinessBlockersAligned,
  pilotExecutionReadinessForbiddenIncludes,
  readPilotExecutionReadinessUpstreamContext,
  resolvePilotExecutionReadinessAlignmentStatus,
  runtimeChecklistHasLabel,
  PILOT_EXECUTION_READINESS_BOUNDARY_SOURCE_LAYER,
  PILOT_EXECUTION_READINESS_BOUNDARY_TARGET_LAYER,
} from "./runtimePilotExecutionReadinessCheckHelpers";
import type {
  RuntimeFinalPilotExecutionForbiddenProof,
  RuntimeFinalPilotNoExecutionProof,
  RuntimePilotExecutionReadinessAlignmentReport,
  RuntimePilotExecutionReadinessBlockerReport,
  RuntimePilotExecutionReadinessBoundary,
  RuntimePilotExecutionReadinessChecklist,
  RuntimePilotExecutionReadinessInputEnvelope,
  RuntimePilotExecutionReadinessOutputEnvelope,
  RuntimePilotExecutionReadinessSummary,
  RuntimePilotExecutionReadinessViolationReport,
} from "./runtimePilotExecutionReadinessTypes";

export function buildRuntimePilotExecutionReadinessAlignmentReport(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforePilotExecutionReadiness;
  readonly summary: RuntimePilotExecutionReadinessSummary;
  readonly boundary: RuntimePilotExecutionReadinessBoundary;
  readonly inputEnvelope: RuntimePilotExecutionReadinessInputEnvelope;
  readonly outputEnvelope: RuntimePilotExecutionReadinessOutputEnvelope;
  readonly noExecutionProof: RuntimeFinalPilotNoExecutionProof;
  readonly forbiddenProof: RuntimeFinalPilotExecutionForbiddenProof;
  readonly checklist: RuntimePilotExecutionReadinessChecklist;
  readonly blockerReport: RuntimePilotExecutionReadinessBlockerReport;
  readonly executionViolation: RuntimePilotExecutionReadinessViolationReport;
}): RuntimePilotExecutionReadinessAlignmentReport {
  const {
    reports,
    summary,
    boundary,
    inputEnvelope,
    outputEnvelope,
    noExecutionProof,
    forbiddenProof,
    checklist,
    blockerReport,
    executionViolation,
  } = input;
  const upstream = readPilotExecutionReadinessUpstreamContext(reports);
  const findings: string[] = [];

  if (
    summary.readinessStatus === "pilot_execution_readiness_metadata_ready" &&
    upstream.reviewFinalGate.finalGateStatus !== "ready_metadata"
  ) {
    findings.push("limited pilot readiness review final gate misaligned with pilot execution readiness summary");
  }
  if (boundary.boundarySourceLayer !== PILOT_EXECUTION_READINESS_BOUNDARY_SOURCE_LAYER) {
    findings.push(`boundary.boundarySourceLayer must be ${PILOT_EXECUTION_READINESS_BOUNDARY_SOURCE_LAYER}`);
  }
  if (boundary.boundaryTargetLayer !== PILOT_EXECUTION_READINESS_BOUNDARY_TARGET_LAYER) {
    findings.push(`boundary.boundaryTargetLayer must be ${PILOT_EXECUTION_READINESS_BOUNDARY_TARGET_LAYER}`);
  }
  if (!pilotExecutionReadinessForbiddenIncludes(boundary.forbiddenBoundaryOperations, "actual pilot activation")) {
    findings.push("forbiddenBoundaryOperations missing actual pilot activation");
  }
  if (!pilotExecutionReadinessForbiddenIncludes(boundary.forbiddenBoundaryOperations, "actual pilot execution")) {
    findings.push("forbiddenBoundaryOperations missing actual pilot execution");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "reviewFinalGate")) {
    findings.push("input envelope misaligned with limited pilot readiness review final gate");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "reviewStatus")) {
    findings.push("input envelope misaligned with limited pilot readiness review summary");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "reviewVerification")) {
    findings.push("input envelope misaligned with limited pilot readiness review verification");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "reviewAlignment")) {
    findings.push("input envelope misaligned with limited pilot readiness review alignment");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "reviewViolationCount")) {
    findings.push("input envelope misaligned with limited pilot readiness review violation");
  }
  if (!envelopeIncludes(outputEnvelope.envelopeRows, "finalPilotNoExecutionProofDiagnosticOnly")) {
    findings.push("output envelope misaligned with final pilot no-execution proof");
  }
  if (!envelopeIncludes(outputEnvelope.envelopeRows, "finalPilotExecutionForbiddenProofComplete")) {
    findings.push("output envelope misaligned with final pilot execution-forbidden proof");
  }
  if (!envelopeIncludes(outputEnvelope.envelopeRows, "auditTraceMetadata")) {
    findings.push("output envelope missing audit trace metadata");
  }
  if (!isRuntimeFinalPilotNoExecutionProofValid(noExecutionProof)) {
    findings.push("final pilot no-execution proof misaligned with actual false flags");
  }
  if (!isRuntimeFinalPilotExecutionForbiddenProofComplete(forbiddenProof)) {
    findings.push("final pilot execution-forbidden proof misaligned with boundary");
  }
  for (const label of PILOT_EXECUTION_READINESS_ALIGNMENT_CHECKLIST_LABEL_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist misaligned: missing ${label}`);
    }
  }
  if (!runtimeChecklistHasLabel(checklist.checklist, "final pilot no-execution proof diagnosticOnly")) {
    findings.push("checklist misaligned with final pilot no-execution proof");
  }
  if (!runtimeChecklistHasLabel(checklist.checklist, "final pilot execution-forbidden proof complete")) {
    findings.push("checklist misaligned with final pilot execution-forbidden proof");
  }
  if (!pilotExecutionReadinessBlockersAligned(blockerReport.blockers, summary.readinessBlockers)) {
    findings.push("blocker report misaligned with summary.readinessBlockers");
  }
  if (executionViolation.actualFlagViolations.length > 0) {
    findings.push("execution violation actual flags require empty blockers for aligned_metadata");
  }

  const alignmentStatus = resolvePilotExecutionReadinessAlignmentStatus(findings);

  return {
    mode: "runtime_pilot_execution_readiness_alignment_report",
    ...RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations: mergeSortedUniqueKo([
      ...(alignmentStatus === "aligned_metadata"
        ? ["H44.5: pilot execution readiness aligned_metadata — H45 entry 후보(pilot activation 없음)"]
        : []),
      ...(alignmentStatus === "partial"
        ? ["H44.5: pilot execution readiness alignment partial — review final gate·envelope 재검토"]
        : []),
      ...(alignmentStatus === "failed"
        ? ["H44.5: pilot execution readiness alignment failed — boundary·proof·blocker 정렬"]
        : []),
    ]),
  };
}
