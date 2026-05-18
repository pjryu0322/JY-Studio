/**
 * H27 — activation candidate **policy** metadata(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimePilotActivationCandidateStatus, RuntimePilotActivationPolicy } from "./runtimePilotActivationTypes";
import { resolveRuntimePilotActivationMode } from "./resolveRuntimePilotActivationMode";

export function buildRuntimePilotActivationPolicy(input: {
  readonly candidateStatus: RuntimePilotActivationCandidateStatus;
}): RuntimePilotActivationPolicy {
  const activationAllowedMode = resolveRuntimePilotActivationMode(input.candidateStatus);

  const recommendations = mergeSortedUniqueKo([
    "actualActivationForbidden:true — metadata_only candidate만 허용",
    ...(activationAllowedMode === "metadata_only"
      ? ["H27: activation policy metadata_only — operator review·rollback·audit 선행(집행 없음)"]
      : []),
    ...(activationAllowedMode === "blocked"
      ? ["H27: activation policy blocked — blocker·sandbox preflight 정렬"]
      : []),
  ]);

  return {
    mode: "runtime_pilot_activation_policy",
    actualRuntimeOrchestrationEnabled: false,
    actualPilotActivationEnabled: false,
    actualPilotExecutionEnabled: false,
    activationAllowedMode,
    operatorReviewBeforeActivation: true,
    rollbackReadinessRequired: true,
    auditTraceRequired: true,
    sandboxPreflightRequired: true,
    actualActivationForbidden: true,
    recommendations,
  };
}
