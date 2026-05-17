/**
 * H41 — controlled activation candidate **policy** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeControlledActivationCandidatePolicy,
  RuntimeControlledActivationCandidateStatus,
} from "./runtimeControlledActivationCandidateTypes";
import { resolveRuntimeControlledActivationMode } from "./resolveRuntimeControlledActivationMode";
import { RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "./runtimeControlledActivationCandidateConstants";

export function buildRuntimeControlledActivationCandidatePolicy(input: {
  readonly candidateStatus: RuntimeControlledActivationCandidateStatus;
}): RuntimeControlledActivationCandidatePolicy {
  const activationAllowedMode = resolveRuntimeControlledActivationMode(input.candidateStatus);

  const recommendations = mergeSortedUniqueKo([
    "actualControlledActivationForbidden:true — metadata_only candidate만 허용",
    "actualRuntimeOrchestrationForbidden:true",
    "actualExecutionBlockingForbidden:true",
    "actualMergeBlockingForbidden:true",
    ...(activationAllowedMode === "metadata_only"
      ? ["H41: controlled activation policy metadata_only — operator review·rollback·audit 선행(activation 없음)"]
      : []),
    ...(activationAllowedMode === "blocked"
      ? ["H41: controlled activation policy blocked — ultimate governance final gate 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_controlled_activation_candidate_policy",
    ...RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED,
    activationAllowedMode,
    operatorReviewBeforeControlledActivation: true,
    rollbackReadinessRequired: true,
    auditTraceRequired: true,
    actualRuntimeOrchestrationForbidden: true,
    actualControlledActivationForbidden: true,
    actualPilotActivationForbidden: true,
    actualPilotExecutionForbidden: true,
    actualExecutionForbidden: true,
    actualExecutionRoutingForbidden: true,
    actualReleaseEnforcementForbidden: true,
    actualApprovalEnforcementForbidden: true,
    actualAdapterInvocationForbidden: true,
    actualProviderRoutingForbidden: true,
    actualQueueControlForbidden: true,
    actualRollbackForbidden: true,
    actualExecutionBlockingForbidden: true,
    actualMergeBlockingForbidden: true,
    recommendations,
  };
}
