/**
 * H35 / H35.5 — release-gate final preflight planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeReleaseGateExecutionReadinessBoundary } from "./buildRuntimeReleaseGateExecutionReadinessBoundary";
import { buildRuntimeReleaseGateInputEnvelope } from "./buildRuntimeReleaseGateInputEnvelope";
import { buildRuntimeReleaseGateNoExecutionProof } from "./buildRuntimeReleaseGateNoExecutionProof";
import { buildRuntimeReleaseGateOperationForbiddenProof } from "./buildRuntimeReleaseGateOperationForbiddenProof";
import { buildRuntimeReleaseGateOutputEnvelope } from "./buildRuntimeReleaseGateOutputEnvelope";
import { buildRuntimeReleaseGatePreflightAlignmentReport } from "./buildRuntimeReleaseGatePreflightAlignmentReport";
import { buildRuntimeReleaseGatePreflightChecklist } from "./buildRuntimeReleaseGatePreflightChecklist";
import { buildRuntimeReleaseGatePreflightFinalSafetyGate } from "./buildRuntimeReleaseGatePreflightFinalSafetyGate";
import { buildRuntimeReleaseGatePreflightSummary } from "./buildRuntimeReleaseGatePreflightSummary";
import { detectRuntimeReleaseGatePreflightBlockers } from "./detectRuntimeReleaseGatePreflightBlockers";
import { detectRuntimeReleaseGatePreflightBoundaryViolations } from "./detectRuntimeReleaseGatePreflightBoundaryViolations";
import { verifyRuntimeReleaseGatePreflightReadiness } from "./verifyRuntimeReleaseGatePreflightReadiness";
import type { RuntimeReleaseGatePreflightPlanningReports } from "./runtimeReleaseGatePreflightTypes";

export type { RuntimeReleaseGatePreflightPlanningReports } from "./runtimeReleaseGatePreflightTypes";

function mergePreflightLayerRecommendations(
  parts: readonly { readonly recommendations: readonly string[] }[]
): readonly string[] {
  return mergeSortedUniqueKo(parts.flatMap((part) => [...part.recommendations]));
}

export function buildRuntimeReleaseGatePreflightPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeReleaseGatePreflight
): RuntimeReleaseGatePreflightPlanningReports {
  const runtimeReleaseGatePreflightBlockerReport = detectRuntimeReleaseGatePreflightBlockers(reports);
  const runtimeReleaseGateExecutionReadinessBoundary = buildRuntimeReleaseGateExecutionReadinessBoundary();
  const runtimeReleaseGateInputEnvelope = buildRuntimeReleaseGateInputEnvelope(reports);
  const runtimeReleaseGateNoExecutionProof = buildRuntimeReleaseGateNoExecutionProof();
  const runtimeReleaseGateOperationForbiddenProof = buildRuntimeReleaseGateOperationForbiddenProof();

  const runtimeReleaseGatePreflightSummary = buildRuntimeReleaseGatePreflightSummary({
    reports,
    blockerReport: runtimeReleaseGatePreflightBlockerReport,
    noExecutionProof: runtimeReleaseGateNoExecutionProof,
    operationForbiddenProof: runtimeReleaseGateOperationForbiddenProof,
  });

  const runtimeReleaseGateOutputEnvelope = buildRuntimeReleaseGateOutputEnvelope({
    summary: runtimeReleaseGatePreflightSummary,
    noExecutionProof: runtimeReleaseGateNoExecutionProof,
    operationForbiddenProof: runtimeReleaseGateOperationForbiddenProof,
    blockerReport: runtimeReleaseGatePreflightBlockerReport,
  });

  const runtimeReleaseGatePreflightChecklist = buildRuntimeReleaseGatePreflightChecklist({
    reports,
    blockerReport: runtimeReleaseGatePreflightBlockerReport,
    noExecutionProof: runtimeReleaseGateNoExecutionProof,
    operationForbiddenProof: runtimeReleaseGateOperationForbiddenProof,
  });

  const runtimeReleaseGatePreflightBoundaryViolationReport = detectRuntimeReleaseGatePreflightBoundaryViolations({
    summary: runtimeReleaseGatePreflightSummary,
    noExecutionProof: runtimeReleaseGateNoExecutionProof,
    operationForbiddenProof: runtimeReleaseGateOperationForbiddenProof,
  });

  const runtimeReleaseGatePreflightReadinessVerificationReport = verifyRuntimeReleaseGatePreflightReadiness({
    summary: runtimeReleaseGatePreflightSummary,
    boundary: runtimeReleaseGateExecutionReadinessBoundary,
    inputEnvelope: runtimeReleaseGateInputEnvelope,
    outputEnvelope: runtimeReleaseGateOutputEnvelope,
    noExecutionProof: runtimeReleaseGateNoExecutionProof,
    operationForbiddenProof: runtimeReleaseGateOperationForbiddenProof,
    checklist: runtimeReleaseGatePreflightChecklist,
    blockerReport: runtimeReleaseGatePreflightBlockerReport,
  });

  const runtimeReleaseGatePreflightAlignmentReport = buildRuntimeReleaseGatePreflightAlignmentReport({
    reports,
    summary: runtimeReleaseGatePreflightSummary,
    boundary: runtimeReleaseGateExecutionReadinessBoundary,
    inputEnvelope: runtimeReleaseGateInputEnvelope,
    outputEnvelope: runtimeReleaseGateOutputEnvelope,
    noExecutionProof: runtimeReleaseGateNoExecutionProof,
    operationForbiddenProof: runtimeReleaseGateOperationForbiddenProof,
    checklist: runtimeReleaseGatePreflightChecklist,
    blockerReport: runtimeReleaseGatePreflightBlockerReport,
    boundaryViolation: runtimeReleaseGatePreflightBoundaryViolationReport,
  });

  const runtimeReleaseGatePreflightFinalSafetyGate = buildRuntimeReleaseGatePreflightFinalSafetyGate({
    summary: runtimeReleaseGatePreflightSummary,
    blockerReport: runtimeReleaseGatePreflightBlockerReport,
    boundaryViolation: runtimeReleaseGatePreflightBoundaryViolationReport,
    readinessVerification: runtimeReleaseGatePreflightReadinessVerificationReport,
    alignmentReport: runtimeReleaseGatePreflightAlignmentReport,
  });

  const runtimeReleaseGatePreflightSummaryFinal = {
    ...runtimeReleaseGatePreflightSummary,
    recommendations: mergePreflightLayerRecommendations([
      runtimeReleaseGatePreflightSummary,
      runtimeReleaseGateExecutionReadinessBoundary,
      runtimeReleaseGateInputEnvelope,
      runtimeReleaseGateOutputEnvelope,
      runtimeReleaseGateNoExecutionProof,
      runtimeReleaseGateOperationForbiddenProof,
      runtimeReleaseGatePreflightChecklist,
      runtimeReleaseGatePreflightBoundaryViolationReport,
      runtimeReleaseGatePreflightReadinessVerificationReport,
      runtimeReleaseGatePreflightAlignmentReport,
      runtimeReleaseGatePreflightFinalSafetyGate,
    ]),
  };

  return {
    runtimeReleaseGatePreflightSummary: runtimeReleaseGatePreflightSummaryFinal,
    runtimeReleaseGateExecutionReadinessBoundary,
    runtimeReleaseGateInputEnvelope,
    runtimeReleaseGateOutputEnvelope,
    runtimeReleaseGateNoExecutionProof,
    runtimeReleaseGateOperationForbiddenProof,
    runtimeReleaseGatePreflightBlockerReport,
    runtimeReleaseGatePreflightChecklist,
    runtimeReleaseGatePreflightBoundaryViolationReport,
    runtimeReleaseGatePreflightReadinessVerificationReport,
    runtimeReleaseGatePreflightAlignmentReport,
    runtimeReleaseGatePreflightFinalSafetyGate,
  };
}
