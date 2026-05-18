/**
 * H36 — execution boundary shell **scope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeExecutionBoundaryShellScope } from "./runtimeExecutionBoundaryShellTypes";

const FORBIDDEN_SHELL_OPERATIONS = [
  "actual execution",
  "actual execution routing",
  "actual release enforcement",
  "actual no-op shell execution",
  "actual execution shell execution",
  "actual runtime adapter invocation",
  "actual provider routing",
  "actual queue control",
  "actual rollback execution",
  "prompt mutation",
  "token enforcement",
  "context pruning",
  "merge blocking",
] as const;

export function buildRuntimeExecutionBoundaryShellScope(
  reports: RuntimeSemanticPlanningReportsBeforeExecutionBoundaryShell
): RuntimeExecutionBoundaryShellScope {
  const preflightFinalGate = reports.runtimeReleaseGatePreflightFinalSafetyGate;
  const inputEnvelope = reports.runtimeReleaseGateInputEnvelope;

  const requiredInputMetadata = mergeSortedUniqueKo([
    "runtimeReleaseGatePreflightFinalSafetyGate",
    "runtimeReleaseGatePreflightReadinessVerificationReport",
    "runtimeReleaseGatePreflightAlignmentReport",
    "runtimeReleaseGatePreflightBoundaryViolationReport",
    "runtimeReleaseGatePreflightSummary",
    "runtimeReleaseGateNoExecutionProof",
    "runtimeReleaseGateOperationForbiddenProof",
    ...inputEnvelope.envelopeRows.slice(0, 6),
  ]);

  const expectedOutputMetadata = mergeSortedUniqueKo([
    "runtimeExecutionBoundaryShellSummary",
    "runtimeExecutionBoundaryShellScope",
    "runtimeExecutionBoundaryShellPolicy",
    "runtimeExecutionBoundaryShellBlockerReport",
    "runtimeExecutionBoundaryShellReadinessChecklist",
    `preflightFinalGate:${preflightFinalGate.finalGateStatus}`,
    `h36EntryReadiness:${preflightFinalGate.h36EntryReadiness}`,
  ]);

  const allowedShellMetadataScopes = mergeSortedUniqueKo([
    "execution_boundary_shell_candidate_status",
    "execution_boundary_shell_mode_metadata_only",
    "execution_boundary_shell_readiness_checklist",
    `h36EntryReadiness:${preflightFinalGate.h36EntryReadiness}`,
    "diagnosticBundleIncludesExecutionBoundaryShell:metadata",
  ]);

  return {
    mode: "runtime_execution_boundary_shell_scope",
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
    candidateSourceLayer: "runtimeReleaseGatePreflightFinalSafetyGate",
    candidateTargetLayer: "executionBoundaryMetadataShellCandidate",
    requiredInputMetadata,
    expectedOutputMetadata,
    allowedShellMetadataScopes,
    forbiddenShellOperations: [...FORBIDDEN_SHELL_OPERATIONS],
    recommendations: mergeSortedUniqueKo([
      "H36: execution boundary shell scope — metadata_only candidate(실제 execution·routing 없음)",
    ]),
  };
}
