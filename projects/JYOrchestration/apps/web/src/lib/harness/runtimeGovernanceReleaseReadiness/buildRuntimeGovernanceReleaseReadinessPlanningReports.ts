/**
 * H38 / H38.5 — governance release-readiness planning reports 일괄 산출(read-only).
 */

import type { RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { buildRuntimeExecutionGovernanceForbiddenProof } from "./buildRuntimeExecutionGovernanceForbiddenProof";
import { buildRuntimeGovernanceNoEnforcementProof } from "./buildRuntimeGovernanceNoEnforcementProof";
import { buildRuntimeGovernanceReleaseInputEnvelope } from "./buildRuntimeGovernanceReleaseInputEnvelope";
import { buildRuntimeGovernanceReleaseOutputEnvelope } from "./buildRuntimeGovernanceReleaseOutputEnvelope";
import { buildRuntimeGovernanceReleaseReadinessAlignmentReport } from "./buildRuntimeGovernanceReleaseReadinessAlignmentReport";
import { buildRuntimeGovernanceReleaseReadinessBoundary } from "./buildRuntimeGovernanceReleaseReadinessBoundary";
import { buildRuntimeGovernanceReleaseReadinessChecklist } from "./buildRuntimeGovernanceReleaseReadinessChecklist";
import { buildRuntimeGovernanceReleaseReadinessFinalSafetyGate } from "./buildRuntimeGovernanceReleaseReadinessFinalSafetyGate";
import { buildRuntimeGovernanceReleaseReadinessSummary } from "./buildRuntimeGovernanceReleaseReadinessSummary";
import { detectRuntimeGovernanceReleaseBlockers } from "./detectRuntimeGovernanceReleaseBlockers";
import { detectRuntimeGovernanceReleaseReadinessViolations } from "./detectRuntimeGovernanceReleaseReadinessViolations";
import { verifyRuntimeGovernanceReleaseReadiness } from "./verifyRuntimeGovernanceReleaseReadiness";
import type { RuntimeGovernanceReleaseReadinessPlanningReports } from "./runtimeGovernanceReleaseReadinessTypes";

export type { RuntimeGovernanceReleaseReadinessPlanningReports } from "./runtimeGovernanceReleaseReadinessTypes";

function mergeGovernanceReleaseLayerRecommendations(
  parts: readonly { readonly recommendations: readonly string[] }[]
): readonly string[] {
  return mergeSortedUniqueKo(parts.flatMap((part) => [...part.recommendations]));
}

export function buildRuntimeGovernanceReleaseReadinessPlanningReports(
  reports: RuntimeSemanticPlanningReportsBeforeGovernanceReleaseReadiness
): RuntimeGovernanceReleaseReadinessPlanningReports {
  const runtimeGovernanceReleaseBlockerReport = detectRuntimeGovernanceReleaseBlockers(reports);
  const runtimeGovernanceReleaseReadinessBoundary = buildRuntimeGovernanceReleaseReadinessBoundary();
  const runtimeGovernanceReleaseInputEnvelope = buildRuntimeGovernanceReleaseInputEnvelope(reports);
  const runtimeGovernanceNoEnforcementProof = buildRuntimeGovernanceNoEnforcementProof();
  const runtimeExecutionGovernanceForbiddenProof = buildRuntimeExecutionGovernanceForbiddenProof();

  const runtimeGovernanceReleaseReadinessSummaryDraft = buildRuntimeGovernanceReleaseReadinessSummary({
    reports,
    blockerReport: runtimeGovernanceReleaseBlockerReport,
    noEnforcementProof: runtimeGovernanceNoEnforcementProof,
    forbiddenProof: runtimeExecutionGovernanceForbiddenProof,
  });

  const runtimeGovernanceReleaseOutputEnvelope = buildRuntimeGovernanceReleaseOutputEnvelope({
    summary: runtimeGovernanceReleaseReadinessSummaryDraft,
    noEnforcementProof: runtimeGovernanceNoEnforcementProof,
    forbiddenProof: runtimeExecutionGovernanceForbiddenProof,
    blockerReport: runtimeGovernanceReleaseBlockerReport,
  });

  const runtimeGovernanceReleaseReadinessChecklist = buildRuntimeGovernanceReleaseReadinessChecklist({
    reports,
    blockerReport: runtimeGovernanceReleaseBlockerReport,
    noEnforcementProof: runtimeGovernanceNoEnforcementProof,
    forbiddenProof: runtimeExecutionGovernanceForbiddenProof,
  });

  const runtimeGovernanceReleaseReadinessViolationReport = detectRuntimeGovernanceReleaseReadinessViolations({
    summary: runtimeGovernanceReleaseReadinessSummaryDraft,
    noEnforcementProof: runtimeGovernanceNoEnforcementProof,
    forbiddenProof: runtimeExecutionGovernanceForbiddenProof,
  });

  const runtimeGovernanceReleaseReadinessVerificationReport = verifyRuntimeGovernanceReleaseReadiness({
    summary: runtimeGovernanceReleaseReadinessSummaryDraft,
    boundary: runtimeGovernanceReleaseReadinessBoundary,
    inputEnvelope: runtimeGovernanceReleaseInputEnvelope,
    outputEnvelope: runtimeGovernanceReleaseOutputEnvelope,
    noEnforcementProof: runtimeGovernanceNoEnforcementProof,
    forbiddenProof: runtimeExecutionGovernanceForbiddenProof,
    checklist: runtimeGovernanceReleaseReadinessChecklist,
    blockerReport: runtimeGovernanceReleaseBlockerReport,
  });

  const runtimeGovernanceReleaseReadinessAlignmentReport = buildRuntimeGovernanceReleaseReadinessAlignmentReport({
    reports,
    summary: runtimeGovernanceReleaseReadinessSummaryDraft,
    boundary: runtimeGovernanceReleaseReadinessBoundary,
    inputEnvelope: runtimeGovernanceReleaseInputEnvelope,
    outputEnvelope: runtimeGovernanceReleaseOutputEnvelope,
    noEnforcementProof: runtimeGovernanceNoEnforcementProof,
    forbiddenProof: runtimeExecutionGovernanceForbiddenProof,
    checklist: runtimeGovernanceReleaseReadinessChecklist,
    blockerReport: runtimeGovernanceReleaseBlockerReport,
    boundaryViolation: runtimeGovernanceReleaseReadinessViolationReport,
  });

  const runtimeGovernanceReleaseReadinessFinalSafetyGate = buildRuntimeGovernanceReleaseReadinessFinalSafetyGate({
    summary: runtimeGovernanceReleaseReadinessSummaryDraft,
    blockerReport: runtimeGovernanceReleaseBlockerReport,
    boundaryViolation: runtimeGovernanceReleaseReadinessViolationReport,
    readinessVerification: runtimeGovernanceReleaseReadinessVerificationReport,
    alignmentReport: runtimeGovernanceReleaseReadinessAlignmentReport,
  });

  const runtimeGovernanceReleaseReadinessSummary = {
    ...runtimeGovernanceReleaseReadinessSummaryDraft,
    recommendations: mergeGovernanceReleaseLayerRecommendations([
      runtimeGovernanceReleaseReadinessSummaryDraft,
      runtimeGovernanceReleaseReadinessBoundary,
      runtimeGovernanceReleaseInputEnvelope,
      runtimeGovernanceReleaseOutputEnvelope,
      runtimeGovernanceNoEnforcementProof,
      runtimeExecutionGovernanceForbiddenProof,
      runtimeGovernanceReleaseReadinessChecklist,
      runtimeGovernanceReleaseReadinessViolationReport,
      runtimeGovernanceReleaseReadinessVerificationReport,
      runtimeGovernanceReleaseReadinessAlignmentReport,
      runtimeGovernanceReleaseReadinessFinalSafetyGate,
    ]),
  };

  return {
    runtimeGovernanceReleaseReadinessSummary,
    runtimeGovernanceReleaseReadinessBoundary,
    runtimeGovernanceReleaseInputEnvelope,
    runtimeGovernanceReleaseOutputEnvelope,
    runtimeGovernanceNoEnforcementProof,
    runtimeExecutionGovernanceForbiddenProof,
    runtimeGovernanceReleaseBlockerReport,
    runtimeGovernanceReleaseReadinessChecklist,
    runtimeGovernanceReleaseReadinessViolationReport,
    runtimeGovernanceReleaseReadinessVerificationReport,
    runtimeGovernanceReleaseReadinessAlignmentReport,
    runtimeGovernanceReleaseReadinessFinalSafetyGate,
  };
}
