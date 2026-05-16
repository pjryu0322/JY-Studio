/**
 * H31 — no-op execution shell candidate **scope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeNoopExecutionShell } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeNoopExecutionShellScope } from "./runtimeNoopExecutionShellTypes";

const FORBIDDEN_SHELL_OPERATIONS = [
  "actual no-op shell execution",
  "actual execution shell execution",
  "actual isolated runner invocation",
  "actual isolated runner execution",
  "actual dry-run runner invocation",
  "actual dry-run runner execution",
  "actual runtime adapter invocation",
  "actual execution",
  "provider routing",
  "queue control",
  "rollback execution",
  "prompt mutation",
] as const;

export function buildRuntimeNoopExecutionShellScope(
  reports: RuntimeSemanticPlanningReportsBeforeNoopExecutionShell
): RuntimeNoopExecutionShellScope {
  const harnessGate = reports.runtimeRunnerNoopHarnessFinalSafetyGate;
  const harnessPreflight = reports.runtimeRunnerNoopHarnessPreflightSummary;
  const envelope = reports.runtimeRunnerNoopInvocationEnvelope;

  const requiredInputMetadata = mergeSortedUniqueKo([
    "runtimeRunnerNoopHarnessFinalSafetyGate",
    "runtimeRunnerNoopHarnessReadinessVerificationReport",
    "runtimeRunnerNoopHarnessAlignmentReport",
    "runtimeRunnerNoopHarnessBoundaryViolationReport",
    "runtimeRunnerNoopHarnessPreflightSummary",
    "runtimeRunnerNoopHarnessSummary",
    "runtimeRunnerNoopInvocationEnvelope",
    "runtimeRunnerNoopResultMetadata",
    "runtimeRunnerNoopHarnessSafetyGuard",
    ...envelope.envelopeRows.slice(0, 6),
  ]);

  const expectedOutputMetadata = mergeSortedUniqueKo([
    "runtimeNoopExecutionShellSummary",
    "runtimeNoopExecutionShellScope",
    "runtimeNoopExecutionShellPolicy",
    "runtimeNoopExecutionShellBlockerReport",
    "runtimeNoopExecutionShellReadinessChecklist",
    `harnessFinalGate:${harnessGate.finalGateStatus}`,
    `harnessPreflight:${harnessPreflight.preflightReadiness}`,
  ]);

  const allowedShellMetadataScopes = mergeSortedUniqueKo([
    "shell_candidate_status",
    "shell_mode_metadata_only",
    "shell_readiness_checklist",
    `h31EntryReadiness:${harnessGate.h31EntryReadiness}`,
    "diagnosticBundleIncludesNoopExecutionShell:metadata",
  ]);

  const recommendations = mergeSortedUniqueKo([
    "H31: execution shell scope — metadata_only candidate(실제 shell execution 없음)",
  ]);

  return {
    mode: "runtime_noop_execution_shell_scope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualNoopShellExecutionEnabled: false,
    actualExecutionShellExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    candidateSourceLayer: "runtimeRunnerNoopHarnessFinalSafetyGate",
    candidateTargetLayer: "isolatedDryRunNoopExecutionShellCandidate",
    requiredInputMetadata,
    expectedOutputMetadata,
    allowedShellMetadataScopes,
    forbiddenShellOperations: [...FORBIDDEN_SHELL_OPERATIONS],
    recommendations,
  };
}
