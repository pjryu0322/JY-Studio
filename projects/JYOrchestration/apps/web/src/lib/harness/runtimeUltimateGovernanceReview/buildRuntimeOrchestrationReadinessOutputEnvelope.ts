/**
 * H40 — orchestration readiness **output envelope**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeUltimateGovernanceReviewConstants";
import type {
  RuntimeOrchestrationReadinessOutputEnvelope,
  RuntimeOrchestrationForbiddenProof,
  RuntimeUltimateGovernanceBlockerReport,
  RuntimeUltimateGovernanceReviewSummary,
  RuntimeUltimateNoEnforcementProof,
} from "./runtimeUltimateGovernanceReviewTypes";

export function buildRuntimeOrchestrationReadinessOutputEnvelope(input: {
  readonly summary: RuntimeUltimateGovernanceReviewSummary;
  readonly noEnforcementProof: RuntimeUltimateNoEnforcementProof;
  readonly forbiddenProof: RuntimeOrchestrationForbiddenProof;
  readonly blockerReport: RuntimeUltimateGovernanceBlockerReport;
}): RuntimeOrchestrationReadinessOutputEnvelope {
  const { summary, noEnforcementProof, forbiddenProof, blockerReport } = input;

  const accepted =
    summary.reviewStatus === "ultimate_governance_metadata_ready" && blockerReport.blockers.length === 0;

  const envelopeRows = mergeSortedUniqueKo([
    `ultimateReviewAcceptedMetadata:${accepted}`,
    `finalOrchestrationReadinessValidationMetadata:${summary.reviewStatus}`,
    `ultimateNoEnforcementProofDiagnosticOnly:${noEnforcementProof.diagnosticOnly}`,
    `orchestrationForbiddenProofComplete:${forbiddenProof.actualOrchestrationForbidden}`,
    `reviewBlockerCount:${blockerReport.blockers.length}`,
    `reviewMode:${summary.reviewMode}`,
    "auditTraceMetadata:planning_only",
    ...noEnforcementProof.proofRows.slice(0, 4),
    ...forbiddenProof.proofRows.slice(0, 4),
  ]);

  return {
    mode: "runtime_orchestration_readiness_output_envelope",
    ...RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H40: orchestration readiness output envelope — accepted/rejected·proof metadata only(orchestration 없음)",
    ]),
  };
}
