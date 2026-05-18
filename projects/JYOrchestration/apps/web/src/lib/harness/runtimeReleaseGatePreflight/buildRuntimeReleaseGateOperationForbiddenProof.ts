/**
 * H35 — release-gate **operation-forbidden proof**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeReleaseGateOperationForbiddenProof } from "./runtimeReleaseGatePreflightTypes";

export function buildRuntimeReleaseGateOperationForbiddenProof(): RuntimeReleaseGateOperationForbiddenProof {
  const proofRows = mergeSortedUniqueKo([
    "actualReleaseEnforcementForbidden:true",
    "actualShellExecutionForbidden:true",
    "actualAdapterInvocationForbidden:true",
    "actualExecutionForbidden:true",
    "actualProviderRoutingForbidden:true",
    "actualQueueControlForbidden:true",
    "actualRollbackForbidden:true",
    "actualPromptMutationForbidden:true",
    "actualTokenEnforcementForbidden:true",
    "actualContextPruningForbidden:true",
    "actualMergeBlockingForbidden:true",
  ]);

  return {
    mode: "runtime_release_gate_operation_forbidden_proof",
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
    actualReleaseEnforcementForbidden: true,
    actualShellExecutionForbidden: true,
    actualAdapterInvocationForbidden: true,
    actualExecutionForbidden: true,
    actualProviderRoutingForbidden: true,
    actualQueueControlForbidden: true,
    actualRollbackForbidden: true,
    actualPromptMutationForbidden: true,
    actualTokenEnforcementForbidden: true,
    actualContextPruningForbidden: true,
    actualMergeBlockingForbidden: true,
    proofRows,
    recommendations: mergeSortedUniqueKo([
      "H35: operation-forbidden proof — release enforcement·shell·adapter·execution 금지 메타 고정",
    ]),
  };
}

export function isRuntimeReleaseGateOperationForbiddenProofComplete(
  proof: RuntimeReleaseGateOperationForbiddenProof
): boolean {
  return (
    proof.actualReleaseEnforcementForbidden === true &&
    proof.actualShellExecutionForbidden === true &&
    proof.actualAdapterInvocationForbidden === true &&
    proof.actualExecutionForbidden === true &&
    proof.actualProviderRoutingForbidden === true &&
    proof.actualQueueControlForbidden === true &&
    proof.actualRollbackForbidden === true &&
    proof.actualPromptMutationForbidden === true &&
    proof.actualTokenEnforcementForbidden === true &&
    proof.actualContextPruningForbidden === true &&
    proof.actualMergeBlockingForbidden === true
  );
}
