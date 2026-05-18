/**
 * H38 — governance release-readiness **output envelope**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeGovernanceNoEnforcementProof,
  RuntimeExecutionGovernanceForbiddenProof,
  RuntimeGovernanceReleaseBlockerReport,
  RuntimeGovernanceReleaseOutputEnvelope,
  RuntimeGovernanceReleaseReadinessSummary,
} from "./runtimeGovernanceReleaseReadinessTypes";

export function buildRuntimeGovernanceReleaseOutputEnvelope(input: {
  readonly summary: RuntimeGovernanceReleaseReadinessSummary;
  readonly noEnforcementProof: RuntimeGovernanceNoEnforcementProof;
  readonly forbiddenProof: RuntimeExecutionGovernanceForbiddenProof;
  readonly blockerReport: RuntimeGovernanceReleaseBlockerReport;
}): RuntimeGovernanceReleaseOutputEnvelope {
  const { summary, noEnforcementProof, forbiddenProof, blockerReport } = input;

  const accepted =
    summary.readinessStatus === "governance_release_metadata_ready" && blockerReport.blockers.length === 0;

  const envelopeRows = mergeSortedUniqueKo([
    `releaseReadinessAcceptedMetadata:${accepted}`,
    `executionGovernanceReadinessValidationMetadata:${summary.readinessStatus}`,
    `noEnforcementProofDiagnosticOnly:${noEnforcementProof.diagnosticOnly}`,
    `executionGovernanceForbiddenProofComplete:${forbiddenProof.actualApprovalEnforcementForbidden}`,
    `readinessBlockerCount:${blockerReport.blockers.length}`,
    `readinessMode:${summary.readinessMode}`,
    "auditTraceMetadata:planning_only",
    ...noEnforcementProof.proofRows.slice(0, 4),
    ...forbiddenProof.proofRows.slice(0, 4),
  ]);

  return {
    mode: "runtime_governance_release_output_envelope",
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
    envelopeRows,
    recommendations: mergeSortedUniqueKo([
      "H38: governance release output envelope — accepted/rejected·proof metadata only(enforcement 없음)",
    ]),
  };
}
