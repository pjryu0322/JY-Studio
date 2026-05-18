/**
 * H43 — pilot readiness **output envelope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotReadinessReviewConstants";
import type {
  RuntimeLimitedPilotReadinessReviewSummary,
  RuntimePilotExecutionForbiddenProof,
  RuntimePilotNoExecutionProof,
  RuntimePilotReadinessBlockerReport,
  RuntimePilotReadinessOutputEnvelope,
} from "./runtimeLimitedPilotReadinessReviewTypes";

export function buildRuntimePilotReadinessOutputEnvelope(input: {
  readonly summary: RuntimeLimitedPilotReadinessReviewSummary;
  readonly noExecutionProof: RuntimePilotNoExecutionProof;
  readonly forbiddenProof: RuntimePilotExecutionForbiddenProof;
  readonly blockerReport: RuntimePilotReadinessBlockerReport;
}): RuntimePilotReadinessOutputEnvelope {
  const { summary, noExecutionProof, forbiddenProof, blockerReport } = input;

  const accepted =
    summary.reviewStatus === "limited_pilot_readiness_metadata_ready" &&
    blockerReport.blockers.length === 0;

  const envelopeRows = mergeSortedUniqueKo([
    `pilotReadinessAcceptedMetadata:${accepted}`,
    `pilotContractHardeningMetadata:${summary.reviewMode}`,
    `pilotNoExecutionProofDiagnosticOnly:${noExecutionProof.diagnosticOnly}`,
    `pilotExecutionForbiddenProofComplete:${forbiddenProof.actualPilotActivationForbidden}`,
    `pilotReadinessBlockerCount:${blockerReport.blockers.length}`,
    `reviewMode:${summary.reviewMode}`,
    "auditTraceMetadata:planning_only",
    ...noExecutionProof.proofRows.slice(0, 4),
    ...forbiddenProof.proofRows.slice(0, 4),
  ]);

  return {
    mode: "runtime_pilot_readiness_output_envelope",
    ...RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H43: pilot readiness output envelope — accepted/rejected·contract hardening metadata only(pilot activation·execution 없음)",
    ]),
  };
}
