/**
 * H37 — governance boundary **scope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeExecutionGovernanceBoundaryScope } from "./runtimeExecutionGovernanceBoundaryTypes";

const FORBIDDEN_GOVERNANCE_OPERATIONS = [
  "actual execution",
  "actual execution routing",
  "actual release enforcement",
  "actual no-op shell execution",
  "actual execution shell execution",
  "actual runtime adapter invocation",
  "actual provider routing",
  "actual queue control",
  "actual rollback execution",
  "actual approval enforcement",
  "prompt mutation",
  "token enforcement",
  "context pruning",
  "merge blocking",
] as const;

export function buildRuntimeExecutionGovernanceBoundaryScope(
  reports: RuntimeSemanticPlanningReportsBeforeExecutionGovernanceBoundary
): RuntimeExecutionGovernanceBoundaryScope {
  const shellFinalGate = reports.runtimeExecutionBoundaryShellFinalSafetyGate;
  const shellScope = reports.runtimeExecutionBoundaryShellScope;

  const requiredInputMetadata = mergeSortedUniqueKo([
    "runtimeExecutionBoundaryShellFinalSafetyGate",
    "runtimeExecutionBoundaryShellReadinessVerificationReport",
    "runtimeExecutionBoundaryShellAlignmentReport",
    "runtimeExecutionBoundaryShellBoundaryViolationReport",
    "runtimeExecutionBoundaryShellSummary",
    "runtimeExecutionBoundaryShellPolicy",
    ...shellScope.requiredInputMetadata.slice(0, 6),
  ]);

  const expectedOutputMetadata = mergeSortedUniqueKo([
    "runtimeExecutionGovernanceBoundarySummary",
    "runtimeExecutionGovernanceBoundaryScope",
    "runtimeExecutionGovernanceBoundaryPolicy",
    "runtimeExecutionGovernanceBoundaryBlockerReport",
    "runtimeExecutionGovernanceBoundaryReadinessChecklist",
    `shellFinalGate:${shellFinalGate.finalGateStatus}`,
    `h37EntryReadiness:${shellFinalGate.h37EntryReadiness}`,
  ]);

  const allowedGovernanceMetadataScopes = mergeSortedUniqueKo([
    "governance_boundary_candidate_status",
    "governance_boundary_mode_metadata_only",
    "governance_boundary_hardening_readiness",
    `h37EntryReadiness:${shellFinalGate.h37EntryReadiness}`,
    "diagnosticBundleIncludesExecutionGovernanceBoundary:metadata",
  ]);

  return {
    mode: "runtime_execution_governance_boundary_scope",
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
    candidateSourceLayer: "runtimeExecutionBoundaryShellFinalSafetyGate",
    candidateTargetLayer: "finalExecutionGovernanceBoundaryCandidate",
    requiredInputMetadata,
    expectedOutputMetadata,
    allowedGovernanceMetadataScopes,
    forbiddenGovernanceOperations: [...FORBIDDEN_GOVERNANCE_OPERATIONS],
    recommendations: mergeSortedUniqueKo([
      "H37: governance boundary scope — metadata_only candidate(실제 execution·governance enforcement 없음)",
    ]),
  };
}
