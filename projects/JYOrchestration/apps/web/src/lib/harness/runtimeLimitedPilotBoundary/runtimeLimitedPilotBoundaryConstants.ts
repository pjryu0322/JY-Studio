/**
 * H42 / H42.5 — limited pilot boundary 공통 상수(read-only).
 */

import {
  RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
} from "@/lib/harness/runtimeShared/runtimeReadOnlyActualFlags";

export const RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS_DISABLED = {
  ...RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED,
  actualControlledActivationEnabled: false,
  actualPilotActivationEnabled: false,
  actualIsolatedRunnerInvocationEnabled: false,
  actualIsolatedRunnerExecutionEnabled: false,
  actualDryRunRunnerInvocationEnabled: false,
  actualSandboxInvocationEnabled: false,
} as const;

export const SERIALIZED_RUNTIME_LIMITED_PILOT_BOUNDARY_ACTUAL_FLAGS = {
  ...SERIALIZED_RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS,
  actualControlledActivationEnabled: false,
  actualPilotActivationEnabled: false,
  actualIsolatedRunnerInvocationEnabled: false,
  actualIsolatedRunnerExecutionEnabled: false,
  actualDryRunRunnerInvocationEnabled: false,
  actualSandboxInvocationEnabled: false,
};

export const LIMITED_PILOT_BOUNDARY_SCOPE_SOURCE_LAYER =
  "runtimeControlledActivationCandidateFinalSafetyGate" as const;

export const LIMITED_PILOT_BOUNDARY_SCOPE_TARGET_LAYER =
  "limitedControlledRuntimePilotBoundaryCandidate" as const;

export const LIMITED_PILOT_BOUNDARY_WORDING_RISK_PHRASES: readonly {
  readonly phrase: string;
  readonly label: string;
}[] = [
  { phrase: "pilotactivationperformed=true", label: "pilotActivationPerformed=true" },
  { phrase: "pilotexecutionperformed=true", label: "pilotExecutionPerformed=true" },
  { phrase: "isolatedrunnerinvoked=true", label: "isolatedRunnerInvoked=true" },
  { phrase: "isolatedrunnerexecuted=true", label: "isolatedRunnerExecuted=true" },
  { phrase: "dryrunrunnerinvoked=true", label: "dryRunRunnerInvoked=true" },
  { phrase: "runtimeadapterinvoked=true", label: "runtimeAdapterInvoked=true" },
  { phrase: "sandboxinvoked=true", label: "sandboxInvoked=true" },
  { phrase: "executionperformed=true", label: "executionPerformed=true" },
  { phrase: "releaseenforced=true", label: "releaseEnforced=true" },
  { phrase: "approvalenforced=true", label: "approvalEnforced=true" },
  { phrase: "actualpilotactivationforbidden=false", label: "actualPilotActivationForbidden=false" },
  { phrase: "actualpilotexecutionforbidden=false", label: "actualPilotExecutionForbidden=false" },
  { phrase: "actualexecutionforbidden=false", label: "actualExecutionForbidden=false" },
];

export const LIMITED_PILOT_POLICY_FORBIDDEN_MUST_BE_TRUE = [
  "actualRuntimeOrchestrationForbidden",
  "actualControlledActivationForbidden",
  "actualPilotActivationForbidden",
  "actualPilotExecutionForbidden",
  "actualIsolatedRunnerInvocationForbidden",
  "actualIsolatedRunnerExecutionForbidden",
  "actualDryRunRunnerInvocationForbidden",
  "actualNoopShellExecutionForbidden",
  "actualExecutionShellExecutionForbidden",
  "actualAdapterInvocationForbidden",
  "actualSandboxInvocationForbidden",
  "actualExecutionForbidden",
  "actualExecutionRoutingForbidden",
  "actualReleaseEnforcementForbidden",
  "actualApprovalEnforcementForbidden",
  "actualExecutionBlockingForbidden",
  "actualMergeBlockingForbidden",
] as const;

export const LIMITED_PILOT_VERIFICATION_CHECKLIST_LABEL_ROWS = [
  "controlled activation candidate final gate ready_metadata",
  "h42 entry readiness ready_metadata",
  "controlled activation verification verified_metadata",
  "controlled activation alignment aligned_metadata",
] as const;

export const LIMITED_PILOT_VERIFICATION_CHECKLIST_ACTUAL_DISABLED_ROWS = [
  "actual pilot activation disabled",
  "actual pilot execution disabled",
  "actual isolated runner invocation disabled",
  "actual runtime adapter invocation disabled",
  "actual sandbox invocation disabled",
  "actual execution disabled",
  "actual execution routing disabled",
  "actual release enforcement disabled",
  "actual approval enforcement disabled",
] as const;

export const LIMITED_PILOT_ALIGNMENT_CHECKLIST_LABEL_ROWS = [
  "controlled activation candidate final gate ready_metadata",
  "h42 entry readiness ready_metadata",
  "controlled activation verification verified_metadata",
  "controlled activation alignment aligned_metadata",
  "no controlled activation actual flag violations",
  "no controlled activation policy violations",
] as const;

export const LIMITED_PILOT_FINAL_SAFETY_CHECKLIST_STATIC_ROWS = [
  "actualPilotActivationDisabled:true",
  "actualPilotExecutionDisabled:true",
  "actualSandboxInvocationDisabled:true",
] as const;

export const LIMITED_PILOT_FORBIDDEN_OPERATIONS = [
  "actual runtime orchestration",
  "actual controlled activation",
  "actual pilot activation",
  "actual pilot execution",
  "actual isolated runner invocation",
  "actual isolated runner execution",
  "actual dry-run runner invocation",
  "actual no-op shell execution",
  "actual execution shell execution",
  "actual runtime adapter invocation",
  "actual sandbox invocation",
  "actual execution",
  "actual execution routing",
  "actual provider routing",
  "actual queue control",
  "actual rollback execution",
  "actual release enforcement",
  "actual approval enforcement",
  "actual execution blocking",
  "actual merge blocking",
  "prompt mutation",
  "token enforcement",
  "context pruning",
  "retrieval orchestration",
] as const;
