/**
 * H34 — release-gate candidate **scope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeNoopShellReleaseGateScope } from "./runtimeNoopShellReleaseGateTypes";

const FORBIDDEN_RELEASE_GATE_OPERATIONS = [
  "actual no-op shell execution",
  "actual execution shell execution",
  "actual runtime adapter invocation",
  "actual execution",
  "provider routing",
  "queue control",
  "rollback execution",
  "prompt mutation",
  "token enforcement",
  "context pruning",
  "release enforcement",
  "merge blocking",
] as const;

export function buildRuntimeNoopShellReleaseGateScope(
  reports: RuntimeSemanticPlanningReportsBeforeNoopShellReleaseGate
): RuntimeNoopShellReleaseGateScope {
  const hardeningGate = reports.runtimeNoopShellHardeningFinalSafetyGate;
  const hardeningPreflight = reports.runtimeNoopShellHardeningPreflightSummary;
  const inputEnvelope = reports.runtimeNoopShellHardeningInputEnvelope;

  const requiredInputMetadata = mergeSortedUniqueKo([
    "runtimeNoopShellHardeningFinalSafetyGate",
    "runtimeNoopShellHardeningReadinessVerificationReport",
    "runtimeNoopShellHardeningAlignmentReport",
    "runtimeNoopShellHardeningBoundaryViolationReport",
    "runtimeNoopShellHardeningPreflightSummary",
    "runtimeNoopShellHardeningSummary",
    "runtimeNoopShellHardeningContractVerificationReport",
    "runtimeNoopExecutionShellHarnessPreflightSummary",
    "runtimeNoopExecutionShellFinalSafetyGate",
    ...inputEnvelope.envelopeRows.slice(0, 6),
  ]);

  const expectedOutputMetadata = mergeSortedUniqueKo([
    "runtimeNoopShellReleaseGateSummary",
    "runtimeNoopShellReleaseGateScope",
    "runtimeNoopShellReleaseGatePolicy",
    "runtimeNoopShellReleaseGateBlockerReport",
    "runtimeNoopShellReleaseGateReadinessChecklist",
    `hardeningFinalGate:${hardeningGate.finalGateStatus}`,
    `h34EntryReadiness:${hardeningGate.h34EntryReadiness}`,
    `hardeningPreflight:${hardeningPreflight.preflightReadiness}`,
  ]);

  const allowedReleaseGateMetadataScopes = mergeSortedUniqueKo([
    "release_gate_candidate_status",
    "release_gate_mode_metadata_only",
    "release_gate_readiness_checklist",
    `h34EntryReadiness:${hardeningGate.h34EntryReadiness}`,
    "diagnosticBundleIncludesNoopShellReleaseGate:metadata",
  ]);

  const recommendations = mergeSortedUniqueKo([
    "H34: release-gate scope — metadata_only candidate(실제 release enforcement·shell execution 없음)",
  ]);

  return {
    mode: "runtime_noop_shell_release_gate_scope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    candidateSourceLayer: "runtimeNoopShellHardeningFinalSafetyGate",
    candidateTargetLayer: "controlledNoopExecutionShellReleaseGateCandidate",
    requiredInputMetadata,
    expectedOutputMetadata,
    allowedReleaseGateMetadataScopes,
    forbiddenReleaseGateOperations: [...FORBIDDEN_RELEASE_GATE_OPERATIONS],
    recommendations,
  };
}
