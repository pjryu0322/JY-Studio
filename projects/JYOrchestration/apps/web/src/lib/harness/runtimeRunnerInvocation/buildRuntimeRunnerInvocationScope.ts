/**
 * H29 — runner invocation candidate **scope** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeRunnerInvocation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import type { RuntimeRunnerInvocationScope } from "./runtimeRunnerInvocationTypes";

const FORBIDDEN_INVOCATION_OPERATIONS = [
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

export function buildRuntimeRunnerInvocationScope(
  reports: RuntimeSemanticPlanningReportsBeforeRunnerInvocation
): RuntimeRunnerInvocationScope {
  const preflight = reports.runtimePilotSkeletonPreflightSummary;
  const contract = reports.runtimeDryRunRunnerContract;
  const input = reports.runtimePilotRunnerInputEnvelope;
  const output = reports.runtimePilotRunnerOutputEnvelope;

  const requiredInputMetadata = mergeSortedUniqueKo([
    "runtimePilotSkeletonPreflightSummary",
    "runtimePilotRunnerContractVerificationReport",
    "runtimePilotRunnerBoundaryViolationReport",
    "runtimePilotSkeletonBlockerReport",
    "runtimePilotRunnerNoExecutionResultMetadata",
    "runtimeDryRunRunnerContract",
    "runtimePilotRunnerSafetyGuard",
    ...contract.requiredInputMetadata.slice(0, 6),
    ...input.envelopeRows.slice(0, 4),
  ]);

  const expectedOutputMetadata = mergeSortedUniqueKo([
    "runtimeRunnerInvocationSummary",
    "runtimeRunnerInvocationScope",
    "runtimeRunnerInvocationPolicy",
    "runtimeRunnerInvocationBlockerReport",
    "runtimeRunnerInvocationReadinessChecklist",
    ...output.acceptedMetadataRows.slice(0, 3),
  ]);

  const allowedInvocationMetadataScopes = mergeSortedUniqueKo([
    "invocation_candidate_status",
    "invocation_mode_metadata_only",
    "invocation_readiness_checklist",
    `skeletonPreflight:${preflight.preflightReadiness}`,
    "diagnosticBundleIncludesRunnerInvocation:metadata",
  ]);

  const recommendations = mergeSortedUniqueKo([
    "H29: runner invocation scope — metadata_only candidate(실제 runner invocation·execution 없음)",
  ]);

  return {
    mode: "runtime_runner_invocation_scope",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotExecutionEnabled: false,
    actualIsolatedRunnerInvocationEnabled: false,
    actualIsolatedRunnerExecutionEnabled: false,
    actualDryRunRunnerInvocationEnabled: false,
    actualDryRunRunnerExecutionEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualExecutionEnabled: false,
    actualProviderRoutingEnabled: false,
    actualQueueControlEnabled: false,
    actualRollbackExecutionEnabled: false,
    candidateSourceLayer: "runtimePilotSkeletonPreflightSummary",
    candidateTargetLayer: "isolatedDryRunRunnerInvocationCandidate",
    requiredInputMetadata,
    expectedOutputMetadata,
    allowedInvocationMetadataScopes,
    forbiddenInvocationOperations: [...FORBIDDEN_INVOCATION_OPERATIONS],
    recommendations,
  };
}
