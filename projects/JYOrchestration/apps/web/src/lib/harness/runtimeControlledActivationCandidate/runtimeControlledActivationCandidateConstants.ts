/**
 * H41 — controlled activation candidate 공통 상수(read-only).
 */

import {
  RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
} from "@/lib/harness/runtimeShared/runtimeReadOnlyActualFlags";

export const RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS_DISABLED = {
  ...RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  actualControlledActivationEnabled: false,
  actualPilotActivationEnabled: false,
} as const;

export const SERIALIZED_RUNTIME_CONTROLLED_ACTIVATION_CANDIDATE_ACTUAL_FLAGS = {
  ...SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
  actualControlledActivationEnabled: false,
  actualPilotActivationEnabled: false,
};

export const RUNTIME_CONTROL_HANDOFF_BOUNDARY_SOURCE_LAYER =
  "runtimeUltimateGovernanceReviewFinalSafetyGate" as const;

export const RUNTIME_CONTROL_HANDOFF_BOUNDARY_TARGET_LAYER = "runtimeControlHandoffBoundary" as const;

export const CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_SOURCE_LAYER =
  "runtimeUltimateGovernanceReviewFinalSafetyGate" as const;

export const CONTROLLED_ACTIVATION_CANDIDATE_SCOPE_TARGET_LAYER = "controlledActivationCandidate" as const;

export const CONTROLLED_ACTIVATION_CANDIDATE_WORDING_RISK_PHRASES: readonly {
  readonly phrase: string;
  readonly label: string;
}[] = [
  { phrase: "actualcontrolledactivationenabled=true", label: "actualControlledActivationEnabled=true" },
  { phrase: "controlledactivationperformed=true", label: "controlledActivationPerformed=true" },
  { phrase: "runtimeorchestrated=true", label: "runtimeOrchestrated=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "executionroutingperformed=true", label: "executionRoutingPerformed=true" },
  { phrase: "releaseenforced=true", label: "releaseEnforced=true" },
  { phrase: "approvalenforced=true", label: "approvalEnforced=true" },
  { phrase: "executionblocked=true", label: "executionBlocked=true" },
  { phrase: "mergeblocked=true", label: "mergeBlocked=true" },
  { phrase: "actualcontrolledactivationforbidden=false", label: "actualControlledActivationForbidden=false" },
  { phrase: "actualruntimeorchestrationforbidden=false", label: "actualRuntimeOrchestrationForbidden=false" },
  { phrase: "actualexecutionforbidden=false", label: "actualExecutionForbidden=false" },
  { phrase: "actualapprovalenforcementforbidden=false", label: "actualApprovalEnforcementForbidden=false" },
];

export const CONTROLLED_ACTIVATION_POLICY_FORBIDDEN_MUST_BE_TRUE = [
  "actualRuntimeOrchestrationForbidden",
  "actualControlledActivationForbidden",
  "actualPilotActivationForbidden",
  "actualPilotExecutionForbidden",
  "actualExecutionForbidden",
  "actualExecutionRoutingForbidden",
  "actualReleaseEnforcementForbidden",
  "actualApprovalEnforcementForbidden",
  "actualAdapterInvocationForbidden",
  "actualProviderRoutingForbidden",
  "actualQueueControlForbidden",
  "actualRollbackForbidden",
  "actualExecutionBlockingForbidden",
  "actualMergeBlockingForbidden",
] as const;

export const CONTROLLED_ACTIVATION_VERIFICATION_CHECKLIST_LABEL_ROWS = [
  "ultimate governance review final gate ready_metadata",
  "h41 entry readiness ready_metadata",
  "ultimate governance review verification verified_metadata",
  "ultimate governance review alignment aligned_metadata",
] as const;

export const CONTROLLED_ACTIVATION_VERIFICATION_CHECKLIST_ACTUAL_DISABLED_ROWS = [
  "actual runtime orchestration disabled",
  "actual controlled activation disabled",
  "actual execution disabled",
  "actual execution routing disabled",
  "actual release enforcement disabled",
  "actual approval enforcement disabled",
] as const;

export const CONTROLLED_ACTIVATION_ALIGNMENT_CHECKLIST_LABEL_ROWS = [
  "ultimate governance review final gate ready_metadata",
  "h41 entry readiness ready_metadata",
  "ultimate governance review verification verified_metadata",
  "ultimate governance review alignment aligned_metadata",
  "no ultimate governance actual flag violations",
  "no ultimate governance proof violations",
] as const;

export const CONTROLLED_ACTIVATION_FINAL_SAFETY_CHECKLIST_STATIC_ROWS = [
  "actualControlledActivationDisabled:true",
  "actualRuntimeOrchestrationDisabled:true",
  "actualExecutionDisabled:true",
] as const;

export const CONTROLLED_ACTIVATION_FORBIDDEN_OPERATIONS = [
  "actual runtime orchestration",
  "actual controlled activation",
  "actual pilot activation",
  "actual pilot execution",
  "actual execution",
  "actual execution routing",
  "actual release enforcement",
  "actual approval enforcement",
  "actual runtime adapter invocation",
  "actual provider routing",
  "actual queue control",
  "actual rollback execution",
  "actual execution blocking",
  "actual merge blocking",
  "prompt mutation",
  "token enforcement",
  "context pruning",
  "retrieval orchestration",
] as const;
