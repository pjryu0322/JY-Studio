/**
 * H26 — sandbox **policy** metadata(read-only; enforcement 없음).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeAdapterSandboxPolicy, RuntimeAdapterSandboxReadiness } from "./runtimeAdapterSandboxTypes";

const FORBIDDEN_SANDBOX_OPERATIONS = [
  "actual adapter invocation",
  "actual execution",
  "provider routing",
  "provider switching",
  "queue control",
  "rollback execution",
  "approval enforcement",
  "prompt payload mutation",
  "token enforcement",
] as const;

export function buildRuntimeAdapterSandboxPolicy(input: {
  readonly sandboxReadiness: RuntimeAdapterSandboxReadiness;
}): RuntimeAdapterSandboxPolicy {
  const { sandboxReadiness } = input;

  const allowedSandboxMetadataScopes = mergeSortedUniqueKo([
    "noop_preflight_summary",
    "pilot_contract_summary",
    "contract_verification_report",
    "invocation_guard_report",
    "noop_result_metadata",
    "controlled_pilot_summary",
    "operator_approval_summary",
    "rollback_readiness_summary",
    "audit_readiness_summary",
    ...(sandboxReadiness === "sandbox_metadata_ready"
      ? ["sandbox_input_envelope", "sandbox_output_envelope_schema"]
      : []),
  ]);

  const sandboxActivationConditions = mergeSortedUniqueKo([
    "preflightReadiness:ready_metadata",
    "invocationGuard:contract_metadata_only",
    "actualFlagViolations:0",
    "wordingRiskFindings:0",
    "contractVerification:verified_noop",
    "H26: sandbox_metadata_ready is not invocation permission",
  ]);

  const sandboxDeactivationConditions = mergeSortedUniqueKo([
    "preflightReadiness:blocked",
    "preflightReadiness:not_ready",
    "invocationGuard:always_blocked",
    "contractVerification:failed",
    "handoffReadiness:blocked",
    "adapterBoundaryMode:handoff_blocked",
  ]);

  return {
    mode: "runtime_adapter_sandbox_policy",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualSandboxInvocationEnabled: false,
    allowedSandboxMetadataScopes,
    forbiddenSandboxOperations: mergeSortedUniqueKo([...FORBIDDEN_SANDBOX_OPERATIONS]),
    sandboxActivationConditions,
    sandboxDeactivationConditions,
    recommendations: mergeSortedUniqueKo([
      "H26: sandbox policy — metadata scope만 허용, actual sandbox invocation 금지",
    ]),
  };
}
