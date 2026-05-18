/**
 * H40 — orchestration-forbidden proof metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED } from "./runtimeUltimateGovernanceReviewConstants";
import type { RuntimeOrchestrationForbiddenProof } from "./runtimeUltimateGovernanceReviewTypes";

export { isRuntimeOrchestrationForbiddenProofComplete } from "./runtimeUltimateGovernanceReviewCheckHelpers";

export function buildRuntimeOrchestrationForbiddenProof(): RuntimeOrchestrationForbiddenProof {
  const proofRows = mergeSortedUniqueKo([
    "actualOrchestrationForbidden:true",
    "actualExecutionForbidden:true",
    "actualExecutionRoutingForbidden:true",
    "actualReleaseEnforcementForbidden:true",
    "actualApprovalEnforcementForbidden:true",
    "actualShellExecutionForbidden:true",
    "actualAdapterInvocationForbidden:true",
    "actualProviderRoutingForbidden:true",
    "actualQueueControlForbidden:true",
    "actualRollbackForbidden:true",
    "actualExecutionBlockingForbidden:true",
    "actualMergeBlockingForbidden:true",
    "actualPromptMutationForbidden:true",
    "actualTokenEnforcementForbidden:true",
    "actualContextPruningForbidden:true",
    "actualRetrievalOrchestrationForbidden:true",
  ]);

  return {
    mode: "runtime_orchestration_forbidden_proof",
    ...RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
    actualOrchestrationForbidden: true,
    actualExecutionForbidden: true,
    actualExecutionRoutingForbidden: true,
    actualReleaseEnforcementForbidden: true,
    actualApprovalEnforcementForbidden: true,
    actualShellExecutionForbidden: true,
    actualAdapterInvocationForbidden: true,
    actualProviderRoutingForbidden: true,
    actualQueueControlForbidden: true,
    actualRollbackForbidden: true,
    actualExecutionBlockingForbidden: true,
    actualMergeBlockingForbidden: true,
    actualPromptMutationForbidden: true,
    actualTokenEnforcementForbidden: true,
    actualContextPruningForbidden: true,
    actualRetrievalOrchestrationForbidden: true,
    proofRows,
    recommendations: mergeSortedUniqueKo([
      "H40: orchestration-forbidden proof — orchestration·execution·blocking 금지 메타 고정",
    ]),
  };
}
