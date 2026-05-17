/**
 * H38~H40 — orchestration/governance forbidden proof 필수 키(read-only).
 */

export const RUNTIME_ORCHESTRATION_FORBIDDEN_PROOF_REQUIRED_KEYS = [
  "actualOrchestrationForbidden",
  "actualExecutionForbidden",
  "actualExecutionRoutingForbidden",
  "actualReleaseEnforcementForbidden",
  "actualApprovalEnforcementForbidden",
  "actualShellExecutionForbidden",
  "actualAdapterInvocationForbidden",
  "actualProviderRoutingForbidden",
  "actualQueueControlForbidden",
  "actualRollbackForbidden",
  "actualExecutionBlockingForbidden",
  "actualMergeBlockingForbidden",
  "actualPromptMutationForbidden",
  "actualTokenEnforcementForbidden",
  "actualContextPruningForbidden",
  "actualRetrievalOrchestrationForbidden",
] as const;

export type RuntimeOrchestrationForbiddenProofRequiredKey =
  (typeof RUNTIME_ORCHESTRATION_FORBIDDEN_PROOF_REQUIRED_KEYS)[number];

export function isRuntimeOrchestrationForbiddenProofRecordComplete(
  proof: Readonly<Record<RuntimeOrchestrationForbiddenProofRequiredKey, boolean>>
): boolean {
  return RUNTIME_ORCHESTRATION_FORBIDDEN_PROOF_REQUIRED_KEYS.every((key) => proof[key] === true);
}
