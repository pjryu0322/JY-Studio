/**
 * H44 — final pilot **execution-forbidden proof** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED } from "./runtimePilotExecutionReadinessConstants";
import type { RuntimeFinalPilotExecutionForbiddenProof } from "./runtimePilotExecutionReadinessTypes";

export { isRuntimeFinalPilotExecutionForbiddenProofComplete } from "./runtimePilotExecutionReadinessCheckHelpers";

export function buildRuntimeFinalPilotExecutionForbiddenProof(): RuntimeFinalPilotExecutionForbiddenProof {
  const proofRows = mergeSortedUniqueKo([
    "actualPilotActivationForbidden:true",
    "actualPilotExecutionForbidden:true",
    "actualIsolatedRunnerInvocationForbidden:true",
    "actualIsolatedRunnerExecutionForbidden:true",
    "actualDryRunRunnerInvocationForbidden:true",
    "actualDryRunRunnerExecutionForbidden:true",
    "actualNoopShellExecutionForbidden:true",
    "actualExecutionShellExecutionForbidden:true",
    "actualAdapterInvocationForbidden:true",
    "actualSandboxInvocationForbidden:true",
    "actualExecutionForbidden:true",
    "actualExecutionRoutingForbidden:true",
    "actualProviderRoutingForbidden:true",
    "actualQueueControlForbidden:true",
    "actualRollbackForbidden:true",
    "actualReleaseEnforcementForbidden:true",
    "actualApprovalEnforcementForbidden:true",
    "actualExecutionBlockingForbidden:true",
    "actualMergeBlockingForbidden:true",
    "actualPromptMutationForbidden:true",
    "actualTokenEnforcementForbidden:true",
    "actualContextPruningForbidden:true",
    "actualRetrievalOrchestrationForbidden:true",
  ]);

  return {
    mode: "runtime_final_pilot_execution_forbidden_proof",
    ...RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
    actualPilotActivationForbidden: true,
    actualPilotExecutionForbidden: true,
    actualIsolatedRunnerInvocationForbidden: true,
    actualIsolatedRunnerExecutionForbidden: true,
    actualDryRunRunnerInvocationForbidden: true,
    actualDryRunRunnerExecutionForbidden: true,
    actualNoopShellExecutionForbidden: true,
    actualExecutionShellExecutionForbidden: true,
    actualAdapterInvocationForbidden: true,
    actualSandboxInvocationForbidden: true,
    actualExecutionForbidden: true,
    actualExecutionRoutingForbidden: true,
    actualProviderRoutingForbidden: true,
    actualQueueControlForbidden: true,
    actualRollbackForbidden: true,
    actualReleaseEnforcementForbidden: true,
    actualApprovalEnforcementForbidden: true,
    actualExecutionBlockingForbidden: true,
    actualMergeBlockingForbidden: true,
    actualPromptMutationForbidden: true,
    actualTokenEnforcementForbidden: true,
    actualContextPruningForbidden: true,
    actualRetrievalOrchestrationForbidden: true,
    proofRows,
    recommendations: mergeSortedUniqueKo([
      "H44: final pilot execution-forbidden proof — pilot·runner·adapter·sandbox·execution·blocking 금지 메타 고정",
    ]),
  };
}
