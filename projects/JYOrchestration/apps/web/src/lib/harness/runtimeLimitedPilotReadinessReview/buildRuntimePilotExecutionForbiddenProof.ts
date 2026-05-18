/**
 * H43 — pilot **execution-forbidden proof** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeLimitedPilotReadinessReviewConstants";
import type { RuntimePilotExecutionForbiddenProof } from "./runtimeLimitedPilotReadinessReviewTypes";

export { isRuntimePilotExecutionForbiddenProofComplete } from "./runtimeLimitedPilotReadinessReviewCheckHelpers";

export function buildRuntimePilotExecutionForbiddenProof(): RuntimePilotExecutionForbiddenProof {
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
    mode: "runtime_pilot_execution_forbidden_proof",
    ...RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
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
      "H43: pilot execution-forbidden proof — pilot·runner·adapter·sandbox·execution·blocking 금지 메타 고정",
    ]),
  };
}
