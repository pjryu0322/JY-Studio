/**
 * H35 — release-gate final preflight **output envelope**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeReleaseGateNoExecutionProof,
  RuntimeReleaseGateOperationForbiddenProof,
  RuntimeReleaseGateOutputEnvelope,
  RuntimeReleaseGatePreflightBlockerReport,
  RuntimeReleaseGatePreflightSummary,
} from "./runtimeReleaseGatePreflightTypes";

export function buildRuntimeReleaseGateOutputEnvelope(input: {
  readonly summary: RuntimeReleaseGatePreflightSummary;
  readonly noExecutionProof: RuntimeReleaseGateNoExecutionProof;
  readonly operationForbiddenProof: RuntimeReleaseGateOperationForbiddenProof;
  readonly blockerReport: RuntimeReleaseGatePreflightBlockerReport;
}): RuntimeReleaseGateOutputEnvelope {
  const { summary, noExecutionProof, operationForbiddenProof, blockerReport } = input;

  const accepted =
    summary.preflightReadiness === "preflight_metadata_ready" && blockerReport.blockers.length === 0;

  const envelopeRows = mergeSortedUniqueKo([
    `releaseGateAcceptedMetadata:${accepted}`,
    `executionReadinessValidationMetadata:${summary.preflightReadiness}`,
    `noExecutionProofDiagnosticOnly:${noExecutionProof.diagnosticOnly}`,
    `operationForbiddenProofComplete:${operationForbiddenProof.actualReleaseEnforcementForbidden}`,
    `preflightBlockerCount:${blockerReport.blockers.length}`,
    `preflightMode:${summary.preflightMode}`,
    "auditTraceMetadata:planning_only",
    ...noExecutionProof.proofRows.slice(0, 4),
    ...operationForbiddenProof.proofRows.slice(0, 4),
  ]);

  return {
    mode: "runtime_release_gate_output_envelope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualReleaseEnforcementEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H35: release-gate output envelope — accepted/rejected·proof metadata only(집행 없음)",
    ]),
  };
}
