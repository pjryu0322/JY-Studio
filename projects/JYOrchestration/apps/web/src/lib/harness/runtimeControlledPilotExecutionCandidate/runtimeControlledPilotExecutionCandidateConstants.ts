/**
 * H45 / H45.5 — controlled pilot execution candidate 공통 상수(read-only).
 */

import { RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED } from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessConstants";
import { SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS } from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessConstants";
import { PILOT_EXECUTION_READINESS_FORBIDDEN_BOUNDARY_OPERATIONS } from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessConstants";

export const RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED =
  RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED;

export const SERIALIZED_RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS =
  SERIALIZED_RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS;

export const RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_SOURCE_LAYER =
  "runtimePilotExecutionReadinessFinalSafetyGate" as const;

export const RUNTIME_FINAL_RUNTIME_HANDOFF_BOUNDARY_TARGET_LAYER = "finalRuntimeHandoffBoundary" as const;

export const CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_SOURCE_LAYER =
  "runtimePilotExecutionReadinessFinalSafetyGate" as const;

export const CONTROLLED_PILOT_EXECUTION_CANDIDATE_SCOPE_TARGET_LAYER = "controlledPilotExecutionCandidate" as const;

export const CONTROLLED_PILOT_EXECUTION_FORBIDDEN_OPERATIONS = PILOT_EXECUTION_READINESS_FORBIDDEN_BOUNDARY_OPERATIONS;

export const CONTROLLED_PILOT_EXECUTION_POLICY_FORBIDDEN_MUST_BE_TRUE = [
  "actualPilotActivationForbidden",
  "actualPilotExecutionForbidden",
  "actualIsolatedRunnerInvocationForbidden",
  "actualIsolatedRunnerExecutionForbidden",
  "actualDryRunRunnerInvocationForbidden",
  "actualDryRunRunnerExecutionForbidden",
  "actualAdapterInvocationForbidden",
  "actualSandboxInvocationForbidden",
  "actualExecutionForbidden",
  "actualExecutionRoutingForbidden",
  "actualReleaseEnforcementForbidden",
  "actualApprovalEnforcementForbidden",
] as const;

export const CONTROLLED_PILOT_EXECUTION_CANDIDATE_WORDING_RISK_PHRASES: readonly {
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
  { phrase: "executionroutingperformed=true", label: "executionRoutingPerformed=true" },
  { phrase: "releaseenforced=true", label: "releaseEnforced=true" },
  { phrase: "approvalenforced=true", label: "approvalEnforced=true" },
  { phrase: "actualpilotactivationforbidden=false", label: "actualPilotActivationForbidden=false" },
  { phrase: "actualpilotexecutionforbidden=false", label: "actualPilotExecutionForbidden=false" },
  { phrase: "actualexecutionforbidden=false", label: "actualExecutionForbidden=false" },
];

export const CONTROLLED_PILOT_EXECUTION_VERIFICATION_CHECKLIST_LABEL_ROWS = [
  "pilot execution readiness final gate ready_metadata",
  "h45 entry readiness ready_metadata",
  "pilot execution readiness verification verified_metadata",
  "pilot execution readiness alignment aligned_metadata",
  "final pilot no-execution proof diagnosticOnly",
  "final pilot execution-forbidden proof complete",
] as const;

export const CONTROLLED_PILOT_EXECUTION_ALIGNMENT_CHECKLIST_LABEL_ROWS = [
  "pilot execution readiness final gate ready_metadata",
  "h45 entry readiness ready_metadata",
  "pilot execution readiness verification verified_metadata",
  "pilot execution readiness alignment aligned_metadata",
  "no pilot execution readiness actual flag violations",
  "no pilot execution readiness proof violations",
  "no pilot execution readiness forbidden proof violations",
  "no controlled pilot execution blockers",
] as const;

export const CONTROLLED_PILOT_EXECUTION_FINAL_SAFETY_CHECKLIST_STATIC_ROWS = [
  "actualPilotActivationEnabled:false",
  "actualPilotExecutionEnabled:false",
  "actualIsolatedRunnerInvocationEnabled:false",
  "actualSandboxInvocationEnabled:false",
  "actualExecutionEnabled:false",
] as const;
